# SuperPromo België

Belgian deals & folder aggregation site. Scrapes weekly promotional folders from major Belgian supermarkets and displays them with full SEO optimization.

## Stack

- **Framework:** Next.js 16 (App Router, SSG/ISR)
- **Styling:** Tailwind CSS v4
- **Scrapers:** Puppeteer (headless Chrome)
- **Language:** TypeScript
- **Hosting:** Vercel (recommended)

## Getting Started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Scrapers

Scrape all retailers:

```bash
npm run scrape
```

Scrape a single retailer:

```bash
npm run scrape -- albert-heijn
```

Available retailers: `albert-heijn`, `lidl`, `delhaize`, `colruyt`

Scraped data is stored in `data/folders/<retailer>.json`.

## Affiliate Links

Configure affiliate URLs via environment variables. Copy `.env.example` to `.env.local`:

```bash
cp .env.example .env.local
```

Set your affiliate tracking URLs:

```
AFFILIATE_AH=https://tc.tradetracker.net/?c=...
AFFILIATE_LIDL=https://www.awin1.com/cread.php?...
```

When not set, links fall back to the retailer's direct website.

## Project Structure

```
src/
├── app/                    # Next.js pages (App Router)
│   ├── page.tsx            # Homepage
│   ├── folders/
│   │   ├── page.tsx        # All folders overview
│   │   └── [retailer]/     # Per-retailer folder page
│   ├── over-ons/           # About page
│   ├── layout.tsx          # Root layout
│   ├── sitemap.ts          # Auto-generated sitemap
│   └── robots.ts           # robots.txt
├── components/
│   ├── Header.tsx
│   ├── Footer.tsx
│   ├── RetailerCard.tsx
│   ├── FolderViewer.tsx    # Interactive folder page viewer
│   └── JsonLd.tsx          # Structured data components
├── lib/
│   ├── types.ts            # TypeScript interfaces
│   ├── retailers.ts        # Retailer configuration
│   ├── folders.ts          # Folder data access layer
│   └── affiliate.ts        # Affiliate link management
└── scrapers/
    ├── base.ts             # Base scraper class
    ├── albert-heijn.ts
    ├── lidl.ts
    ├── delhaize.ts
    ├── colruyt.ts
    └── run.ts              # CLI runner
data/
└── folders/                # Scraped JSON data (gitignored)
```

## SEO Features

- Per-page metadata with Open Graph tags
- Auto-generated `sitemap.xml` and `robots.txt`
- JSON-LD structured data (WebSite, FAQPage schemas)
- Semantic HTML with proper heading hierarchy
- Dutch (nl-BE) language tags

## Deployment

Deploy to Vercel:

```bash
npx vercel
```

Set environment variables in Vercel dashboard for affiliate links.

## Adding a New Retailer

1. Add entry to `src/lib/retailers.ts`
2. Create scraper in `src/scrapers/<slug>.ts` extending `BaseScraper`
3. Register scraper in `src/scrapers/run.ts`
4. Add affiliate config in `src/lib/affiliate.ts`
5. Add env var to `.env.example`
