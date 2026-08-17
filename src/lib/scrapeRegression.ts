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
 * A first version of this guard treated expiry as a blanket escape hatch, on the
 * reasoning that expired prices are worthless so fresh-and-thin beats
 * stale-and-rich. That was wrong in practice: the hatch opens at every week
 * boundary, which is exactly when re-scrapes run, and it let colruyt's 50 priced
 * deals be replaced by 4. Recency does not by itself make a run trustworthy, so
 * a collapse is now refused whether or not the stored folder has expired --
 * `staleness` only changes how the refusal reads, so an operator can tell
 * "protecting live data" from "stored data is stale and this needs a look".
 */
export function findScrapeRegression(
  existing: ScrapedData | null,
  next: ScrapedData,
  now: Date = new Date(),
): string | null {
  if (!existing) return null;

  const staleness = isStoredDataExpired(existing, now)
    ? " (stored data has expired and still needs a good run)"
    : "";

  const wasPriced = pricedCount(existing);
  const nowPriced = pricedCount(next);

  if (wasPriced > 0 && nowPriced === 0) {
    return `would lose all ${wasPriced} priced deal(s)${staleness}`;
  }
  if (wasPriced > 0 && nowPriced < wasPriced * COLLAPSE_RATIO) {
    return `priced deals would fall from ${wasPriced} to ${nowPriced}${staleness}`;
  }

  const wasPages = pageCount(existing);
  const nowPages = pageCount(next);

  if (wasPages > 0 && nowPages < wasPages * COLLAPSE_RATIO) {
    return `page images would fall from ${wasPages} to ${nowPages}${staleness}`;
  }

  return null;
}
