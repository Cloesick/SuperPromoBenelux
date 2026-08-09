#!/usr/bin/env tsx
// ---------------------------------------------------------------------------
// Find the real leaflet for retailers we are only screenshotting.
//
// Twenty retailers render `contentSource: screenshot` — a photograph of a promo
// web page rather than a folder. Some are 8x taller than they are wide, which
// is a scrolling page, not a leaflet. Every retailer that renders *well* comes
// from publitas, ipaper or issuu instead.
//
// So the question per retailer is: does a real leaflet platform exist behind
// their site, and at what URL? That is what this reports. It changes nothing —
// the output is a list to wire into scraper configs by hand, because a wrong
// guess here silently replaces a working folder with someone's terms page.
//
//   npx tsx scripts/discover-folder-sources.mts [--only a,b,c]
//
// For each retailer it opens the official site, follows the links a shopper
// would follow, and reports any leaflet-platform URL it lands on — including
// white-label hosts (folder.<retailer>.be) whose root redirects to the issue.
// ---------------------------------------------------------------------------

import fs from "fs";
import puppeteer, { type Page } from "rebrowser-puppeteer";
import { allRetailers } from "../src/lib/retailers";

/** Hosts that serve a real leaflet, as opposed to a marketing page. */
const LEAFLET_HOST =
  /publitas\.com|ipaper(?:cms)?\.dk|issuu\.com|yumpu\.com|flippingbook|flipsnack|calameo|joomag|paperturn|readz|zmags/i;

/** A retailer-branded viewer host: folder.gamma.be, flyer.maxizoo.be, … */
const WHITE_LABEL = /^(?:folder|folders|flyer|flyers|leaflet|prospectus|depliant|catalogus|catalogue)\./i;

const args = process.argv.slice(2);
const only = args.includes("--only")
  ? new Set((args[args.indexOf("--only") + 1] ?? "").split(",").filter(Boolean))
  : null;

interface Finding {
  slug: string;
  website: string;
  leafletUrls: string[];
  whiteLabel: string[];
  candidates: string[];
  note: string;
}

async function linksOn(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const wanted =
      /folder|flyer|reclame|aanbieding|promotie|promo|acties|weekaanbieding|depliant|prospectus|catalogus|magazine/i;
    const seen = new Set<string>();
    const out: string[] = [];
    for (const a of Array.from(document.querySelectorAll("a[href]"))) {
      const href = (a as HTMLAnchorElement).href;
      if (!href || !/^https?:/i.test(href)) continue;
      const text = (a.textContent ?? "").trim();
      if (!wanted.test(href) && !wanted.test(text)) continue;
      if (seen.has(href)) continue;
      seen.add(href);
      out.push(href);
    }
    return out.slice(0, 25);
  });
}

const hostOf = (u: string) => {
  try {
    return new URL(u).hostname;
  } catch {
    return "";
  }
};

const browser = await puppeteer.launch({
  headless: true,
  executablePath: process.env.PUPPETEER_EXECUTABLE_PATH,
  args: ["--no-sandbox", "--disable-dev-shm-usage"],
});

const targets = allRetailers.filter((r) => !only || only.has(r.slug));
const findings: Finding[] = [];

for (const retailer of targets) {
  const f: Finding = {
    slug: retailer.slug,
    website: retailer.website,
    leafletUrls: [],
    whiteLabel: [],
    candidates: [],
    note: "",
  };
  const page = await browser.newPage();
  page.setDefaultTimeout(30000);
  try {
    await page.goto(retailer.website, { waitUntil: "domcontentloaded", timeout: 40000 });
    await new Promise((r) => setTimeout(r, 2500));

    // Dismiss the consent wall, otherwise the page is one button.
    for (const sel of ["#onetrust-accept-btn-handler", "[id*='accept']", "[class*='accept']"]) {
      try {
        const el = await page.$(sel);
        if (el) {
          await el.click();
          await new Promise((r) => setTimeout(r, 800));
          break;
        }
      } catch {
        /* consent is optional */
      }
    }

    const links = await linksOn(page);
    f.candidates = links.slice(0, 6);
    f.leafletUrls.push(...links.filter((u) => LEAFLET_HOST.test(hostOf(u))));
    f.whiteLabel.push(...links.filter((u) => WHITE_LABEL.test(hostOf(u))));

    // Follow the two most promising links one hop: retailers usually put the
    // viewer behind a /folder landing page rather than linking it directly.
    const hops = [...f.whiteLabel, ...links.filter((u) => /folder|flyer|promotie|acties/i.test(u))].slice(0, 3);
    for (const hop of hops) {
      try {
        await page.goto(hop, { waitUntil: "domcontentloaded", timeout: 30000 });
        await new Promise((r) => setTimeout(r, 2000));
        const finalHost = hostOf(page.url());
        if (LEAFLET_HOST.test(finalHost) || WHITE_LABEL.test(finalHost)) f.leafletUrls.push(page.url());
        // An embedded viewer counts even when the address bar does not change.
        const frames = await page.evaluate(() =>
          Array.from(document.querySelectorAll("iframe[src]")).map((i) => (i as HTMLIFrameElement).src),
        );
        f.leafletUrls.push(...frames.filter((u) => LEAFLET_HOST.test(hostOf(u))));
        const deeper = await linksOn(page);
        f.leafletUrls.push(...deeper.filter((u) => LEAFLET_HOST.test(hostOf(u))));
        f.whiteLabel.push(...deeper.filter((u) => WHITE_LABEL.test(hostOf(u))));
      } catch {
        /* a dead hop is information too */
      }
    }
    f.leafletUrls = [...new Set(f.leafletUrls)];
    f.whiteLabel = [...new Set(f.whiteLabel)];
    if (!f.leafletUrls.length && !f.whiteLabel.length) f.note = "no leaflet platform found";
  } catch (err) {
    f.note = `failed: ${String(err).slice(0, 60)}`;
  } finally {
    await page.close().catch(() => {});
  }

  const verdict = f.leafletUrls.length ? "LEAFLET" : f.whiteLabel.length ? "viewer host" : "none";
  console.log(`${f.slug.padEnd(14)} ${verdict.padEnd(12)} ${f.leafletUrls[0] ?? f.whiteLabel[0] ?? f.note}`);
  findings.push(f);
}

await browser.close();
fs.writeFileSync("discovery.json", JSON.stringify(findings, null, 2));
console.log(`\n${findings.filter((f) => f.leafletUrls.length).length} of ${findings.length} have a real leaflet platform.`);
console.log("Full detail in discovery.json");
