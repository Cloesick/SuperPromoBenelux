// SuperPromo folder scraper — Apify actor entry point.
//
// Flow per retailer:
//   1. Visit folderUrls (Puppeteer + Apify proxy) until one renders.
//   2. Pull full page text + any linked PDF text.
//   3. Extract structured deals (extractDeals.js).
//   4. Push a Folder row + its Deals to Airtable, and to the Apify dataset
//      (so the site can also pull JSON straight from the run).
//
// Designed to REPLACE the local `npm run scrape` (Puppeteer on your machine)
// with a scheduled, proxied, cloud run. Per-retailer DOM selectors can be
// tuned over time; the price-pattern extractor gives a working baseline.

import { Actor } from 'apify';
import { PuppeteerCrawler, Dataset } from 'crawlee';
import { resolveRetailers } from './retailers.js';
import { extractDeals } from './extractDeals.js';
import { Airtable } from './airtable.js';

await Actor.init();

const input = (await Actor.getInput()) || {};
const {
  retailers: requested = [],
  pushToAirtable = true,
  airtableToken = process.env.AIRTABLE_TOKEN,
  airtableBaseId = process.env.AIRTABLE_BASE || 'appILxwPpKEWomToC',
  proxyConfiguration: proxyInput,
  maxPagesPerRetailer = 3,
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
  pushToAirtable && airtableToken
    ? new Airtable({ token: airtableToken, baseId: airtableBaseId })
    : null;
if (pushToAirtable && !airtable) {
  Actor.log.warning('pushToAirtable is on but no AIRTABLE_TOKEN — dataset only.');
}

const proxyConfiguration = await Actor.createProxyConfiguration(
  proxyInput || { groups: ['RESIDENTIAL'], countryCode: 'BE' },
);

// Build the start list: first folderUrl per retailer, with the rest as fallbacks.
const requests = targets.map((r) => ({
  url: r.folderUrls[0],
  userData: { retailer: r, fallbacks: r.folderUrls.slice(1) },
}));

const crawler = new PuppeteerCrawler({
  proxyConfiguration,
  maxRequestRetries: 2,
  navigationTimeoutSecs: 90,
  requestHandlerTimeoutSecs: 150,
  launchContext: { launchOptions: { args: ['--no-sandbox'] } },
  // Retail pages are tracker-heavy and rarely reach `load`/`networkidle`.
  // Navigate on `domcontentloaded`; the per-retailer waitForSelector below
  // then waits for the real content to render.
  preNavigationHooks: [
    async (_ctx, gotoOptions) => {
      gotoOptions.waitUntil = 'domcontentloaded';
      gotoOptions.timeout = 75000;
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

    const text = await page.evaluate(() => document.body?.innerText || '');

    const deals = extractDeals(text, {
      retailerSlug: retailer.slug,
      validFrom: scrapedAt.slice(0, 10),
      validUntil: undefined,
    }).map((d) => ({ ...d, scrapedAt }));

    if (deals.length === 0 && fallbacks.length) {
      log.warning(`[${retailer.slug}] no deals here, trying fallback`);
      await crawler.addRequests([
        { url: fallbacks[0], userData: { retailer, fallbacks: fallbacks.slice(1) } },
      ]);
      return;
    }

    const folder = {
      id: `${retailer.slug}-${isoWeek}-folder`,
      retailerSlug: retailer.slug,
      title: `${retailer.name} folder van de week`,
      validFrom: scrapedAt.slice(0, 10),
      validUntil: undefined,
      pageCount: undefined,
      thumbnailUrl: undefined,
      sourceUrl: request.url,
      scrapedAt,
    };

    await Dataset.pushData({ retailer: retailer.slug, folder, dealCount: deals.length, deals });
    log.info(`[${retailer.slug}] extracted ${deals.length} deals`);

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
