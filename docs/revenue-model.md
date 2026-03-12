# SuperPromo België – Revenue Model (Ads + Affiliate)

## Doel
Dit document geeft een **rekenmodel** om de potentiële inkomsten van SuperPromo België te schatten op basis van:

- Display ads (RPM)
- Affiliate inkomsten (CTR → clicks → EPC of conversie)

**Belangrijk**
- Dit is geen garantie. Het doel is een model dat je met echte data kan voeden.
- In EU/BE is consent (CMP) vaak een dominante factor voor ads.
- Cross-origin folder viewers (Publitas, ALDI viewer, etc.) beperken wat je technisch kan meten/forceren.

---

## 1) Display ads (RPM) model

### Formule

```text
Ad revenue (€) = (Pageviews / 1000) * RPM
```

Waar:
- **Pageviews** = totale paginaweergaven per maand.
- **RPM** = revenue per 1000 pageviews (niet gelijk aan CPM; is “netto opbrengst per 1000 PV”).

### Wat RPM beïnvloedt
- Geo (BE/NL/EU vs US)
- Device mix (mobile RPM meestal lager)
- Consent rate (zonder consent dalen fill rate / CPM / match rates)
- Viewability + placement + ad density
- Ad provider (AdSense vs GAM vs managed partners)

---

## 2) Affiliate model

Er zijn twee nuttige manieren om affiliate opbrengst te modelleren.

### A) EPC-model (best vroeg in traject)

```text
Affiliate revenue (€) = Visits * Outbound CTR * EPC
```

Waar:
- **Visits** = unieke sessies / bezoekers per maand.
- **Outbound CTR** = % bezoekers dat klikt naar retailer (affiliate link).
- **EPC** = gemiddelde opbrengst per outbound click.

### B) Conversie-model (als je commissie en conversie kent)

```text
Affiliate revenue (€) = Visits * Outbound CTR * Conversion Rate * Commission per Order
```

Waar:
- **Conversion Rate** = % clicks dat eindigt in een aankoop.
- **Commission per Order** = gemiddelde commissie per order.

---

## 3) Scenario’s (conservatief / base / optimistisch)

Onderstaande scenario’s zijn bedoeld als **realistische ranges** totdat je echte analytics + affiliate data hebt.

### A) Ads-only scenario’s
Aannames:
- RPM (BE/EU): €2–€5

| Scenario | Visits/maand | Pages/visit | Pageviews/maand | RPM | Ads €/maand |
|---|---:|---:|---:|---:|---:|
| Conservatief | 5,000 | 2.0 | 10,000 | €2 | €20 |
| Base | 25,000 | 3.0 | 75,000 | €3 | €225 |
| Optimistisch | 100,000 | 4.0 | 400,000 | €5 | €2,000 |

### B) Affiliate scenario’s (EPC-model)
Aannames:
- Outbound CTR: 3% / 7% / 12%
- EPC: €0.05 / €0.12 / €0.25

| Scenario | Visits/maand | Outbound CTR | Clicks | EPC | Affiliate €/maand |
|---|---:|---:|---:|---:|---:|
| Conservatief | 5,000 | 3% | 150 | €0.05 | €7.50 |
| Base | 25,000 | 7% | 1,750 | €0.12 | €210 |
| Optimistisch | 100,000 | 12% | 12,000 | €0.25 | €3,000 |

### C) Combined (ads + affiliate)

| Scenario | Ads €/maand | Affiliate €/maand | Totaal €/maand |
|---|---:|---:|---:|
| Conservatief | €20 | €7.50 | €27.50 |
| Base | €225 | €210 | €435 |
| Optimistisch | €2,000 | €3,000 | €5,000 |

---

## 4) Sensitivity: wat beweegt de naald het meest?

### Ads
- **RPM +€1** op 100k PV/maand → +€100/maand
- **+1 page/visit** (bij 25k visits) → +25k PV/maand

### Affiliate
- Outbound CTR van 5% → 8% bij 25k visits = +750 clicks
- EPC van €0.10 → €0.15 bij 1,750 clicks = +€87.50/maand

---

## 5) Inputs die nodig zijn om dit precies te maken

Vul deze in (ranges zijn ok):

1. **Visits per maand**:
2. **Pages per visit**:
3. **Geo mix** (BE/NL/…):
4. **Device mix** (% mobile/desktop):
5. **Consent rate** (% accepteert analytics/ads):
6. **Ad provider** (AdSense / GAM / Ezoic / …):
7. **RPM** (schatting of gemeten):
8. **Outbound CTR** (% naar retailers):
9. **Affiliate model** (CPS %, fixed bounty, etc.):
10. **Gemiddelde commissie/order** (als bekend):
11. **Conversieratio** (als bekend):

---

## 6) Policy / compliance notes (kort)

- “Forced reload per click om pageviews te verhogen” kan door ad networks beschouwd worden als **invalid traffic / manipulative refresh**.
- Als je ad refresh wil op user interaction, moet dit **policy-conform** en met **rate limiting** gebeuren, afhankelijk van je ad provider.

---

## 7) Volgende stap
Zodra je de inputs invult, kunnen we:
- een **maandelijkse omzet-range** berekenen met jouw echte funnel
- prioriteren welke verbeteringen het meeste opleveren (RPM vs CTR vs pages/visit)
