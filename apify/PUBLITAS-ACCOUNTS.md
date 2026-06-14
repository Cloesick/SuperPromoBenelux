# Folder harvesting — verified sources (Apify-free)

Folders are harvested with plain HTTP (no Apify, no Puppeteer). Two harvesters:

- **`harvest-publitas.mjs`** — Publitas embeds the full publication manifest +
  a public PDF URL inline in the viewer HTML (`var data = {...}`,
  `config.downloadPdfUrl`). Works for `view.publitas.com` **and white-labeled
  Publitas domains** (e.g. `folder-nl.lidl.be`). Renders as PDF (per-page image
  hashes are signed/lazy; only the cover is in static HTML).
- **`harvest-issuu.mjs`** — Issuu oEmbed gives title + validity dates + docId
  (from the thumbnail URL); full pages live at `image.isu.pub/{docId}/jpg/page_{N}.jpg`,
  enumerable until the CDN 403s. Renders as a page-image flipbook.

**`harvest-all.mjs`** orchestrates both and writes `data/folders/{slug}.json`.
Run: `NODE_TLS_REJECT_UNAUTHORIZED=0 node apify/harvest-all.mjs [slug ...]`
(the TLS env var is only needed on this cert-proxied machine, NOT on CI).
`discover-accounts.mjs` probes candidate account slugs to find new retailers.

## Discovery method

Each Publitas account root `view.publitas.com/{account}` **302-redirects to its
latest publication**. So harvest-all tries, in order: deterministic weekly-slug
patterns → custom date slugs → the account root. First candidate with a PDF wins.
A retailer with no current PDF keeps its last-good JSON (best-effort).

## Verified live sources (June 2026)

| Retailer | Platform | Account / pattern |
|----------|----------|-------------------|
| Albert Heijn | Publitas | `ah` · `bonus-week-{WW}-{YYYY}` |
| Jumbo | Publitas | `jumbo-supermarkten` (root→latest) |
| Delhaize | Publitas | (pre-harvested) |
| PLUS | Publitas | `plus-folder-nl` · `plus-week-{WW}-{YYYY}` |
| Spar | Publitas | `spar` (root→latest) |
| Hoogvliet | Publitas | `hoogvliet` · `folder_{YYYY}_{WW}` |
| Lidl | Publitas (custom domain) | `folder-nl.lidl.be/nl-folder-{DD-MM}-{DD-MM}` |
| Colruyt | Issuu | `issuu.com/colruytgroup/docs/_colruyt_laagste_prijzen_-_folder` |
| Action | Publitas (flipbook, no PDF) | `action-benl` (kept as page-images) |
| Hubo | Publitas | `hubo-belgie-vl` · `{YY}{WW}_nl` |
| Gamma | Publitas | `gamma` · `gamma-week-{WW}-{YYYY}` |
| Brico | Publitas | `brico-folder-extra-nl` (root→latest) |
| Mr. Bricolage | Publitas | `mr-bricolage` (root→latest) |
| Bauhaus | Publitas | `bauhaus-nederland` (root→latest) |
| Hornbach | Publitas | `hornbach-nl` (root→latest) |
| Welkoop | Publitas | `welkoop` · `welkoop-week-{WW}-{YYYY}` |
| Xenos | Publitas | `xenos` (root→latest) |
| Gifi | Publitas | `gifi` (root→latest) |
| e5 | Publitas | `e5-mode` (root→latest) |

## Not harvestable via static fetch (need the Apify actor / screenshots)

- **Aldi** — `folder.aldi.be` is iPaper; per-page images are behind tokenized
  manifests, no public PDF, embed is X-Frame-blocked. Stays on last-good data.
- Carrefour (own viewer), Kruidvat (own), MediaMarkt (own), Intratuin/Boni/Aveve/
  Cora (Publitas account exists but current pub has no PDF / is flipbook-only).

## Adding a retailer

1. `node apify/discover-accounts.mjs` (or WebSearch `"{name} folder publitas"`).
2. Add to `harvest-all.mjs` RETAILERS (Publitas) or ISSUU map.
3. `node apify/harvest-all.mjs {slug}` → writes data/folders/{slug}.json.
4. Add a full entry to `src/lib/retailers.ts` (+ `public/retailers/{slug}.svg`)
   and set `live:true` in `src/lib/catalog.ts`.
