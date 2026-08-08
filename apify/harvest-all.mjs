#!/usr/bin/env node
// Apify-free batch harvester for all Publitas-hosted retailers.
//
// For each retailer it tries an ordered list of candidate viewer URLs:
//   1. deterministic weekly-slug patterns for the current + next ISO week
//   2. the Publitas account root, which 302-redirects to the latest publication
// The first candidate that returns a manifest WITH a public PDF is written to
// ../data/folders/<slug>.json in the exact ScrapedData shape the site expects.
//
// Run:  NODE_TLS_REJECT_UNAUTHORIZED=0 node harvest-all.mjs [slug ...]
// (no args = all). This machine is behind a cert-intercepting proxy, hence the
// NODE_TLS env var.

import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { extractManifest, buildScrapedData, pdfUrlFromManifest, preserveRenderedPages, readExistingFolder } from './harvest-publitas.mjs';
import { harvestIssuu } from './harvest-issuu.mjs';

const UA = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36',
  'Accept-Language': 'nl-BE,nl;q=0.9',
};
const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = resolve(__dirname, '..', 'data', 'folders');

function isoWeekYear(d = new Date()) {
  const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const day = (t.getUTCDay() + 6) % 7;
  t.setUTCDate(t.getUTCDate() - day + 3);
  const firstThu = new Date(Date.UTC(t.getUTCFullYear(), 0, 4));
  const week = 1 + Math.round(((t - firstThu) / 86400000 - 3 + ((firstThu.getUTCDay() + 6) % 7)) / 7);
  return { week, year: t.getUTCFullYear() };
}
const pad = (n) => String(n).padStart(2, '0');

// Build current + next week tokens.
const cur = isoWeekYear();
const next = isoWeekYear(new Date(Date.now() + 7 * 86400000));
const WEEKS = [cur, next]; // try current first, then next

// retailer → ordered candidate URL builders. `account` (optional) appends the
// account-root redirect as a final fallback.
const RETAILERS = {
  // already-live grocery — refresh to current week
  'albert-heijn': { account: 'ah', tpl: (w, y) => `https://view.publitas.com/ah/bonus-week-${w}-${y}/page/1` },
  action: { account: 'action-benl', tpl: (w, y) => `https://view.publitas.com/action-benl/action-week-${w}-${y}/page/1` },
  jumbo: { account: 'jumbo-supermarkten', tpl: (w) => `https://view.publitas.com/jumbo-supermarkten/jumbo-actiefolder-week-${w}/page/1` },
  // batch 2 — DIY / garden / general / grocery
  hubo: { account: 'hubo-belgie-vl', tpl: (w, y) => `https://view.publitas.com/hubo-belgie-vl/${String(y).slice(2)}${w}_nl/page/1` },
  gamma: { account: 'gamma', tpl: (w, y) => `https://view.publitas.com/gamma/gamma-week-${w}-${y}/page/1` },
  intratuin: { account: 'intratuin-nl', tpl: (w, y) => `https://view.publitas.com/intratuin-nl/folder-week-${w}-${y}-nl-dyn/page/1` },
  boni: { account: 'boni-supermarkt', tpl: (w, y) => `https://view.publitas.com/boni-supermarkt/boni-folder-week-${w}-${y}/page/1` },
  plus: { account: 'plus-folder-nl', tpl: (w, y) => `https://view.publitas.com/plus-folder-nl/plus-week-${w}-${y}/page/1` },
  'mr-bricolage': { account: 'mr-bricolage' }, // period slug → rely on account-root redirect
  aveve: { account: 'aveve' },
  cora: { account: 'cora' },
  blokker: { account: ['blokker', 'de-blokker-folder', 'de-blokker-folder-kiosk-be-vl'], tpl: (w, y) => `https://view.publitas.com/blokker/blokker-folder-week-${w}-${y}/page/1` },
  // batch 3 — discovered via account-root probe (discover-accounts.mjs)
  spar: { account: 'spar' },
  hoogvliet: { account: 'hoogvliet', tpl: (w, y) => `https://view.publitas.com/hoogvliet/folder_${y}_${w}/page/1` },
  xenos: { account: 'xenos' },
  hornbach: { account: 'hornbach-nl' },
  welkoop: { account: 'welkoop', tpl: (w, y) => `https://view.publitas.com/welkoop/welkoop-week-${w}-${y}/page/1` },
  e5: { account: 'e5-mode' },
  // batch 4
  brico: { account: 'brico-folder-extra-nl' },
  bauhaus: { account: 'bauhaus-nederland' },
  gifi: { account: 'gifi' },
  alvo: { account: 'alvo' },
  'supra-bazar': { account: 'suprabazar' },
  // Lidl runs a white-labeled Publitas on folder-nl.lidl.be with a date-range
  // slug (nl-folder-DD-MM-DD-MM). No account root; generate plausible ranges for
  // the current week (Mon–Sat main + Thu–Wed non-food) and harvest the first hit.
  lidl: { urls: () => lidlSlugs() },
};

