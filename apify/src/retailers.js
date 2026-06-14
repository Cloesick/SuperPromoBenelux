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
    viewerTemplate: 'https://view.publitas.com/ah/bonus-week-{WEEK}-{YYYY}/page/1',
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
    // Colruyt's folder lives on Issuu; this rolling slug serves the current one.
    viewerTemplate: 'https://issuu.com/colruytgroup/docs/_colruyt_laagste_prijzen_-_folder',
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
    // Action's Publitas publication (standard domain) for the current week.
    viewerTemplate: 'https://view.publitas.com/action-benl/action-week-{WEEK}-{YYYY}/page/1',
    folderUrls: [
      'https://www.action.com/nl-be/weekactie/',
      'https://www.action.com/nl-be/folder/',
    ],
    waitFor: 'body',
    active: true,
  },
  jumbo: {
    name: 'Jumbo',
    category: 'Grocery',
    // Jumbo (NL chain, 29 BE stores) publishes its weekly folder on Publitas.
    viewerTemplate: 'https://view.publitas.com/jumbo-supermarkten/jumbo-actiefolder-week-{WEEK}/page/1',
    folderUrls: ['https://www.jumbo.com/aanbiedingen/folder', 'https://www.jumbo.com/folder'],
    waitFor: 'body',
    active: true,
  },
  // --- Publitas batch 2: accounts confirmed via indexed view.publitas.com URLs
  // (June 2026). Only Hubo's weekly slug was validated against the CURRENT week
  // (2624_nl loads); the others use the historical week-{WW}-{YYYY} slug as a
  // fast-path hint. If that 404s, the actor self-heals by scraping the retailer's
  // folder landing page (see fallback logic in main.js) to find the live viewer.
  hubo: {
    name: 'Hubo',
    category: 'DIY',
    // Validated current: slug is {2-digit year}{2-digit week}_nl, e.g. 2624_nl.
    viewerTemplate: 'https://view.publitas.com/hubo-belgie-vl/{YY}{WEEK}_nl/page/1',
    folderUrls: ['https://www.hubo.be/nl/folders', 'https://www.hubo.be/nl/folder'],
    waitFor: 'body',
    active: true,
  },
  gamma: {
    name: 'Gamma',
    category: 'DIY',
    // e.g. gamma-24-week-2026
    viewerTemplate: 'https://view.publitas.com/gamma/gamma-{WEEK}-week-{YYYY}/page/1',
    folderUrls: ['https://www.gamma.be/nl/folder', 'https://www.gamma.be/nl/promoties'],
    waitFor: 'body',
    active: true,
  },
  blokker: {
    name: 'Blokker',
    category: 'General',
    // e.g. blokker-folder-week-24-2026
    viewerTemplate: 'https://view.publitas.com/blokker/blokker-folder-week-{WEEK}-{YYYY}/page/1',
    folderUrls: ['https://www.blokker.nl/folder', 'https://www.blokker.be/nl/folder'],
    waitFor: 'body',
    active: true,
  },
  intratuin: {
    name: 'Intratuin',
    category: 'Garden',
    // NL account; e.g. folder-week-24-2026-nl-dyn
    viewerTemplate: 'https://view.publitas.com/intratuin-nl/folder-week-{WEEK}-{YYYY}-nl-dyn/page/1',
    folderUrls: ['https://www.intratuin.nl/folder', 'https://www.intratuin.be/nl/folder'],
    waitFor: 'body',
    active: true,
  },
  boni: {
    name: 'Boni',
    category: 'Grocery',
    // e.g. boni-folder-week-24-2026
    viewerTemplate: 'https://view.publitas.com/boni-supermarkt/boni-folder-week-{WEEK}-{YYYY}/page/1',
    folderUrls: ['https://www.boni.nl/folder'],
    waitFor: 'body',
    active: true,
  },

  // --- Publitas batch 2b: account verified, but the slug is period-based
  // (campaign numbers / theme names), not a clean weekly pattern. Left inactive
  // until the actor harvests the current slug from the folder landing page.
  aveve: {
    name: 'Aveve',
    category: 'Garden',
    // Account 'aveve'; slugs like vl-p08_folder_tuin_2026 (period-numbered).
    folderUrls: ['https://www.aveve.be/folder', 'https://www.aveve.be/nl/folder'],
    waitFor: 'body',
    active: false,
  },
  brico: {
    name: 'Brico',
    category: 'DIY',
    // Account 'brico-folder-extra-nl'; slugs like brico-benl-f14-2024 (campaign #).
    folderUrls: ['https://www.brico.be/nl/folder', 'https://www.brico.be/nl/promoties'],
    waitFor: 'body',
    active: false,
  },
  'mr-bricolage': {
    name: 'Mr. Bricolage',
    category: 'DIY',
    // Account 'mr-bricolage'; slugs like folder-8-2026 (monthly folder number).
    folderUrls: ['https://www.mr-bricolage.be/nl/folder'],
    waitFor: 'body',
    active: false,
  },
  cora: {
    name: 'Cora',
    category: 'Grocery',
    // Account 'cora'; hypermarket, period-based slugs.
    folderUrls: ['https://www.cora.be/nl/folder'],
    waitFor: 'body',
    active: false,
  },
  'maxi-zoo': {
    name: 'Maxi Zoo',
    category: 'Pets',
    // Account 'maxi-zoo-nl' seen historically; confirm current slug at scrape time.
    folderUrls: ['https://www.maxizoo.be/nl/folder', 'https://www.maxizoo.nl/folder'],
    waitFor: 'body',
    active: false,
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
