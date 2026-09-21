// ---------------------------------------------------------------------------
// Folders published through WePublish (wepublish.com).
//
// WePublish is the folder-publishing platform several Belgian retailers use,
// the way others use Publitas. Its viewer serves each folder's full PDF at
//   https://api.wepublish.digital/viewer/pdf/download/<slug>
// and answers HTTP 500 for a slug that doesn't exist, so a folder is found by
// trying the slugs the retailer's naming scheme allows for the weeks around
// today. This is the only source we have for Carrefour: carrefour.be sits
// behind a bot challenge, and we don't work around those.
//
// The PDFs are image-only (no text layer), so validity comes from the slug's
// first week, the retailer's folder day and its folder length, each checked
// against dates printed on real covers (2026-09-21):
//   Carrefour  "van woensdag 23 september t.e.m. maandag 5 oktober"  Wed, 13 days
//   Kruidvat   "geldig van dinsdag 22 september t/m zondag 4 oktober" Tue, 13 days
//   Delhaize   "donderdag 17/09 > woensdag 23/09"                     Thu,  7 days
// Carrefour's slug carries no language, and the edition it serves varies:
// week 38-40 was the French "Hypermarchés" folder, week 39-41 the Dutch
// "Hypermarkten" one. No other slug for 38-40 exists, so that week shows in
// French. Everything else, including skipping ended and far-future folders,
// is shared with the Publitas harvest.
// ---------------------------------------------------------------------------

const DAY = 86400000;
const WEEKDAY = { zondag: 0, maandag: 1, dinsdag: 2, woensdag: 3, donderdag: 4, vrijdag: 5, zaterdag: 6 };

export const WEPUBLISH_BASE = 'https://api.wepublish.digital/viewer/pdf/download/';

/**
 * retailer → slug patterns ({w} week, {w2} end week, {y} year) and the
 * weekday its folders start on. `span` is the week distance a range slug
 * covers ({w2} = {w} + span).
 */
export const WEPUBLISH = {
  carrefour: { name: 'Carrefour', patterns: ['carrefour-week-{w}-{w2}-{y}'], span: 2, folderDay: 'woensdag', days: 13 },
  delhaize: { name: 'Delhaize', patterns: ['delhaize-benl-week-{w}-{y}'], span: 0, folderDay: 'donderdag', days: 7 },
  kruidvat: { name: 'Kruidvat', patterns: ['kruidvat-benl-week-{w}-{y}'], span: 0, folderDay: 'dinsdag', days: 13 },
};

function isoWeek(d) {
  const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  t.setUTCDate(t.getUTCDate() + 4 - (t.getUTCDay() || 7));
  const y = t.getUTCFullYear();
  return { week: Math.ceil(((t - Date.UTC(y, 0, 1)) / DAY + 1) / 7), year: y };
}

function isoWeekMonday(year, week) {
  const jan4 = new Date(Date.UTC(year, 0, 4));
  return new Date(jan4.getTime() - ((jan4.getUTCDay() + 6) % 7) * DAY + (week - 1) * 7 * DAY);
}

/** Slugs to try: every pattern for the weeks from two back to one ahead. */
export function candidateSlugs(cfg, today = new Date()) {
  const out = [];
  for (let offset = -2; offset <= 1; offset++) {
    const { week, year } = isoWeek(new Date(today.getTime() + offset * 7 * DAY));
    for (const p of cfg.patterns) {
      out.push(p.replace('{w}', String(week)).replace('{w2}', String(week + cfg.span)).replace('{y}', String(year)));
    }
  }
  return [...new Set(out)];
}

/** Validity of a slug: from its first week's folder day, lasting `days` days. */
export function validityFromSlug(slug, folderDay, days = 7) {
  const m = slug.match(/week-(\d{1,2})(?:-(\d{1,2}))?-(20\d\d)$/);
  if (!m) return null;
  const w1 = Number(m[1]);
  const year = Number(m[3]);
  const startDow = WEEKDAY[folderDay] ?? 1;
  const from = new Date(isoWeekMonday(year, w1).getTime() + ((startDow + 6) % 7) * DAY);
  const until = new Date(from.getTime() + (days - 1) * DAY);
  return { from: from.toISOString().slice(0, 10), until: until.toISOString().slice(0, 10), basis: 'slug + folder day' };
}

/** "16/09" from "2026-09-16". */
const dm = (iso) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;

export function wepublishFolder(retailerSlug, slug, validity, name = retailerSlug, nowIso = new Date().toISOString()) {
  const pdfUrl = WEPUBLISH_BASE + slug;
  return {
    id: `${retailerSlug}-${slug}-folder`,
    retailerSlug,
    // The slug reads "carrefour-week-38-40-2026"; the site shows this title.
    title: `${name} folder ${dm(validity.from)} – ${dm(validity.until)}`,
    validFrom: validity.from,
    validUntil: validity.until,
    pageCount: 0,
    thumbnailUrl: '',
    pages: [], // image-only PDF; scripts/backfill-pdf-pages.mts renders them
    pdfUrl,
    contentSource: 'wepublish',
    scrapedAt: nowIso,
  };
}
