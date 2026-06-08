# Google setup runbook — SuperPromo fleet

Account: **nicolas@saspire.org**
Last updated: 2026-06-08

This runbook covers connecting every SuperPromo site to Google Workspace,
Search Console, Analytics (GA4), AdSense, and Google Ads.

The **code side is already done** (see "What the code already does" below) — every
site reads its Google IDs from environment variables. What remains is the
**account side**: creating/verifying properties in Google's consoles, getting the
IDs, and pasting them into each site's Vercel environment. Those steps require
your Google login, your domains, and (for Ads) a payment method, so **you must do
them** — they can't be automated safely on your behalf.

---

## 0. The fleet

| Repo | Live URL today | Vertical | Suggested custom domain |
|------|----------------|----------|--------------------------|
| `superpromobelgiebram` | superpromobelgiebram.vercel.app | supermarket | superpromobelgie.be |
| `FashionSuperPromoBeneluxBram` | (vercel) | fashion | fashion.superpromobenelux.be |
| `BeautySuperPromoBeneluxBram` | (vercel) | beauty | beauty.superpromobenelux.be |
| `HomeGardenSuperPromoBeneluxBram` | (vercel) | home & garden | homegarden.superpromobenelux.be |
| `ElectroSuperPromoBeneluxBram` | (vercel) | electronics | electro.superpromobenelux.be |
| `PetSuperPromoBelgiumBram` | (vercel) | pet | pet.superpromobelgie.be |
| `diysuperpromobelgiebram` | diysuperpromobelgiebram.vercel.app | DIY | diy.superpromobelgie.be |
| `SuperPromoBenelux` | (vercel) | multi-vertical hub | superpromobenelux.be |

Domains above are suggestions — pick whatever you buy. **Decide domains first**:
they gate AdSense entirely and limit the value of Search Console and Ads (see §1).

---

## 1. ⚠️ Prerequisite: custom domains

All sites currently run on **`*.vercel.app`** subdomains. That blocks or limits
the Google tools:

| Tool | Works on `*.vercel.app`? | Notes |
|------|--------------------------|-------|
| **AdSense** | ❌ No | AdSense only approves a **top-level domain you own**. `*.vercel.app` applications are rejected. **Buy domains before applying.** |
| **Search Console** | ⚠️ Partial | You can verify a **URL-prefix** property for `https://x.vercel.app/` via the HTML-tag method, but **not** a Domain property (needs DNS you control). Limited SEO value. |
| **Google Ads** | ⚠️ Works, not ideal | You can run ads to a `vercel.app` URL, but quality/branding and conversion setup are much better on your own domain. Requires billing. |
| **Google Analytics (GA4)** | ✅ Yes | Works on any URL. |
| **Google Workspace** | n/a | Account/domain-level (saspire.org), unrelated to the site URLs. |

**Recommendation:** buy one or more domains (e.g. `superpromobelgie.be`,
`superpromobenelux.be`) and point them at the Vercel projects **before** doing the
AdSense and Search Console steps. In Vercel: Project → Settings → Domains → Add,
then create the DNS records at your registrar.

---

## 2. What the code already does (the env contract)

Every site reads these env vars. Set them in **Vercel → Project → Settings →
Environment Variables** (Production), then redeploy. Nothing is hardcoded; no
secret is committed.

| Env var | Tool | Example value | Notes |
|---------|------|---------------|-------|
| `NEXT_PUBLIC_SITE_NAME` | site identity | `SuperPromo` | used in titles/sitemap |
| `NEXT_PUBLIC_SITE_REGION` | site identity | `België` | |
| `NEXT_PUBLIC_SITE_DOMAIN` | site identity | `superpromobelgie.be` | drives canonical URLs, sitemap, robots |
| `NEXT_PUBLIC_GA4_ID` | Analytics (GA4) | `G-XXXXXXXXXX` | consent-gated |
| `NEXT_PUBLIC_GOOGLE_ADS_ID` | Google Ads | `AW-XXXXXXXXXX` | consent-gated gtag |
| `NEXT_PUBLIC_ADSENSE_CLIENT` | AdSense | `ca-pub-XXXXXXXXXXXXXXXX` | consent-gated |
| `NEXT_PUBLIC_ADSENSE_ADS_TXT` | AdSense | `google.com, pub-XXXX, DIRECT, f08c47fec0942fa0` | served at `/ads.txt` |
| `NEXT_PUBLIC_GSC_VERIFICATION` | Search Console | `abc123...` | the HTML-tag token (content value only) |

Behaviour notes:
- GA4, Ads and AdSense scripts **only load after the visitor accepts cookies**
  (GDPR — handled by the existing cookie-consent gate). Don't expect to see them
  fire until you click "accept".
- `/ads.txt` is generated from `NEXT_PUBLIC_ADSENSE_ADS_TXT`.
- `/sitemap.xml` and `/robots.txt` are generated automatically from
  `NEXT_PUBLIC_SITE_DOMAIN`.
- The Search Console meta tag is emitted automatically once
  `NEXT_PUBLIC_GSC_VERIFICATION` is set and the site is redeployed.

---

## 3. Google Workspace (account-level, saspire.org)

