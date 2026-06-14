#!/usr/bin/env node
// Apify-free Issuu folder harvester (companion to harvest-publitas.mjs).
//
// Issuu's oEmbed endpoint returns the publication title, validity description and
// a thumbnail URL that embeds the docId. Full-resolution page images live at the
// public CDN image.isu.pub/{docId}/jpg/page_{N}.jpg, so we can build a complete
// flipbook by enumerating pages until the CDN stops serving them — no Apify, no
// headless browser, no Issuu reader API (which 403s).
//
// Usage: NODE_TLS_REJECT_UNAUTHORIZED=0 node harvest-issuu.mjs <issuuDocUrl> --slug <slug>
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const UA = { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/124 Safari/537.36' };

export async function fetchOembed(docUrl) {
  const r = await fetch(`https://issuu.com/oembed?format=json&url=${encodeURIComponent(docUrl)}`, { headers: UA });
  if (r.status !== 200) return null;
  return r.json();
}

export function docIdFromThumb(thumbUrl) {
  const m = (thumbUrl || '').match(/image\.isu\.pub\/([0-9a-f-]{20,})\//i);
  return m ? m[1] : null;
}

// "vi1226 - Geldig van 3/6 t.e.m. 16/6/2026" → { from, until } ISO dates.
export function parseDates(desc) {
  const m = (desc || '').match(/(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\s*t\.?e\.?m\.?\s*(\d{1,2})\/(\d{1,2})\/(\d{2,4})/i);
  if (!m) return null;
  const yr = (y) => (y.length === 2 ? '20' + y : y);
  const untilY = yr(m[6]);
  const fromY = m[3] ? yr(m[3]) : untilY;
  const iso = (d, mo, y) => `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  return { from: iso(m[1], m[2], fromY), until: iso(m[4], m[5], untilY) };
}

async function pageOk(docId, n) {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), 12000);
  try {
    const r = await fetch(`https://image.isu.pub/${docId}/jpg/page_${n}.jpg`, { headers: UA, signal: ac.signal });
    clearTimeout(t);
    return r.status === 200;
  } catch {
    clearTimeout(t);
    return false;
  }
}

// Count pages by probing in batches; return the contiguous 200-prefix length.
export async function countPages(docId, cap = 100) {
  let count = 0;
  for (let start = 1; start <= cap; start += 10) {
    const batch = Array.from({ length: 10 }, (_, i) => start + i);
    const oks = await Promise.all(batch.map((n) => pageOk(docId, n)));
    const firstBad = oks.indexOf(false);
    if (firstBad === -1) count = start + 9;
    else { count = start + firstBad - 1; break; }
  }
  return count;
}

export async function harvestIssuu(docUrl, slug) {
  const o = await fetchOembed(docUrl);
  if (!o) throw new Error('oembed failed');
  const docId = docIdFromThumb(o.thumbnail_url);
  if (!docId) throw new Error('no docId in thumbnail');
  const n = await countPages(docId);
  if (!n) throw new Error('no pages');
  const dates = parseDates(o.description);
  const nowIso = new Date().toISOString();
  const validFrom = dates?.from || nowIso.slice(0, 10);
  const validUntil = dates?.until || new Date(Date.now() + 10 * 86400000).toISOString().slice(0, 10);
  const pages = Array.from({ length: n }, (_, i) => ({
    pageNumber: i + 1,
    imageUrl: `https://image.isu.pub/${docId}/jpg/page_${i + 1}.jpg`,
    deals: [],
  }));
  const embedUrl = (o.html.match(/src=\\?"(https:\/\/e\.issuu\.com\/embed\.html[^"\\]+)/) || [])[1] || docUrl;
  const folder = {
    id: `${slug}-${docId}-folder`,
    retailerSlug: slug,
    title: (o.title || `${slug} folder`).trim(),
    validFrom,
    validUntil,
    pageCount: n,
    thumbnailUrl: pages[0].imageUrl,
    pages,
    embedUrl,
    contentSource: 'issuu',
    scrapedAt: nowIso,
  };
  return { retailer: slug, folders: [folder], deals: [], scrapedAt: nowIso, sourceUrls: [docUrl], methods: ['issuu'] };
}

const isMain = process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url));
if (isMain) {
  const [docUrl, ...rest] = process.argv.slice(2);
  const slug = rest.indexOf('--slug') !== -1 ? rest[rest.indexOf('--slug') + 1] : null;
  if (!docUrl || !slug) { console.error('usage: harvest-issuu.mjs <docUrl> --slug <slug>'); process.exit(1); }
  const data = await harvestIssuu(docUrl, slug);
  const f = data.folders[0];
  console.log(`✓ ${slug}: ${f.pageCount}p  "${f.title}"  ${f.validFrom}→${f.validUntil}`);
  const out = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'data', 'folders', `${slug}.json`);
  writeFileSync(out, JSON.stringify(data, null, 2));
  console.log('wrote', out);
}
