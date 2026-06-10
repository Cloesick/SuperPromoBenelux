# SuperPromo — Connectors & Data Pipeline

Configured 2026-06-10. This records the connector wiring so it survives across
sessions. **No secrets here** — tokens live in Vercel/Apify/Make env only.

## Airtable — "SuperPromo — Deals Engine"

- Base id: `appILxwPpKEWomToC` · Workspace: `wspIaImGE87K5DPmE`
- Tables:
  - **Retailers** (`tblukdNhLiD50WJ89`) — seeded with all 8 retailers (6 active
    grocery + Action, 2 staged electronics). Holds slug, folder URL, affiliate
    network, Apify actor, Active flag.
  - **Folders** (`tbl8awMine4YaVCfg`) — one row per weekly leaflet; links → Retailer.
  - **Deals** (`tblmdAkB5f8rkl2fT`) — extracted products; links → Retailer, Folder.
- Field names mirror `src/lib/types.ts` `Deal` (product, originalPrice,
  promoPrice, discount, validFrom/Until, retailerSlug).

## Apify — `superpromo-folder-scraper`

- Code: [`apify/`](../apify/README.md). Deploy with `apify push`.
- Schedule: Mondays 06:00 (`0 6 * * 1`). Residential/BE proxy.
- Writes to: Airtable (above) + the run dataset.
- Replaces local `npm run scrape`. Secret: `AIRTABLE_TOKEN` (Apify env var).

## Site integration — two options

`src/lib/folders.ts` currently reads `data/folders/*.json`. Pick one:

1. **Airtable as source of truth (recommended):** add a small fetch in
   `folders.ts` (or a build-time script) that reads the Deals/Folders tables via
   the Airtable REST API using `AIRTABLE_TOKEN` (Vercel env). Gives a non-dev
   editorial UI to curate/feature deals.
2. **Keep JSON, Apify commits it:** have the Make scenario (below) write the
   Apify dataset back into `data/folders/*.json` via a GitHub commit. Zero site
   code change, but no editorial UI.

## Make — orchestration (optional glue)

Org "Saspire" (Core, 10k ops/mo). Scenario design:
`Apify (Watch runs) → Iterator over dataset → Airtable (upsert) → [optional]
GitHub commit / Vercel deploy hook`. Only needed if you want notifications,
GitHub commits, or to avoid the actor writing Airtable directly.

## Vercel

Projects `superpromobelgiebram`, `diysuperpromobelgiebram` (team
`team_zzgGGESvAabTQeAmIWXUiMN4`). Add `AIRTABLE_TOKEN` + `AIRTABLE_BASE` env
vars if using option 1. AdSense still needs a **custom domain** (blocked on
`*.vercel.app`) — see Cloudflare note in the chat summary.
