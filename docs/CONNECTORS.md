# SuperPromo — Connectors & Data Pipeline

Updated 2026-09-28 (first written 2026-06-10, when Apify → Airtable was the
plan). This records the connector wiring so it survives across sessions.
**No secrets here** — tokens live in GitHub Actions secrets, Vercel, Apify or
Make env only.

## What actually feeds the site

The site reads **`data/folders/<slug>.json`** (`src/lib/folders.ts`). Those
files are written by two GitHub Actions jobs and committed to `main`, which
Vercel then deploys. Nothing at runtime reads Airtable or Apify.

| Time (UTC) | Workflow | What it does |
|---|---|---|
| 04:30 Mon/Wed/Thu, 03:00 on the 1st | `scrape-folders.yml` | `npm run scrape` (Puppeteer, `src/scrapers/`) for that day's publication group. Groups come from each retailer's `folderDay` in `src/lib/retailers.ts` via `scripts/scrape-targets.mts`; the 1st-of-month run covers the `doorlopend` (rolling-promo) retailers. Then renders PDF-only folders to pages (`scripts/backfill-pdf-pages.mts`), prunes unreferenced screenshots, commits `data/folders` + `data/health.json`. |
| 05:20 Mon/Wed/Thu | `harvest-publitas.yml` | `node apify/harvest-all.mjs` — plain-HTTP harvest from the leaflet platforms (Publitas, Issuu, WePublish) for retailers listed in `apify/harvestedSlugs.mjs`. Those slugs are dropped from the scrape groups so the two jobs never write the same file. Renders the PDFs to page images, commits. |
| after either of the above | `post-scrape-smoke.yml` | Validates the JSON, builds the site, checks every referenced page image is served and sitemap/robots agree. |
| 06:00 daily | `health-triage.yml` | Reads `data/health.json` **and** audits the published folders' expiry directly; keeps one GitHub issue up to date and fails the run when folders are stale. |
| 06:40 Mon/Wed/Thu | `weekly-shorts.yml` | Shorts: `analyze.mts` (Claude reads page 1 → brief) → `render.mts` (15 s, 1080×1920, ffmpeg) → artifact → `publish.mts` via Zernio. Dry run unless repo variable `AUTO_PUBLISH` = `true`. |
| on push / PR | `tests.yml` | `check-assets.mjs`, `npm test`, Cypress e2e. Not triggered by the data commits. |

Manual only: `migrate-images-to-blob.yml` (move committed page images to
Vercel Blob), `cypress-windsurf.yml` (legacy, reporter broken), `ci-probe.yml`
(checks runners start at all).

### Secrets and env the pipeline uses

- GitHub Actions: `BLOB_READ_WRITE_TOKEN` (optional — when set, page images go
  to Vercel Blob instead of `public/screenshots`), `ANTHROPIC_API_KEY`
  (shorts analysis), `ZERNIO_API_KEY` (shorts publishing), `POSTGRES_URL`
  (optional — Neon deal archive, see below), `GITHUB_TOKEN`.
- Vercel (site): `NEXT_PUBLIC_RETAIL_VERTICAL` / `_SITE_NAME` / `_SITE_DOMAIN`
  / `_SITE_REGION` choose the vertical and brand (`src/lib/site.ts`);
  `POSTGRES_URL` for the events/admin dashboards; analytics, pixel and AdSense
  `NEXT_PUBLIC_*` ids.

## Neon Postgres — price archive

`src/lib/productsDb.ts` `syncDealsToDb()` is called at the end of every scrape
to upsert extracted deals (DDL in `sql/001_create_promo_products.sql`);
`src/lib/eventsDb.ts` stores engagement/UTM events (`sql/sp_events.sql`).
Both connect with `POSTGRES_URL` (or `POSTGRES_PRISMA_URL`) and silently do
nothing when it is unset.

`scrape-folders.yml` passes the `POSTGRES_URL` repository secret to the scrape
step; until that secret exists, scheduled scrapes skip the sync (only local
runs with the env set reach Neon). Harvested retailers never reach Neon at all
— the harvester writes JSON only.

## Apify — `superpromo-folder-scraper` (not scheduled)

- Code: [`apify/src/`](../apify/README.md). Deploy with `apify push`.
- Can write the dataset to Airtable (`AIRTABLE_TOKEN`, `AIRTABLE_BASE`) and
  captures to R2. Superseded by the GitHub Actions jobs above; the
  `apify/*.mjs` harvesters live in the same folder but run in Actions, not on
  Apify.

## Airtable — "SuperPromo — Deals Engine" (optional, not read by the site)

- Base id: `appILxwPpKEWomToC` · Workspace: `wspIaImGE87K5DPmE`
- Tables: **Retailers** (`tblukdNhLiD50WJ89`), **Folders**
  (`tbl8awMine4YaVCfg`), **Deals** (`tblmdAkB5f8rkl2fT`). Field names mirror
  `src/lib/types.ts` `Deal`.
- `npm run sync:airtable` (`scripts/sync-airtable-deals.mjs`) reads it;
  dry run by default, `--write` to apply.

## Make — orchestration (not in use for this pipeline)

Org "Saspire". The June design (`Apify → Airtable upsert → GitHub commit /
Vercel deploy hook`) was never needed once scraping moved to Actions.

## Vercel

Projects `superpromobelgiebram`, `diysuperpromobelgiebram` (team
`team_zzgGGESvAabTQeAmIWXUiMN4`). Production domain `superpromobelgie.com`
(set via `NEXT_PUBLIC_SITE_DOMAIN`). Other verticals deploy the same repo with
a different `NEXT_PUBLIC_RETAIL_VERTICAL`.
