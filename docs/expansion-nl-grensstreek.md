---
description: NL grensstreek uitbreiding (onderzoek + MVP plan)
---

# Context
Doelgroep: Belgische grensstreek (Limburg/Antwerpen) die (ook) in Nederland winkelt.
Doel: extra waarde + extra outbound clicks/revenue zonder SEO/complexity regressies op de core “België folders” site.

# Hypothese
- Er is relevante vraag naar NL-promoties in de Belgische grensstreek.
- “NL-only” retailers kunnen extra clicks genereren t.o.v. retailers die al in België bestaan.

# Retailers in de Nederlandse grensstreek (relevant voor Belgische grensshoppers)
Dit is een praktische shortlist van ketens die je typisch in NL dichtbij België aantreft (Zeeland / Noord-Brabant / NL-Limburg).

## Supermarkten
- Albert Heijn (AH)
- Jumbo
- Plus (incl. veel voormalige Coop-locaties)
- Dirk (sterker in west/zuidwest; regionaal)
- Nettorama (discount; relatief sterk in Brabant)
- Hoogvliet (zuidwest/Zeeland; regionaal)
- Spar (kleiner; wisselende promo-relevantie)
- Lidl (ook in BE)
- Aldi (ook in BE)

## Drogist/discount
- Etos (NL-only)
- Gall & Gall (NL-only)
- Action (ook in BE)
- Kruidvat (ook in BE)
- Hema (ook in BE)

## DIY (optioneel)
- Karwei (NL-only)
- Gamma (ook in BE)
- Praxis (ook in BE)

# Prioritering voor MVP
## Hoogste “uniqueness” (NL-only) → hoogste kans op incremental clicks
- Jumbo
- Plus
- Nettorama
- Dirk
- Etos
- Gall & Gall
- Karwei
- Hoogvliet

## Lager “uniqueness” (ook in BE) → vooral interessant als acties echt verschillen
- Lidl
- Aldi
- Action
- Kruidvat
- Hema
- Gamma
- Praxis

# Aanbevolen MVP (2 weken)
## Scope
- 1 aparte landing/sectie: `NL Grensstreek` (niet mengen met bestaande `/folders` flow)
- Start met 1-2 retailers maximaal

## Informatie-architectuur (MVP)
Doel: de core BE folders flow stabiel houden, en NL-grensstreek “opt-in” maken.

Aanbevolen routes:
- `/nl-grensstreek` (landing)
- `/nl-grensstreek/[retailer]` (retailer detail met folder embed / pdf / pages)

Navigatie:
- 1 extra item in header of op `/folders`: “NL grensstreek” (expliciet labelen)

Tracking:
- Outbound links blijven via `/out/[retailer]`.
- UTM conventie voor FB posts:
  - `utm_source=facebook`
  - `utm_medium=group_post`
  - `utm_campaign=nl_grensstreek`
  - `utm_content=<post-id>`

## Aanbevolen MVP-retailers
- Albert Heijn (NL)
- Jumbo (NL)

Alternatief (als AH NL te veel overlap heeft met BE):
- Jumbo (NL)
- Plus (NL)

## Distributie
- Plaats 2-3 posts in de Facebook groep met duidelijke framing “NL promos (grensstreek)”.
- Gebruik UTMs consistent:
  - `utm_source=facebook`
  - `utm_medium=group_post`
  - `utm_campaign=nl_grensstreek`
  - `utm_content=<post-id>`

# Meting (met bestaande first-party logging)
Gebruik Admin v1 dashboards:
- `/admin/posts?days=7` (top posts)
- `/admin/posts/[utmContent]?days=7` (drilldown)

Gebruik engagement dashboard:
- `/admin/engagement?days=7`

Kern KPI’s:
- Outbound clicks per `utm_content` (per post)
- CTR-achtige proxy: outbound clicks / attribution sets (grove ratio, afhankelijk van consent)

Aanvullende KPI’s (quality):
- Engagement proxy: `folder_engaged_15s / folder_view` per retailer
- Depth proxy: `folder_scroll_90 / folder_view` per retailer

# SEO & product guardrails
- Houd NL-grensstreek content afgescheiden qua IA/navigatie.
- Overweeg voor MVP een `noindex` strategie op NL-grensstreek pagina’s tot er bewijs is dat:
  - content duurzaam/actueel kan blijven
  - het geen negatieve impact heeft op core BE SEO

Aanbevolen MVP-guardrail:
- Zet `/nl-grensstreek` en `/nl-grensstreek/[retailer]` initieel op `robots: { index: false, follow: false }`.
- Pas na validatie (zie Go/No-Go) omzetten naar indexeerbaar + toevoegen aan sitemap.

# Monetization overwegingen
- Display ads: werkt direct, maar pas op voor consent impact op RPM.
- Affiliate: NL-only retailers vragen meestal aparte affiliate setup (netwerk + deeplinks).
  - Geen affiliate claim in UI copy zonder daadwerkelijke integratie.

Pragmatische MVP-keuze:
- MVP focust op ads + outbound clicks (met /out logging) en nog niet op NL affiliate.

# Implementatie-notes (als we doorgaan)
- Nieuwe “regio” concept: `market=be` vs `market=nl_border` (en strict scheiden in routes + sitemap).
- Nieuwe scrapers alleen toevoegen na MVP-validatie.
- Outbound links blijven via `/out/[retailer]` voor consistente logging.

# Go/No-Go criteria (na 2 weken)
Go als:
- NL-grensstreek posts hebben outbound clicks >= median van BE posts (zelfde periode)
- Engagement is acceptabel (bv. `engaged_15s/view` niet dramatisch lager dan BE folders)
- Geen duidelijke SEO regressie signalen (indexing/canonical issues)

No-Go (stop/rollback) als:
- Outbound clicks laag blijven ondanks posts
- Consent/engagement duidelijk slechter is dan BE, of
- Scope creep: scrapers/maintenance kosten overstijgen opbrengst

# Open vragen (input nodig)
- Welke NL provincies targetten we expliciet voor content (Zeeland / Noord-Brabant / NL-Limburg)?
- Welke retailers kies je definitief voor MVP (max 2)?
- Is het doel primair ads (RPM) of affiliate (CPA/CPS)?

# Concrete keuzes (kies 1 set)
Set 1 (meest logisch voor BE grens):
- Jumbo + Plus

Set 2 (hoogste herkenbaarheid + volume):
- Albert Heijn + Jumbo
