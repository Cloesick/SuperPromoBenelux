// SuperPromo folder scraper — Apify actor entry point.
//
// Flow per retailer:
//   1. Visit folderUrls (Puppeteer + Apify proxy) until one renders.
//   2. While loading, intercept network responses to capture the PDF the
//      embedded Publitas/flipbook viewer fetches (AH, Delhaize, Lidl, Action).
//   3. If no PDF auto-loads, open the embed iframe directly to trigger it.
//   4. Extract deals from the PDF text (extractPdf.js — port of the site's
//      proven extractDealsFromText.ts); fall back to page-text extraction.
//   5. Push a Folder row + its Deals to Airtable + the Apify dataset.
//
// Replaces the local `npm run scrape` with a scheduled, proxied cloud run.

import { Actor } from 'apify';
import { PuppeteerCrawler, Dataset } from 'crawlee';
import { resolveRetailers } from './retailers.js';
import { extractDeals } from './extractDeals.js';
import { extractDealsFromPdf } from './extractPdf.js';
import { Airtable } from './airtable.js';

await Actor.init();

const input = (await Actor.getInput()) || {};
const {
  retailers: requested = [],
  pushToAirtable = true,
  airtableToken = process.env.AIRTABLE_TOKEN,
  airtableBaseId = process.env.AIRTABLE_BASE || 'appILxwPpKEWomToC',
  proxyConfiguration: proxyInput,
} = input;

const targets = resolveRetailers(requested);
const scrapedAt = new Date().toISOString();
const isoWeek = (() => {
  const d = new Date();
  const day = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - day + 3);
  const firstThu = new Date(Date.UTC(d.getUTCFullYear(), 0, 4));
  const week = 1 + Math.round(((d - firstThu) / 86400000 - 3 + ((firstThu.getUTCDay() + 6) % 7)) / 7);
  return `${d.getUTCFullYear()}-w${String(week).padStart(2, '0')}`;
})();

const airtable =
  pushToAirtable && airtableToken ? new Airtable({ token: airtableToken, baseId: airtableBaseId }) : null;
if (pushToAirtable && !airtable) {
  Actor.log.warning('pushToAirtable is on but no AIRTABLE_TOKEN — dataset only.');
}

const proxyConfiguration = await Actor.createProxyConfiguration(
  proxyInput || { groups: ['RESIDENTIAL'], countryCode: 'BE' },
);

// For retailers whose viewer is hidden behind a SPA, navigate straight to the
// current-week viewer URL (built from the ISO week number) before the SPA pages.
const weekNum = isoWeek.split('w')[1];
const requests = targets.map((r) => {
  const urls = [...r.folderUrls];
  if (r.viewerTemplate) urls.unshift(r.viewerTemplate.replace('{WEEK}', weekNum));
  return { url: urls[0], userData: { retailer: r, fallbacks: urls.slice(1) } };
});

// Build an ordered, de-duplicated list of full-size folder page images from the
// Publitas/flipbook page-image URLs the viewer loaded (…/pages/{hash}-at{size}.jpg).
// Keeps the largest size captured per page, in first-seen (≈ page) order.
function buildPages(imageUrls) {
  const order = [];
  const best = new Map();
  for (const u of imageUrls) {
    const m = u.match(/\/pages\/([A-Za-z0-9_-]+)-at(\d+)\.(?:jpe?g|webp|png)/i);
    if (!m) continue;
    const hash = m[1];
    const size = parseInt(m[2], 10);
    if (!best.has(hash)) order.push(hash);
    const cur = best.get(hash);
    if (!cur || size > cur.size) best.set(hash, { url: u.split('?')[0], size });
  }
  return order.map((h, i) => ({ pageNumber: i + 1, imageUrl: best.get(h).url, deals: [] }));
}

