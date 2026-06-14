# Publitas account map (BE/NL retailers)

Verified via indexed `view.publitas.com` URLs, June 2026. Publitas page-image
CDN URLs (`/pages/{hash}-at{size}.jpg`) and PDFs (`/pdfs/{hash}.pdf`) are public,
so any retailer on this list is cleanly scrapeable by the actor.

`viewerTemplate` tokens resolved in `apify/src/main.js`:
`{WEEK}` = zero-padded ISO week · `{YYYY}` = 4-digit year · `{YY}` = 2-digit year.

## Confirmed weekly slug (deterministic, run by default)

| Retailer | Account | Slug pattern | Validated |
|----------|---------|--------------|-----------|
| Albert Heijn | `ah` | `bonus-week-{WEEK}-{YYYY}` | live |
| Action | `action-benl` | `action-week-{WEEK}-{YYYY}` | live |
| Jumbo | `jumbo-supermarkten` | `jumbo-actiefolder-week-{WEEK}` | live |
| **Hubo** | `hubo-belgie-vl` | `{YY}{WEEK}_nl` (e.g. `2624_nl`) | ✅ current week loads |

## Account confirmed, weekly slug historical (fast-path hint + self-heal)

These used `…week-{WW}-{YYYY}` in 2024/2025 but the **current** publication did
not resolve at that exact slug on probe (some now carry a random hash suffix).
The actor falls back to the retailer's folder landing page to find the live viewer.

| Retailer | Account | Historical slug pattern |
|----------|---------|-------------------------|
| Gamma | `gamma` | `gamma-{WEEK}-week-{YYYY}` |
| Blokker | `blokker` | `blokker-folder-week-{WEEK}-{YYYY}` |
| Intratuin (NL) | `intratuin-nl` | `folder-week-{WEEK}-{YYYY}-nl-dyn` |
| Boni | `boni-supermarkt` | `boni-folder-week-{WEEK}-{YYYY}` |

## Account confirmed, period-based slug (needs scrape-time discovery)

Slugs are campaign/period numbers or theme names — not derivable from the week.
Left `active: false`; enable once the actor harvests the live slug.

| Retailer | Account | Example slug |
|----------|---------|--------------|
| Aveve | `aveve` | `vl-p08_folder_tuin_2026` |
| Brico | `brico-folder-extra-nl` / `-fr` | `brico-benl-f14-2024-indian-summer` |
| Mr. Bricolage | `mr-bricolage` | `folder-8-2026` (monthly no.) |
| Cora | `cora` | period-based |
| Maxi Zoo (NL) | `maxi-zoo-nl` | historical only — confirm current |

## Not on Publitas (other platform / own viewer)

Casa, PLUS, Dirk, Hoogvliet, Zeeman (current), Kruidvat, MediaMarkt → own viewer
or iPaper/Issuu. Colruyt = Issuu (`colruytgroup`), Aldi = iPaper. Handle via the
actor's screenshot-capture fallback rather than a Publitas template.

## How to add the next retailer

1. `WebSearch "{retailer} folder publitas"` (allow domain `view.publitas.com`).
2. Read the account slug (first path segment) + the current slug format.
3. Probe the **current** week's URL — only mark the weekly template "confirmed"
   if it loads; otherwise add account note + leave `active: false`.
4. Add to `apify/src/retailers.js`; ensure the slug exists in `src/lib/catalog.ts`.
