#!/usr/bin/env node
// ---------------------------------------------------------------------------
// Check that folder pages actually SERVE what their JSON claims.
//
// The unit and Cypress suites both run against the app's own code. This runs
// against a *served* site, local or production, and is the only check that
// catches the failure this project kept hitting: a page rendering full viewer
// chrome — "Pagina 1 van 16", thumbnails, arrows — around images that 404.
//
//   node scripts/verify-frontend.mjs http://localhost:3000
//   node scripts/verify-frontend.mjs https://superpromobelgie.com
//
// Three contracts, per folder page:
//   1. every /screenshots/… the HTML references is served with real bytes;
//   2. indexable <=> present in the sitemap (they share one predicate, so a
//      mismatch means the two have drifted apart);
//   3. the page shows something — images, an iframe, or an honest empty state.
//
// Exits non-zero if any page fails, so it can gate a deploy.
// ---------------------------------------------------------------------------

import fs from "node:fs";

const BASE = process.argv[2] || "http://localhost:3000";
const dir = "data/folders";

const folders = fs.readdirSync(dir).filter(f => f.endsWith(".json")).map(f => {
  const j = JSON.parse(fs.readFileSync(`${dir}/${f}`, "utf8"));
  const fo = (j.folders || [])[0] || {};
  return { slug: f.replace(".json", ""), pages: (fo.pages || []).length,
           embed: !!fo.embedUrl, pdf: !!fo.pdfUrl };
});

const sitemap = await (await fetch(`${BASE}/sitemap.xml`)).text();
// The sitemap emits bare /folders/<slug> with no trailing slash.
const sitemapSlugs = new Set(
  [...sitemap.matchAll(/<loc>[^<]*\/folders\/([a-z0-9-]+)<\/loc>/g)].map(m => m[1]),
);

let bad = 0;
const rows = [];

for (const { slug, pages, embed, pdf } of folders) {
  const html = await (await fetch(`${BASE}/folders/${slug}/`)).text();

  // ALDI's captures are .jpg; everything else is .webp. Match both.
  const imgs = [...new Set(
    // Absolute (blob storage) first, then site-relative. Matching only the
    // relative form silently stripped the origin off a blob URL and tested a
    // local file instead — a green run that proved nothing about production.
    [
      ...html.matchAll(
        /https?:\/\/[^"'\s]+?\/screenshots\/[a-z0-9-]+\.(?:webp|jpg|png)|(?<![\w:/])\/screenshots\/[a-z0-9-]+\.(?:webp|jpg|png)/g,
      ),
    ].map((m) => m[0]),
  )].filter(u => !u.includes("-thumb"));

  let served = 0, bytes = 0;
  for (const u of imgs) {
    const r = await fetch(u.startsWith("http") ? u : BASE + u);
    if (r.ok) { const b = await r.arrayBuffer(); if (b.byteLength > 1000) { served++; bytes += b.byteLength; } }
  }

  const hasIframe = /<iframe/.test(html);
  const emptyState = /(?:binnenkort|kunnen we hier niet tonen|nog geen folder beschikbaar|momenteel geen)/i.test(html);
  const noindex = /name="robots"[^>]*content="[^"]*noindex/.test(html);
  const ld = (html.match(/<script type="application\/ld\+json">.*?<\/script>/gs) || [])
    .map(s => { try { return JSON.parse(s.replace(/^[^>]*>/, "").replace(/<\/script>$/, "")); } catch { return null; } });
  const webpage = ld.find(o => o && o["@type"] === "WebPage");

  const inSitemap = sitemapSlugs.has(slug);
  // Contract 1: indexable <=> in sitemap.
  const consistent = inSitemap === !noindex;
  // Contract 2: every image the HTML references is served with real bytes.
  const imagesOk = imgs.length === 0 || served === imgs.length;
  // Contract 3: the page shows SOMETHING — pages, an iframe, or an honest empty state.
  const showsSomething = imgs.length > 0 || hasIframe || emptyState;
  const ok = consistent && imagesOk && showsSomething;
  if (!ok) bad++;

  rows.push({ slug, pages, imgs: imgs.length, served, mb: (bytes / 1e6).toFixed(1),
              embed, pdf, hasIframe, emptyState, noindex, inSitemap,
              dateMod: !!webpage?.dateModified, cover: !!webpage?.primaryImageOfPage, ok });
}

const y = b => (b ? "yes" : " - ");
console.log("slug".padEnd(15), "pgs img srv    MB  iframe empty noidx sitemap dateMod cover   OK");
for (const r of rows.sort((a, b) => b.pages - a.pages || a.slug.localeCompare(b.slug))) {
  console.log(
    r.slug.padEnd(15),
    String(r.pages).padStart(3), String(r.imgs).padStart(3), String(r.served).padStart(3),
    String(r.mb).padStart(6), "  ",
    y(r.hasIframe), "  ", y(r.emptyState), " ", y(r.noindex), "  ", y(r.inSitemap).padEnd(5),
    " ", y(r.dateMod), "  ", y(r.cover), " ", r.ok ? "PASS" : "FAIL",
  );
}
const withPages = rows.filter(r => r.imgs > 0);
console.log(`\n${rows.length - bad}/${rows.length} folder pages pass.`);
console.log(`${withPages.length} render leaflet images (${withPages.reduce((s, r) => s + r.imgs, 0)} pages, ${withPages.reduce((s, r) => s + +r.mb, 0).toFixed(1)} MB served).`);
console.log(`sitemap folder URLs: ${sitemapSlugs.size} | sitemap/robots mismatches: ${rows.filter(r => r.inSitemap === r.noindex).length}`);
process.exit(bad ? 1 : 0);