Workspace is **not per-site** — it's your email/identity/admin for the
`saspire.org` domain. You only do this once.

1. Go to <https://workspace.google.com/> → "Get started".
2. Use `saspire.org` as the domain (you must own it / control its DNS).
3. Verify domain ownership via a TXT record at your registrar.
4. Add MX records for Gmail (Workspace shows the exact values).
5. Billing is required → **you must enter payment details yourself.**

> I can't create the account, enter the password, or add billing for you — those
> are account-creation and financial-credential actions. I can walk you through
> each screen if you share it.

---

## 4. Google Analytics (GA4) — per site (works today)

1. <https://analytics.google.com/> → Admin → Create property.
2. Create one property per site (or one property with multiple data streams).
3. Add a **Web** data stream for the site's URL → copy the **Measurement ID**
   (`G-XXXXXXXXXX`).
4. Vercel → that project → Settings → Env Vars → set `NEXT_PUBLIC_GA4_ID` →
   redeploy.
5. Accept cookies on the live site, then confirm "Realtime" shows your visit.

---

## 5. Google Search Console — per site

1. <https://search.google.com/search-console> → Add property.
   - With a custom domain: choose **Domain** property → add the TXT record at your
     registrar (best — covers http/https/www).
   - On `*.vercel.app` (no custom domain yet): choose **URL prefix** →
     `https://<repo>.vercel.app/` → method **HTML tag**.
2. For the HTML-tag method, Google shows
   `<meta name="google-site-verification" content="TOKEN">`. Copy **only the
   TOKEN**.
3. Vercel → project → Env Vars → `NEXT_PUBLIC_GSC_VERIFICATION = TOKEN` →
   **redeploy** (the tag only appears after a fresh build).
4. Back in Search Console → **Verify**.
5. Then **Sitemaps** → submit `sitemap.xml` (the site already serves it).

---

## 6. Google AdSense — per site (needs a custom domain)

1. **Do this only after the site is on a custom domain** (see §1).
2. <https://adsense.google.com/> → sign up with the site's domain.
3. AdSense gives you a **publisher ID** `ca-pub-XXXXXXXXXXXXXXXX`.
4. Vercel → Env Vars:
   - `NEXT_PUBLIC_ADSENSE_CLIENT = ca-pub-XXXXXXXXXXXXXXXX`
   - `NEXT_PUBLIC_ADSENSE_ADS_TXT = google.com, pub-XXXXXXXXXXXXXXXX, DIRECT, f08c47fec0942fa0`
     (AdSense shows your exact ads.txt line under Sites → ads.txt).
5. Redeploy. Verify `https://yourdomain/ads.txt` returns the line.
6. AdSense reviews the site (can take days to weeks). Accepting AdSense's terms
   and any payments setup is **your** action.

---

## 7. Google Ads — per site / per campaign (needs billing)

1. <https://ads.google.com/> → create account (one Ads account can manage all
   sites).
2. **Billing/payment method is required → you must enter it yourself.**
3. Tools → Conversions → create a conversion → it gives a tag id `AW-XXXXXXXXXX`.
4. Vercel → Env Vars → `NEXT_PUBLIC_GOOGLE_ADS_ID = AW-XXXXXXXXXX` → redeploy.
5. Link Google Ads ↔ GA4 (Admin → Product links) so GA4 audiences/conversions are
   usable in Ads.

---

## 8. Per-site checklist

Copy this block per site:

```
Site: ____________________   Domain: ____________________
[ ] Custom domain bought + added in Vercel + DNS live
[ ] GA4 property created            -> NEXT_PUBLIC_GA4_ID
[ ] Search Console verified         -> NEXT_PUBLIC_GSC_VERIFICATION (+ sitemap submitted)
[ ] AdSense approved                -> NEXT_PUBLIC_ADSENSE_CLIENT + NEXT_PUBLIC_ADSENSE_ADS_TXT
[ ] Google Ads conversion created   -> NEXT_PUBLIC_GOOGLE_ADS_ID
[ ] Redeployed after setting env vars
[ ] Verified: cookies accepted -> GA4 realtime shows hit; /ads.txt correct
```

---

## 9. What I (the assistant) can and can't do for you

**Can do / already did:** all the code wiring (GA4, Ads, AdSense, ads.txt,
Search Console meta, sitemap/robots), env documentation, and this runbook. I can
also drive the browser to walk through the consoles **with you logged in**, fill
non-sensitive fields, and guide each step.

**Can't do (you must):** create Google accounts, enter passwords, enter
billing/payment info, accept terms of service, or grant OAuth permissions. These
are restricted actions I won't perform on your behalf.

---

## 10. Known follow-ups (not Google, but related)

- **Repo bloat:** Fashion/Beauty/Electro/Pet/diy repos have committed `.next*`
  build output (100–200 MB each). Add `.next*` to `.gitignore` and
  `git rm -r --cached` them to shrink the repos and speed up clones/deploys.
- **`SuperPromoBenelux`** has a minimal `layout.tsx` that does **not** render
  `AnalyticsGate`/`AdSenseGate`/cookie consent (the components exist but aren't
  wired in). It will emit the Search Console tag (added) but won't load GA4/Ads/
  AdSense until its layout is brought up to the template. Flag if you want this
  done.