const crawler = new PuppeteerCrawler({
  proxyConfiguration,
  maxRequestRetries: 2,
  navigationTimeoutSecs: 90,
  requestHandlerTimeoutSecs: 180,
  launchContext: { launchOptions: { args: ['--no-sandbox'] } },
  // Retail pages are tracker-heavy and rarely reach `load`/`networkidle`.
  // Navigate on `domcontentloaded`, and capture any PDF the embedded viewer
  // fetches via a response listener (fires for iframe subrequests too).
  preNavigationHooks: [
    async ({ page, request }, gotoOptions) => {
      gotoOptions.waitUntil = 'domcontentloaded';
      gotoOptions.timeout = 75000;
      if (!request.userData._pdfHooked) {
        request.userData._pdfHooked = true;
        request.userData.pdfUrls = [];
        request.userData.imageUrls = [];
        page.on('response', (resp) => {
          try {
            const u = resp.url();
            const ct = resp.headers()['content-type'] || '';
            if (/\.pdf($|\?)/i.test(u) || ct.includes('application/pdf')) {
              if (!request.userData.pdfUrls.includes(u)) request.userData.pdfUrls.push(u);
            }
            // Capture flipbook page images (Publitas/iPaper viewer hosts).
            if (
              (ct.startsWith('image/') || /\.(jpe?g|png|webp)(\?|$)/i.test(u)) &&
              /publitas\.com|publications\.action|folder-nl\.lidl|folder\.aldi|ipaper/i.test(u)
            ) {
              if (!request.userData.imageUrls.includes(u)) request.userData.imageUrls.push(u);
            }
          } catch {
            /* ignore */
          }
        });
      }
    },
  ],
  async requestHandler({ page, request, log }) {
    const { retailer, fallbacks } = request.userData;
    log.info(`[${retailer.slug}] ${request.url}`);

    try {
      await page.waitForSelector(retailer.waitFor || 'body', { timeout: 15000 });
    } catch {
      /* continue with whatever rendered */
    }
    // Give the embedded flipbook/Publitas viewer time to fetch its PDF.
    await page.waitForNetworkIdle({ idleTime: 1500, timeout: 20000 }).catch(() => {});

    // If no PDF auto-loaded, find the Publitas/flipbook viewer and pull the
    // direct PDF URL out of its page (Publitas streams page IMAGES, so no .pdf
    // request fires — but the viewer HTML/JSON embeds the /pdfs/{hash}.pdf URL).
    if (!(request.userData.pdfUrls || []).length) {
      const PDF_RE = /https?:\/\/[^"'\s)\\]*\/pdfs\/[A-Za-z0-9_-]+\.pdf[^"'\s)\\]*/i;
      const VIEWER_RE =
        /(?:https?:\/\/)?(?:view\.publitas\.com|publications\.action\.com|folder-nl\.lidl\.be|folder\.aldi\.be|[a-z0-9.-]*\.ipaper\.io)\/[^"'\s)\\]*/gi;
      const isJunk = (u) => /\.(jpg|jpeg|png|webp|gif|css|js)(\?|$)|wedstrijd|reglement|cover_page|branding|analytics/i.test(u);

      const scanForPdf = async () => {
        const html = await page.content();
        const pm = html.match(PDF_RE);
        if (pm) {
          const url = pm[0].replace(/&amp;/g, '&');
          if (!request.userData.pdfUrls.includes(url)) request.userData.pdfUrls.push(url);
          return true;
        }
        return false;
      };

      // 1) Direct PDF URL already present on the retailer page?
      if (!(await scanForPdf())) {
        // 2) Locate a real folder-viewer URL (skip images / contest docs).
        let embedSrc = await page.evaluate(() => {
          const el = document.querySelector(
            'iframe[src*="publitas"],iframe[src*="ipaper"],a[href*="publitas"],a[href*="ipaper"]',
          );
          return el ? el.src || el.href || null : null;
        });
        if (!embedSrc || isJunk(embedSrc)) {
          const html = await page.content();
          const cands = [...html.matchAll(VIEWER_RE)].map((m) => m[0]).filter((u) => !isJunk(u));
          embedSrc =
            cands.find((u) => /\/page\/|\/w\d|\/nl-folder|\/weekactie|\/folder|\/bonus/i.test(u)) ||
            cands[0] ||
            null;
        }
        if (embedSrc) {
          embedSrc = (embedSrc.startsWith('http') ? embedSrc : `https://${embedSrc}`).replace(/&amp;/g, '&');
          log.info(`[${retailer.slug}] opening embed ${embedSrc.slice(0, 90)}`);
          try {
            await page.goto(embedSrc, { waitUntil: 'domcontentloaded', timeout: 60000 });
            await page.waitForNetworkIdle({ idleTime: 2000, timeout: 25000 }).catch(() => {});
            await scanForPdf(); // viewer HTML embeds the /pdfs/ URL
            request.userData.viewerUrl = embedSrc;
            // Scroll through the viewer to trigger lazy-loaded full-size page images.
            for (let i = 0; i < 30; i++) {
              await page.evaluate(() => window.scrollBy(0, window.innerHeight));
              await new Promise((r) => setTimeout(r, 450));
            }
            await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
            await page.waitForNetworkIdle({ idleTime: 1500, timeout: 20000 }).catch(() => {});
          } catch (e) {
            log.warning(`[${retailer.slug}] embed nav failed: ${e.message}`);
          }
        }
      }
    }

    const validFrom = scrapedAt.slice(0, 10);
    const pdfUrl = (request.userData.pdfUrls || [])[0];
    let deals = [];
    let method = 'page-text';

    if (pdfUrl) {
      log.info(`[${retailer.slug}] PDF found: ${pdfUrl.slice(0, 90)}`);
      deals = await extractDealsFromPdf(pdfUrl, {
        retailerSlug: retailer.slug,
        validFrom,
        validUntil: undefined,
      });
      method = 'pdf';
    }
    if (!deals.length) {
      const text = await page.evaluate(() => document.body?.innerText || '');
      deals = extractDeals(text, { retailerSlug: retailer.slug, validFrom, validUntil: undefined });
      method = pdfUrl ? 'pdf-empty→text' : 'page-text';
    }
    deals = deals.map((d) => ({ ...d, scrapedAt }));

    // The folder PAGES (what the site renders) — full-size Publitas page images.
    const pages = buildPages(request.userData.imageUrls || []);

    // Only fall back to the next URL if we found NO content at all (no pages,
    // no PDF, no deals).
    if (deals.length === 0 && pages.length === 0 && !pdfUrl && fallbacks.length) {
      log.warning(`[${retailer.slug}] no content here, trying fallback`);
      await crawler.addRequests([
        { url: fallbacks[0], userData: { retailer, fallbacks: fallbacks.slice(1) } },
      ]);
      return;
    }

    const validUntil = new Date(Date.now() + 6 * 86400000).toISOString().slice(0, 10);
    const folder = {
      id: `${retailer.slug}-${isoWeek}-folder`,
      retailerSlug: retailer.slug,
      title: `${retailer.name} folder van de week`,
      validFrom,
      validUntil,
      pageCount: pages.length,
      thumbnailUrl: pages[0]?.imageUrl,
      pages,
      sourceUrl: request.url,
      embedUrl: request.userData.viewerUrl || undefined,
      pdfUrl: pdfUrl || undefined,
      contentSource: pages.length ? 'publitas' : pdfUrl ? 'pdf' : 'page-text',
      scrapedAt,
    };

    await Dataset.pushData({
      retailer: retailer.slug,
      method,
      pageCount: pages.length,
      pdfUrl: pdfUrl || null,
      dealCount: deals.length,
      folder,
      deals,
    });
    log.info(`[${retailer.slug}] ${pages.length} pages, ${deals.length} deals (${method})`);

    if (airtable && deals.length) {
      try {
        const folderRecId = await airtable.upsertFolder(folder);
        await airtable.createDeals(deals, folderRecId);
        log.info(`[${retailer.slug}] pushed ${deals.length} deals to Airtable`);
      } catch (err) {
        log.error(`[${retailer.slug}] Airtable push failed: ${err.message}`);
      }
    }
  },
  async failedRequestHandler({ request, log }) {
    log.error(`Gave up on ${request.url} after retries`);
  },
});

await crawler.run(requests);
await Actor.exit();
