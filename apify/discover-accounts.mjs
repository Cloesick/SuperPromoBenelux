#!/usr/bin/env node
// Probe candidate Publitas account slugs: each account root 302-redirects to its
// latest publication. Report which resolve to a manifest WITH a public PDF, so we
// can wire them into harvest-all.mjs / retailers.ts. Read-only discovery.
//
// Run: NODE_TLS_REJECT_UNAUTHORIZED=0 node discover-accounts.mjs
import { extractManifest, pdfUrlFromManifest } from './harvest-publitas.mjs';

const UA = { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/124 Safari/537.36', 'Accept-Language': 'nl-BE,nl;q=0.9' };

// retailer slug -> candidate account slugs
const CANDIDATES = {
  carrefour: ['carrefour-be', 'carrefourbelgium', 'carrefour-belgium', 'carrefour'],
  delhaize: ['delhaize', 'delhaize-be', 'delhaizebe'],
  spar: ['spar-be', 'spar', 'spar-nl'],
  okay: ['okay', 'okay-be'],
  'bio-planet': ['bio-planet', 'bioplanet'],
  dirk: ['dirk', 'dirk-van-den-broek', 'dirknl'],
  coop: ['coop-supermarkten', 'coop', 'coop-nl'],
  vomar: ['vomar', 'vomar-voordeelmarkt'],
  hoogvliet: ['hoogvliet', 'hoogvliet-supermarkten'],
  kruidvat: ['kruidvat', 'kruidvat-be', 'kruidvat-nl'],
  di: ['di-parfum', 'di-be', 'parfumerie-di'],
  'medi-market': ['medi-market', 'medimarket'],
  'tom-and-co': ['tom-co', 'tomandco', 'tom-and-co'],
  'maxi-zoo': ['maxi-zoo-nl', 'maxizoo', 'maxi-zoo-belgium', 'maxi-zoo-be'],
  'pets-place': ['pets-place', 'petsplace'],
  jumper: ['jumper', 'jumper-nl'],
  xenos: ['xenos', 'xenos-nl'],
  casa: ['casa-international', 'casa-be', 'casashops', 'casa'],
  'flying-tiger': ['flying-tiger', 'flying-tiger-copenhagen'],
  trafic: ['trafic', 'trafic-be'],
  zeeman: ['zeeman', 'zeeman-be'],
  wibra: ['wibra', 'wibra-be', 'wibra-nl'],
  'big-bazar': ['big-bazar', 'bigbazar'],
  krefel: ['krefel', 'krefel-be'],
  'vanden-borre': ['vandenborre', 'vanden-borre'],
  expert: ['expert-nl', 'expert', 'expert-be'],
  bcc: ['bcc', 'bcc-nl'],
  bauhaus: ['bauhaus-be', 'bauhaus', 'bauhaus-nl'],
  hornbach: ['hornbach-be', 'hornbach', 'hornbach-nl'],
  praxis: ['praxis', 'praxis-nl'],
  karwei: ['karwei', 'karwei-nl'],
  'brico-planit': ['brico-plan-it', 'planit', 'brico-planit'],
  horta: ['horta', 'horta-be'],
  welkoop: ['welkoop', 'welkoop-nl'],
  groenrijk: ['groenrijk'],
  veritas: ['veritas', 'veritas-be'],
  jbc: ['jbc', 'jbc-mode'],
  e5: ['e5-mode', 'e5'],
  blokker: ['blokker-folder', 'blokker-nl', 'deblokker'],
  intratuin: ['intratuin', 'intratuin-be'],
};

async function probe(account) {
  const url = `https://view.publitas.com/${account}`;
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), 15000);
  try {
    const r = await fetch(url, { headers: UA, redirect: 'follow', signal: ac.signal });
    clearTimeout(t);
    if (r.status !== 200) return { account, status: r.status };
    const html = await r.text();
    const m = extractManifest(html);
    if (!m) return { account, status: 'no-manifest' };
    const pdf = pdfUrlFromManifest(m);
    return {
      account,
      status: pdf ? 'PDF' : 'no-pdf',
      pages: m.numPages,
      title: m.config?.publicationTitle || m.groupTitle,
      resolved: r.url.replace('https://view.publitas.com/', ''),
    };
  } catch (e) {
    clearTimeout(t);
    return { account, status: e.name === 'AbortError' ? 'timeout' : 'err' };
  }
}

const hits = [];
for (const [slug, accts] of Object.entries(CANDIDATES)) {
  const results = await Promise.all(accts.map(probe));
  const win = results.find((r) => r.status === 'PDF');
  if (win) {
    hits.push({ slug, ...win });
    console.log(`✓ ${slug.padEnd(14)} acct=${win.account.padEnd(22)} ${win.pages}p  ${win.title}  [${win.resolved}]`);
  } else {
    const best = results.map((r) => `${r.account}:${r.status}`).join(' ');
    console.log(`· ${slug.padEnd(14)} ${best}`);
  }
}
console.log(`\nHITS (${hits.length}):`, hits.map((h) => `${h.slug}=${h.account}`).join(', '));
