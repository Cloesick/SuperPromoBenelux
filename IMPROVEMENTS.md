# Improvements: superpromobelgie.com

Written 2026-09-21, after the pipeline repair (PRs #17–#25). Ordered by value
for the business ("data first, then audience") against effort. Each item names
the files involved. Done items stay listed briefly so the history is readable.

## Now (high value, low–medium effort)

1. **Brief every current folder, not only supermarkets.**
   The "Deze week in de folder" text, JSON-LD offers and home-page deals exist
   only where a cover brief exists (4 retailers today). Add the
   `ANTHROPIC_API_KEY` secret, then set `SHORTS_RETAILERS` (repo variable read
   by `weekly-shorts.yml`) to every retailer with a current folder, or change
   `DEFAULT_TARGETS` in `scripts/shorts/analyze.mts`. This is the main lever for
   the AdSense "low value content" review. Request that review about a week
   after the text is live.

2. ~~**Render upcoming folders too.**~~ Done in #27: next week's Lidl got 38 pages and Carrefour 60.
   `scripts/backfill-pdf-pages.mts` renders only `folders[0]`. So next week's
   Lidl, Carrefour and Kruidvat folders appear in the switcher with 0 pages
   until they become current, although "volgende week" searches are ~20% of
   impressions. Render every non-expired folder without pages (loop over
   `data.folders`, not `[0]`), keeping the expired-skip.

3. **E2E suite in step with the data.**
   `cypress/e2e/folder-expectations.cy.ts` and `folder-freshness.cy.ts` pin
   per-retailer facts (page minimums, "scraped within 7 days", a Bauhaus
   fixture) that change every week. Derive expectations from
   `data/folders/*.json` and the staleness audit instead of fixtures. A PR is in
   progress: `claude/e2e-after-data-changes`.

4. **Colruyt edition choice.**
   The CI harvest picked "Alle acties" (22 pages) instead of the "Digitale
   folder" (36 pages) that local runs find. The issuu profile page apparently
   lists different docs to the CI runner. Try the profile's RSS/JSON feed, or
   read `d=` embed ids from `colruyt.be/nl/folders` when reachable, in
   `apify/harvest-issuu.mjs` (`discoverIssuuDoc`).

## Next (growth)

5. **"Mail me when the new folder is out" alerts** per retailer.
   The harvest commit is the trigger: a new folder id per slug. It needs an
   e-mail sender (Resend, or Cloudflare Email Sending now the domain is on
   Cloudflare), a double-opt-in list, and an unsubscribe link. This is the
   retention feature competitors lean on.

6. **Folder archive.** Keep expired folders as `/folders/<slug>/archief/<week>`
   pages instead of overwriting `data/folders/<slug>.json`. It adds indexable
   long-tail pages and a price history. It needs the harvest and scrape to
   append rather than replace (`preserveRenderedPages` in
   `apify/harvest-publitas.mjs` is the place).

7. **Cross-retailer price tracking** (the stated "real asset").
   `scripts/extract-offers.mts` and `/prijzen` exist on
   `feat/price-comparison-spec` but aren't merged. The weekly briefs now give
   clean per-offer prices to seed it without vision batch costs.

8. **Premium Ghibli reels** for the top 2–3 offers per week (ChatCut). This
   needs the ChatCut sign-in and credits. The brief's `genre` field already
   names the scene.

## Housekeeping

9. **Boots** is behind a bot challenge (validation catches it). Either find an
   alternative source, or stop scraping it and mark it in `retailers.ts`.
10. **Cora** stays in `apify/harvest-all.mjs` but never finds a folder. Check
    whether it still publishes on Publitas, or remove it. (Boni, a Dutch
    chain with no Belgian page, was removed on 2026-09-22.)
13. **Tom&Co** went from a 6-page issuu leaflet to a 1-page promo-page
    screenshot. Check whether it still publishes on issuu, and if so add it
    to the `ISSUU` map with profile discovery, like Colruyt.
14. **Colruyt issuu pages have no thumbnails**, so the viewer's strip loads
    all 22 full page scans. Generate thumbnails in the render step or use
    issuu's smaller image size for the strip.
11. Next week's Carrefour edition can be French (the slug carries no
    language). Detect the language from the rendered cover or the title, and
    prefer the Dutch edition when both exist.
12. `package-lock.json` is only consistent under `--legacy-peer-deps`.
    Resolve the peer conflict (mocha / cypress reporter) so plain `npm ci`
    works.

## Done 2026-09-21
- The folder pipeline publishes again: prune guard, expired-render skip, push
  race. Dates are validated from the folders themselves, and each retailer has
  a single owner (harvest or scrape).
- New sources: Carrefour, Delhaize and Kruidvat (WePublish); Aveve and Action
  (Publitas spreads). Colruyt is discovered via issuu.
- Weekly 15-second shorts pipeline with a Zernio publish step behind
  `AUTO_PUBLISH`.
- Readable page content, status badges, SEO titles, JSON-LD offers,
  timezone-safe dates.
- Consent-gated Meta/TikTok/Pinterest pixels. contact@ address, with Cloudflare
  Email Routing prepared.