// dd-mm for a Date
const dm = (d) => `${pad(d.getUTCDate())}-${pad(d.getUTCMonth() + 1)}`;
function lidlSlugs() {
  const now = new Date();
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const ranges = [];
  for (const offset of [-7, 0, 7]) {
    const base = new Date(today + offset * 86400000);
    const dow = (base.getUTCDay() + 6) % 7; // 0=Mon
    const mon = new Date(base.getTime() - dow * 86400000);
    const mk = (startDow, len) => {
      const s = new Date(mon.getTime() + startDow * 86400000);
      const e = new Date(s.getTime() + len * 86400000);
      return { s, e };
    };
    ranges.push(mk(0, 5)); // Mon–Sat (main)
    ranges.push(mk(3, 6)); // Thu–Wed (non-food)
  }
  // Drop ranges that already ended; prefer the one covering today, then soonest.
  return ranges
    .filter((r) => r.e.getTime() >= today - 86400000)
    .sort((a, b) => {
      const aCov = a.s.getTime() <= today && today <= a.e.getTime() ? 0 : 1;
      const bCov = b.s.getTime() <= today && today <= b.e.getTime() ? 0 : 1;
      return aCov - bCov || a.s - b.s;
    })
    .map((r) => `https://folder-nl.lidl.be/nl-folder-${dm(r.s)}-${dm(r.e)}`)
    .filter((u, i, a) => a.indexOf(u) === i);
}

async function tryUrl(url) {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), 20000);
  try {
    const r = await fetch(url, { headers: UA, redirect: 'follow', signal: ac.signal });
    clearTimeout(t);
    if (r.status !== 200) return { ok: false, status: r.status };
    const html = await r.text();
    const manifest = extractManifest(html);
    if (!manifest) return { ok: false, status: 'no-manifest' };
    const pdf = pdfUrlFromManifest(manifest);
    return { ok: !!pdf, manifest, html, finalUrl: r.url, status: pdf ? 200 : 'no-pdf' };
  } catch (e) {
    clearTimeout(t);
    return { ok: false, status: e.name === 'AbortError' ? 'timeout' : e.message };
  }
}

async function harvest(slug, cfg) {
  const candidates = [];
  if (cfg.tpl) for (const { week, year } of WEEKS) candidates.push(cfg.tpl(pad(week), year));
  if (cfg.urls) candidates.push(...cfg.urls());
  for (const acct of [].concat(cfg.account || [])) candidates.push(`https://view.publitas.com/${acct}`);

  for (const url of candidates) {
    const res = await tryUrl(url);
    if (res.ok) {
      const outPath = resolve(OUT_DIR, `${slug}.json`);
      // A harvest must never delete page images rendered from the PDF: it
      // cannot produce them itself, and overwriting wholesale emptied 14
      // retailers' folders twice a day.
      const data = preserveRenderedPages(
        readExistingFolder(outPath),
        buildScrapedData(res.manifest, slug, res.finalUrl, res.html),
      );
      writeFileSync(outPath, JSON.stringify(data, null, 2));
      const f = data.folders[0];
      return { slug, ok: true, via: url.replace('https://view.publitas.com/', ''), title: f.title, pages: f.pageCount };
    }
  }
  return { slug, ok: false, tried: candidates.length };
}

// Issuu-hosted retailers (rolling doc slug → always the current folder).
const ISSUU = {
  colruyt: 'https://issuu.com/colruytgroup/docs/_colruyt_laagste_prijzen_-_folder',
};

const want = process.argv.slice(2);
const entries = Object.entries(RETAILERS).filter(([s]) => !want.length || want.includes(s));
const issuuEntries = Object.entries(ISSUU).filter(([s]) => !want.length || want.includes(s));
console.log(`ISO week ${cur.week}/${cur.year} (also trying ${next.week}/${next.year}) — ${entries.length} Publitas + ${issuuEntries.length} Issuu\n`);
const results = [];
for (const [slug, cfg] of entries) {
  const r = await harvest(slug, cfg);
  results.push(r);
  console.log(r.ok ? `✓ ${slug.padEnd(14)} ${r.pages}p  ${r.title}  [${r.via}]` : `✗ ${slug.padEnd(14)} no PDF (${r.tried} tried)`);
}
for (const [slug, docUrl] of issuuEntries) {
  try {
    const outPath = resolve(OUT_DIR, `${slug}.json`);
    const data = preserveRenderedPages(
      readExistingFolder(outPath),
      await harvestIssuu(docUrl, slug),
    );
    writeFileSync(outPath, JSON.stringify(data, null, 2));
    const f = data.folders[0];
    results.push({ slug, ok: true });
    console.log(`✓ ${slug.padEnd(14)} ${f.pageCount}p  ${f.title}  [issuu]`);
  } catch (e) {
    results.push({ slug, ok: false });
    console.log(`✗ ${slug.padEnd(14)} issuu failed: ${e.message}`);
  }
}
const live = results.filter((r) => r.ok).map((r) => r.slug);
console.log(`\n${live.length}/${results.length} harvested: ${live.join(', ')}`);
