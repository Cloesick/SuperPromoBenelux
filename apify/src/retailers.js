// Belgian retailers scraped for weekly promo folders.
// Mirrors the slugs used in src/scrapers/*.ts and data/folders/*.json so the
// Apify output drops straight into the existing site data model + Airtable.
//
// `folderUrls` are tried in order until one yields a folder/PDF/price-bearing page.
// `waitFor` is an optional CSS selector to await before extracting (JS-rendered pages).
// `active` mirrors the Airtable "Active" flag — electronics are staged but off by default.

export const RETAILERS = {
  'albert-heijn': {
    name: 'Albert Heijn',
    category: 'Grocery',
    // AH's folder page is a SPA that hides the Publitas viewer link, so navigate
    // straight to the current-week Publitas publication ({WEEK} = ISO week no.).
    viewerTemplate: 'https://view.publitas.com/ah/bonus-week-{WEEK}-2026/page/1',
    folderUrls: [
      'https://www.ah.be/bonus/folder',
      'https://www.ah.be/bonus',
    ],
    waitFor: 'main',
    active: true,
  },
  lidl: {
    name: 'Lidl',
    category: 'Grocery',
    folderUrls: [
      'https://www.lidl.be/nl/aanbiedingen',
      'https://www.lidl.be/c/nl-BE/folders-magazines/s10008101',
    ],
    waitFor: 'main',
    active: true,
  },
  delhaize: {
    name: 'Delhaize',
    category: 'Grocery',
    folderUrls: [
      'https://www.delhaize.be/nl/promoties',
      'https://www.delhaize.be/nl/folder',
    ],
    waitFor: 'body',
    active: true,
  },
  colruyt: {
    name: 'Colruyt',
    category: 'Grocery',
    folderUrls: [
      'https://www.colruyt.be/nl/promoties',
      'https://www.colruyt.be/nl/folders',
    ],
    waitFor: 'body',
    active: true,
  },
  aldi: {
    name: 'Aldi',
    category: 'Grocery',
    folderUrls: [
      'https://www.aldi.be/nl/onze-folders/folder-van-deze-week.html',
      'https://www.aldi.be/nl/onze-folders.html',
    ],
    waitFor: 'body',
    active: true,
  },
  action: {
    name: 'Action',
    category: 'General',
    folderUrls: [
      'https://www.action.com/nl-be/weekactie/',
      'https://www.action.com/nl-be/folder/',
    ],
    waitFor: 'body',
    active: true,
  },
  mediamarkt: {
    name: 'MediaMarkt',
    category: 'Electronics',
    folderUrls: ['https://www.mediamarkt.be/nl/promoties'],
    waitFor: 'body',
    active: false,
  },
  coolblue: {
    name: 'Coolblue',
    category: 'Electronics',
    folderUrls: ['https://www.coolblue.be/nl/aanbiedingen'],
    waitFor: 'body',
    active: false,
  },
};

export function resolveRetailers(requested) {
  const all = Object.entries(RETAILERS).map(([slug, cfg]) => ({ slug, ...cfg }));
  if (!requested || requested.length === 0) return all.filter((r) => r.active);
  const set = new Set(requested);
  return all.filter((r) => set.has(r.slug));
}
