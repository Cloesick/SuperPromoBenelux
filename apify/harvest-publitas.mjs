#!/usr/bin/env node
// Apify-free Publitas folder harvester.
//
// Publitas embeds the COMPLETE publication manifest inline in the viewer HTML as
// `var data = {...}` — including per-page image hashes and the available sizes.
// Page-image and PDF URLs on the Publitas CDN are public, so we can build the
// folder data with a plain HTTP fetch — no Puppeteer, no Apify, no quota.
//
// Usage:
//   node harvest-publitas.mjs <viewerUrl>                 # inspect: prints manifest summary + built page URLs
//   node harvest-publitas.mjs <viewerUrl> --slug <slug>   # write ../data/folders/<slug>.json
//
// TLS note: this machine sits behind a cert-intercepting proxy; callers set
// NODE_TLS_REJECT_UNAUTHORIZED=0 (see harvest-all.mjs).

import { writeFileSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36';

export async function fetchHtml(url) {
  const r = await fetch(url, { headers: { 'User-Agent': UA, 'Accept-Language': 'nl-BE,nl;q=0.9' } });
  return { status: r.status, html: r.status === 200 ? await r.text() : '' };
}

// Brace-match the inline `var data = {…}` JSON object.
export function extractManifest(html) {
  const start = html.indexOf('var data =');
  if (start === -1) return null;
  const i = html.indexOf('{', start);
  if (i === -1) return null;
  let depth = 0, inStr = false, esc = false;
  for (let j = i; j < html.length; j++) {
    const c = html[j];
    if (esc) { esc = false; continue; }
    if (c === '\\') { esc = true; continue; }
    if (c === '"') { inStr = !inStr; continue; }
    if (inStr) continue;
    if (c === '{') depth++;
    else if (c === '}') { depth--; if (depth === 0) { try { return JSON.parse(html.slice(i, j + 1)); } catch { return null; } } }
  }
  return null;
}

// The cover-page image is the one /pages/{hash}-at{size} URL present in static
// HTML (other pages lazy-load via signed requests). Use it as the folder
// thumbnail at a card-friendly size.
export function coverThumbnail(html, size = 800) {
  // Works for view.publitas.com AND white-labeled Publitas domains
  // (e.g. folder-nl.lidl.be) — match any host with the /{gid}/{pid}/pages/ shape.
  const m = html.match(/https?:\/\/[a-z0-9.-]+\/\d+\/\d+\/pages\/[0-9a-f-]{36}-at(\d+)\.(?:jpe?g|webp|png)/i);
  if (!m) return '';
  return m[0].replace(/-at\d+\./, `-at${size}.`);
}

// Public, complete PDF (query stripped so the browser renders it inline rather
// than forcing a download — matches how the live AH folder is stored).
export function pdfUrlFromManifest(manifest) {
  const raw = manifest.config?.downloadPdfUrl || manifest.pdfUrl || null;
  return raw ? raw.split('?')[0] : null;
}

// Produce a ScrapedData object matching src/lib/types.ts exactly.
export function buildScrapedData(manifest, slug, viewerUrl, html, opts = {}) {
  const nowIso = opts.nowIso || new Date().toISOString();
  const validDays = opts.validDays ?? 10;
  const validFrom = nowIso.slice(0, 10);
  const validUntil = new Date(Date.parse(validFrom) + validDays * 86400000).toISOString().slice(0, 10);
  const pdfUrl = pdfUrlFromManifest(manifest);
  const title =
    manifest.config?.publicationTitle ||
    manifest.groupTitle ||
    manifest.sourceDocumentTitle ||
    `${slug} folder`;
  const embedUrl = viewerUrl.includes('publitas_embed')
    ? viewerUrl
    : `${viewerUrl}${viewerUrl.includes('?') ? '&' : '?'}publitas_embed=embedded`;

  const folder = {
    id: `${slug}-${manifest.id}-folder`,
    retailerSlug: slug,
    title,
    validFrom,
    validUntil,
    pageCount: manifest.numPages || 0,
    thumbnailUrl: coverThumbnail(html),
    pages: [], // page hashes are signed/lazy; PDF carries the full folder
    embedUrl,
    pdfUrl: pdfUrl || undefined,
    contentSource: 'publitas',
    scrapedAt: nowIso,
  };

  return {
    retailer: slug,
    folders: [folder],
    deals: [],
    scrapedAt: nowIso,
    sourceUrls: [viewerUrl],
    methods: ['publitas', pdfUrl ? 'pdf' : 'html'],
  };
}

/**
 * Carry rendered page images across a harvest of the same issue.
 *
 * The harvest sets `pages: []` because Publitas page images are signed and
 * lazy-loaded — it cannot produce them. But scripts/backfill-pdf-pages.mts
 * renders them from the PDF afterwards, and the harvest then overwrote the
 * whole folder JSON, deleting every one. Fourteen retailers get their folder
 * this way, so a twice-daily harvest silently emptied hundreds of pages.
 *
 * Pages are kept only when the folder is unmistakably the same publication —
 * same id and same PDF. A new issue must start empty, because last week's
 * pages are the wrong content, and the backfill will render the new ones.
 */
export function preserveRenderedPages(existing, next) {
  const prev = existing?.folders?.[0];
  const fresh = next?.folders?.[0];
  if (!prev?.pages?.length || !fresh) return next;
  if (prev.id !== fresh.id || prev.pdfUrl !== fresh.pdfUrl) return next;

  fresh.pages = prev.pages;
  fresh.pageCount = prev.pages.length;
  // The cover the harvest picked is a remote Publitas URL; a locally rendered
  // first page is the one the viewer actually shows.
  if (prev.thumbnailUrl) fresh.thumbnailUrl = prev.thumbnailUrl;
  return next;
}

/** Read the folder JSON already on disk, or null when there is none. */
export function readExistingFolder(path) {
  try {
    return JSON.parse(readFileSync(path, 'utf-8'));
  } catch {
    return null;
  }
}

// CLI
const isMain = process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url));
if (isMain) {
  const [viewerUrl, ...rest] = process.argv.slice(2);
  if (!viewerUrl) { console.error('usage: harvest-publitas.mjs <viewerUrl> [--slug <slug>]'); process.exit(1); }
  const slugFlag = rest.indexOf('--slug');
  const slug = slugFlag !== -1 ? rest[slugFlag + 1] : null;
  const { status, html } = await fetchHtml(viewerUrl);
  if (status !== 200) { console.error('HTTP', status, viewerUrl); process.exit(2); }
  const manifest = extractManifest(html);
  if (!manifest) { console.error('no manifest found in', viewerUrl); process.exit(3); }
  const data = buildScrapedData(manifest, slug || manifest.groupSlug, viewerUrl, html);
  const f = data.folders[0];
  console.log('id', manifest.id, 'groupId', manifest.groupId, 'slug', manifest.slug);
  console.log('title:', f.title, '| numPages:', f.pageCount);
  console.log('pdf:', f.pdfUrl || 'NONE');
  console.log('thumb:', f.thumbnailUrl || 'NONE');
  console.log('valid:', f.validFrom, '→', f.validUntil);
  if (slug) {
    const __dirname = dirname(fileURLToPath(import.meta.url));
    const out = resolve(__dirname, '..', 'data', 'folders', `${slug}.json`);
    writeFileSync(out, JSON.stringify(data, null, 2));
    console.log('wrote', out);
  }
}
