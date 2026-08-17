import { describe, expect, it } from "vitest";
import { findScrapeRegression } from "./scrapeRegression";
import type { ScrapedData } from "./types";

function data(opts: {
  deals?: { priced: number; unpriced?: number };
  pages?: number;
  validUntil?: string;
}): ScrapedData {
  const priced = opts.deals?.priced ?? 0;
  const unpriced = opts.deals?.unpriced ?? 0;
  const deals = [
    ...Array.from({ length: priced }, (_, i) => ({
      id: `p${i}`,
      product: `Product ${i}`,
      promoPrice: 1.99,
      validFrom: "2026-08-10",
      validUntil: opts.validUntil ?? "2026-12-31",
      retailerSlug: "test",
    })),
    ...Array.from({ length: unpriced }, (_, i) => ({
      id: `u${i}`,
      product: `Nameonly ${i}`,
      validFrom: "2026-08-10",
      validUntil: opts.validUntil ?? "2026-12-31",
      retailerSlug: "test",
    })),
  ];

  return {
    retailer: "test",
    deals,
    folders: [
      {
        id: "f1",
        retailerSlug: "test",
        title: "Folder",
        validFrom: "2026-08-10",
        validUntil: opts.validUntil ?? "2026-12-31",
        pageCount: opts.pages ?? 0,
        thumbnailUrl: "",
        pages: Array.from({ length: opts.pages ?? 0 }, (_, i) => ({
          pageNumber: i + 1,
          imageUrl: `p${i}.webp`,
          deals: [],
        })),
        contentSource: "publitas",
        scrapedAt: "2026-08-10T00:00:00Z",
      },
    ],
    scrapedAt: "2026-08-10T00:00:00Z",
    sourceUrls: [],
    methods: ["publitas"],
  } as unknown as ScrapedData;
}

const TODAY = new Date("2026-08-17T12:00:00Z");

// ---------------------------------------------------------------------------
// A single flaky run used to erase a good week. Colruyt held 50 priced deals,
// one run extracted 6, and the file was overwritten with 3 -- reported as a
// success. The only existing guard skipped the write when BOTH folders and deals
// were empty, so delhaize wrote 0 deals over 24 because it still had a folder.
//
// The tension: leaflets genuinely change weekly, so this must not freeze stale
// data forever. Expiry is the tiebreaker -- fresh data beats a dead folder even
// when it is thinner.
// ---------------------------------------------------------------------------

describe("findScrapeRegression", () => {
  it("allows the first scrape, with nothing to compare against", () => {
    expect(findScrapeRegression(null, data({ deals: { priced: 3 }, pages: 4 }), TODAY)).toBeNull();
  });

  it("allows a run that holds its ground", () => {
    const before = data({ deals: { priced: 50 }, pages: 10 });
    const after = data({ deals: { priced: 48 }, pages: 10 });
    expect(findScrapeRegression(before, after, TODAY)).toBeNull();
  });

  it("allows a run that improves", () => {
    const before = data({ deals: { priced: 4 }, pages: 20 });
    const after = data({ deals: { priced: 30 }, pages: 20 });
    expect(findScrapeRegression(before, after, TODAY)).toBeNull();
  });

  it("blocks losing every price when prices existed", () => {
    // Delhaize: 24 deals with 4 priced, overwritten by 0.
    const before = data({ deals: { priced: 4, unpriced: 20 }, pages: 20 });
    const after = data({ deals: { priced: 0 }, pages: 0 });
    expect(findScrapeRegression(before, after, TODAY)).toMatch(/priced/i);
  });

  it("blocks a collapse in priced deals", () => {
    // Colruyt: 50 priced overwritten by 3.
    const before = data({ deals: { priced: 50 }, pages: 10 });
    const after = data({ deals: { priced: 3 }, pages: 10 });
    expect(findScrapeRegression(before, after, TODAY)).toMatch(/priced/i);
  });

  it("blocks losing most of the page images", () => {
    // Pages are what the folder viewer renders; losing them empties the page
    // even when deal counts look acceptable.
    const before = data({ deals: { priced: 5 }, pages: 20 });
    const after = data({ deals: { priced: 5 }, pages: 2 });
    expect(findScrapeRegression(before, after, TODAY)).toMatch(/page/i);
  });

  it("still blocks a collapse when the stored folder has expired", () => {
    // The first version of this guard let expiry wave everything through, on the
    // reasoning that expired prices are worthless. The hatch opens at every week
    // boundary -- exactly when re-scrapes run -- and colruyt's 50 priced deals
    // were replaced by 4. Recency alone does not make a run trustworthy.
    const before = data({ deals: { priced: 50 }, pages: 10, validUntil: "2026-08-09" });
    const after = data({ deals: { priced: 4 }, pages: 10 });
    expect(findScrapeRegression(before, after, TODAY)).toMatch(/priced/i);
  });

  it("says so in the reason when the stored data is expired", () => {
    // An operator needs to tell "protecting live data" from "stale data that
    // still needs a good run", because the second one wants attention.
    const before = data({ deals: { priced: 50 }, pages: 10, validUntil: "2026-08-09" });
    const after = data({ deals: { priced: 4 }, pages: 10 });
    expect(findScrapeRegression(before, after, TODAY)).toMatch(/expired/i);
  });

  it("allows a healthy fresh run to replace expired data", () => {
    // Tightening must not freeze stale data: a run that holds its ground still
    // replaces an expired folder.
    const before = data({ deals: { priced: 50 }, pages: 10, validUntil: "2026-08-09" });
    const after = data({ deals: { priced: 45 }, pages: 12 });
    expect(findScrapeRegression(before, after, TODAY)).toBeNull();
  });

  it("tolerates ordinary week-to-week variation", () => {
    // Half is the line. A 40% drop is a normal quieter week, not a failure.
    const before = data({ deals: { priced: 20 }, pages: 10 });
    const after = data({ deals: { priced: 12 }, pages: 10 });
    expect(findScrapeRegression(before, after, TODAY)).toBeNull();
  });
});
