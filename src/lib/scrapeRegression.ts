import type { Deal, ScrapedData } from "./types";

/* Below half of what is already stored, a run is treated as a failure rather
 * than a quiet week. Leaflets genuinely vary, so the line has to be loose enough
 * to let a thin week through -- the cases this exists to stop were 50 priced
 * deals replaced by 3, and 24 deals replaced by 0. */
const COLLAPSE_RATIO = 0.5;

/* Deals live at the top level of ScrapedData, but older files carried them
 * per-page instead, so fall back to the pages rather than reporting zero and
 * blocking every write against a legacy file. */
function allDeals(data: ScrapedData): Deal[] {
  const top = data.deals ?? [];
  if (top.length > 0) return top;
  return (data.folders ?? []).flatMap((f) =>
    (f.pages ?? []).flatMap((p) => p.deals ?? []),
  );
}

function pricedCount(data: ScrapedData): number {
  return allDeals(data).filter((d) => d.promoPrice != null).length;
}

function pageCount(data: ScrapedData): number {
  return (data.folders ?? []).reduce((n, f) => n + (f.pages?.length ?? 0), 0);
}

/** True when every stored folder has already stopped being valid. */
function isStoredDataExpired(data: ScrapedData, now: Date): boolean {
  const folders = data.folders ?? [];
  if (folders.length === 0) return true;
  return folders.every((f) => {
    if (!f.validUntil) return false;
    const until = new Date(f.validUntil);
    if (Number.isNaN(until.getTime())) return false;
    return until < now;
  });
}

/**
 * Decide whether a fresh scrape would lose materially more than it gains.
 *
 * Returns a human-readable reason to refuse the write, or null to allow it.
 *
 * The scraper's only previous guard skipped the write when folders *and* deals
 * were both empty. That let a run with one folder and zero deals overwrite a
 * file holding 24 deals and 20 page images, and reported success -- so a single
 * flaky run silently erased a good week.
 *
 * Expiry is the deliberate escape hatch: once the stored folder is out of date,
 * a thin fresh scrape is better than serving last month's prices, so nothing is
 * blocked. Guarding data integrity must not mean freezing stale data in place.
 */
export function findScrapeRegression(
  existing: ScrapedData | null,
  next: ScrapedData,
  now: Date = new Date(),
): string | null {
  if (!existing) return null;
  if (isStoredDataExpired(existing, now)) return null;

  const wasPriced = pricedCount(existing);
  const nowPriced = pricedCount(next);

  if (wasPriced > 0 && nowPriced === 0) {
    return `would lose all ${wasPriced} priced deal(s)`;
  }
  if (wasPriced > 0 && nowPriced < wasPriced * COLLAPSE_RATIO) {
    return `priced deals would fall from ${wasPriced} to ${nowPriced}`;
  }

  const wasPages = pageCount(existing);
  const nowPages = pageCount(next);

  if (wasPages > 0 && nowPages < wasPages * COLLAPSE_RATIO) {
    return `page images would fall from ${wasPages} to ${nowPages}`;
  }

  return null;
}
