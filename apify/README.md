# SuperPromo — Belgian Folder Scraper (Apify actor)

Replaces the local `npm run scrape` (Puppeteer on your machine) with a
**scheduled, proxied, cloud** scraper that extracts weekly promo deals from
Belgian retailers and pushes them to Airtable + an Apify dataset.

Retailers (slugs match `src/scrapers/*.ts` and `data/folders/*.json`):
`albert-heijn`, `lidl`, `delhaize`, `colruyt`, `aldi`, `action` (active) ·
`mediamarkt`, `coolblue` (staged, `active:false`).

## What it does

1. Visits each retailer's folder URL through Apify **Residential / BE** proxy.
2. Reads the rendered page text (Puppeteer + Chromium).
3. Extracts `{ product, originalPrice, promoPrice, discount }` via the same
   price-pattern logic as `src/scrapers/extractDealsFromText.ts`.
4. Upserts a **Folder** row + its **Deals** into Airtable base
   `appILxwPpKEWomToC` ("SuperPromo — Deals Engine"), and pushes JSON to the
   run **dataset** so the site can pull it directly.

## Deploy

```bash
cd apify
npm install -g apify-cli          # one-time
apify login                        # paste your Apify API token
apify push                         # builds the Docker image on Apify
```

Then in the Apify console for this actor:

1. **Settings → Environment variables** → add a secret `AIRTABLE_TOKEN`
   (Airtable personal access token with `data.records:write` on the base).
   *Never commit this token.*
2. **Schedules → Create** → cron `0 6 * * 1` (Mondays 06:00) → run this actor
   with input `{}` (all active retailers).

## Run locally (no proxy/Airtable)

```bash
cd apify
npm install
echo '{ "pushToAirtable": false, "retailers": ["aldi"] }' > storage/key_value_stores/default/INPUT.json
apify run --purge
```

Results land in `storage/datasets/default/`.

## Input (see `.actor/input_schema.json`)

| field | default | note |
|---|---|---|
| `retailers` | active set | slugs to scrape; `[]` = all active |
| `pushToAirtable` | `true` | upsert into Airtable |
| `airtableToken` | env `AIRTABLE_TOKEN` | secret; prefer the env var |
| `airtableBaseId` | `appILxwPpKEWomToC` | SuperPromo Deals Engine |
| `proxyConfiguration` | Residential / BE | retailer sites geofence/bot-block |

## Cost (rough, Starter plan @ $0.20/CU)

~0.02–0.05 compute units per retailer page. 8 retailers × weekly =
**~$0.30–0.60/month** of compute + residential proxy (~$1–3/mo at this volume).
Comfortably inside the **$29/mo Starter** plan's included $29 credit.

## Tuning

- The price-pattern extractor is a working baseline. For retailers whose deals
  live in a PDF/Publitas viewer (Delhaize, Lidl), add a step that resolves the
  PDF URL (your TS scrapers already detect these) and feed its text to
  `extractDeals`. Hook points are marked in `src/main.js`.
- Set `active:true` on `mediamarkt`/`coolblue` in `src/retailers.js` to enable
  electronics once Awin affiliate links are approved.
