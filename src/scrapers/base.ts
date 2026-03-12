import fs from "fs";
import path from "path";
import puppeteer, { Page, Browser } from "puppeteer";
import { Folder, Deal, ScrapedData, ContentSource } from "../lib/types";

const DATA_DIR = path.join(process.cwd(), "data", "folders");
const SCREENSHOT_DIR = path.join(process.cwd(), "public", "screenshots");

const DEFAULT_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

// ---------------------------------------------------------------------------
// Intermediary result types used during the scrape pipeline
// ---------------------------------------------------------------------------

export interface EmbedResult {
  url: string;
  source: ContentSource;
}

export interface PdfResult {
  url: string;
}

export interface DealResult {
  deals: Deal[];
  source: ContentSource;
}

export interface ScreenshotResult {
  pages: { pageNumber: number; imagePath: string }[];
}

export interface ScrapeContext {
  page: Page;
  browser: Browser;
  interceptedUrls: InterceptedUrls;
  sourceUrls: string[];
  methods: ContentSource[];
}

export interface InterceptedUrls {
  pdfs: string[];
  publitas: string[];
  ipaper: string[];
  yumpu: string[];
  issuu: string[];
  apiJson: string[];
  images: string[];
}

// ---------------------------------------------------------------------------
// Configuration each retailer scraper provides
// ---------------------------------------------------------------------------

export interface RetailerConfig {
  slug: string;
  name: string;
  /** Primary page(s) to scrape, tried in order */
  folderUrls: string[];
  /** Additional pages to look for deals */
  dealUrls?: string[];
  /** CSS selectors for cookie consent dismiss buttons */
  cookieSelectors?: string[];
  /** CSS selectors for deal cards/items on HTML pages */
  dealCardSelectors?: string[];
  /** CSS selectors for price elements inside a deal card */
  priceSelectors?: PriceSelectors;
  /** Folder title override */
  folderTitle?: string;
  /** CSS selectors for elements to click before looking for embeds (e.g. "open folder" buttons) */
  clickSelectors?: string[];
  /** Regex patterns for folder links to follow (e.g. cross-domain folder subdomains) */
  folderLinkPatterns?: RegExp[];
}

export interface PriceSelectors {
  /** Selector for the deal card container */
  card: string;
  /** Selector for product name (relative to card) */
  name: string;
  /** Selector for original/old price (relative to card) */
  originalPrice?: string;
  /** Selector for promo/new price (relative to card) */
  promoPrice?: string;
  /** Selector for discount label (relative to card) */
  discount?: string;
  /** Selector for product image (relative to card) */
  image?: string;
  /** Selector for product description (relative to card) */
  description?: string;
  /** Selector for product category (relative to card) */
  category?: string;
}

// ---------------------------------------------------------------------------
// Base scraper with exhaustive fallback chain
// ---------------------------------------------------------------------------

export abstract class BaseScraper {
  abstract config: RetailerConfig;

  get retailerSlug(): string {
    return this.config.slug;
  }
  get retailerName(): string {
    return this.config.name;
  }

  // ---- Main entry point ---------------------------------------------------

  async run(): Promise<void> {
    this.log("Starting scrape...");

    const browser = await puppeteer.launch({
      headless: true,
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });

    try {
      const page = await browser.newPage();
      await page.setUserAgent(DEFAULT_USER_AGENT);
      await page.setViewport({ width: 1440, height: 900 });

      const intercepted = this.createInterceptedUrls();
      this.setupNetworkInterception(page, intercepted);

      const ctx: ScrapeContext = {
        page,
        browser,
        interceptedUrls: intercepted,
        sourceUrls: [],
        methods: [],
      };

      // ---- Fallback chain (each method tries, passes to next if empty) ----
      const folders: Folder[] = [];
      const allDeals: Deal[] = [];

      for (const url of this.config.folderUrls) {
        this.log(`Navigating to ${url}`);
        try {
          await page.goto(url, { waitUntil: "networkidle2", timeout: 30000 });
        } catch (e) {
          this.log(`Navigation failed for ${url}, trying next...`);
          continue;
        }

        ctx.sourceUrls.push(url);

        // Step 0: Dismiss cookie consent
        await this.dismissCookieConsent(page);

        // Step 1: Follow folder-specific links iteratively (up to 3 levels)
        //         Stop early if an embed is found at the current page.
        //         If a folderLinkPattern match is followed, treat that URL as
        //         the viewer itself (fallback embed if no iframe is detected).
        let embed: EmbedResult | null = null;
        let patternMatchedUrl: string | null = null;

        for (let depth = 0; depth < 3; depth++) {
          // Check if current page already has an embed before following more links
          embed = await this.findEmbed(ctx);
          if (embed) break;

          // If we already reached a pattern-matched URL, stop following more links
          if (patternMatchedUrl) break;

          const folderLink = await this.findFolderLink(page);
          if (!folderLink) break;

          // Skip hash-only variations of URLs we already visited
          const canonicalLink = folderLink.split("#")[0];
          if (ctx.sourceUrls.some((u) => u.split("#")[0] === canonicalLink)) break;

          // Track if this link was matched by a folderLinkPattern
          const isPatternMatch = (this.config.folderLinkPatterns || []).some((p) =>
            p.test(folderLink)
          );

          this.log(`Following folder link: ${folderLink}`);
          try {
            await page.goto(folderLink, { waitUntil: "networkidle2", timeout: 30000 });
          } catch {
            this.log(`Navigation failed for folder link: ${folderLink}`);
            break;
          }
          await this.dismissCookieConsent(page);
          ctx.sourceUrls.push(folderLink);

          if (isPatternMatch) {
            patternMatchedUrl = folderLink;
          }
        }

        // Step 1b: Click interactive elements to reveal folder viewers (only if no embed yet)
        if (!embed && this.config.clickSelectors) {
          for (const selector of this.config.clickSelectors) {
            try {
              const el = await page.$(selector);
              if (el) {
                this.log(`Clicking: ${selector}`);
                await el.click();
                await new Promise((r) => setTimeout(r, 2000));
                await page.waitForNetworkIdle({ timeout: 5000 }).catch(() => {});
              }
            } catch {
              this.log(`Click failed for: ${selector}`);
            }
          }
        }

        // Step 2: Try embed detection (only if not already found in step 1)
        if (!embed) embed = await this.findEmbed(ctx);

        // Step 2b: Fallback — if we followed a folderLinkPattern URL and still
        //          have no iframe embed, use that URL directly as the embed.
        //          The config explicitly declares it's a viewer page.
        if (!embed && patternMatchedUrl) {
          this.log(`Using pattern-matched URL as embed: ${patternMatchedUrl}`);
          const source = this.detectEmbedSource(patternMatchedUrl);
          const finalSource: ContentSource = source !== "unknown" ? source : "publitas";
          if (!ctx.methods.includes(finalSource)) ctx.methods.push(finalSource);
          embed = { url: patternMatchedUrl, source: finalSource };
        }

        // Step 3: Try PDF detection
        let pdf = await this.findPdf(ctx);

        // If we found an embed but no PDF on the outer page, try the embed URL directly.
        // This helps for viewers that only expose PDF links/requests from inside the viewer.
        if (!pdf && embed?.url) {
          const pdfFromEmbed = await this.findPdfFromEmbedUrl(ctx, embed.url);
          if (pdfFromEmbed) pdf = pdfFromEmbed;
        }

        // Step 4: Try JSON-LD structured data extraction
        const jsonLdDeals = await this.extractJsonLd(ctx);
        if (jsonLdDeals.deals.length > 0) {
          allDeals.push(...jsonLdDeals.deals);
          if (!ctx.methods.includes(jsonLdDeals.source)) ctx.methods.push(jsonLdDeals.source);
        }

        // Step 5: Try HTML deal extraction
        const htmlDeals = await this.extractDealsFromHtml(ctx);
        if (htmlDeals.deals.length > 0) {
          allDeals.push(...htmlDeals.deals);
          if (!ctx.methods.includes(htmlDeals.source)) ctx.methods.push(htmlDeals.source);
        }

        // Step 6: Try API response extraction (from intercepted JSON)
        const apiDeals = await this.extractDealsFromApi(ctx);
        if (apiDeals.deals.length > 0) {
          allDeals.push(...apiDeals.deals);
          if (!ctx.methods.includes(apiDeals.source)) ctx.methods.push(apiDeals.source);
        }

        // Step 7: Screenshot fallback (when no embed/pdf is available)
        let screenshots: ScreenshotResult | null = null;
        if (!embed && !pdf) {
          screenshots = await this.takeScreenshots(ctx);
          if (screenshots.pages.length > 0 && !ctx.methods.includes("screenshot")) {
            ctx.methods.push("screenshot");
          }
        }

        // ---- Build folder object ----
        const dates = this.getCurrentWeekDates();
        const contentSource: ContentSource = embed?.source || (pdf ? "pdf" : screenshots ? "screenshot" : allDeals.length > 0 ? "html" : "unknown");

        const folderPages = screenshots
          ? screenshots.pages.map((p) => ({
              pageNumber: p.pageNumber,
              imageUrl: p.imagePath,
              deals: [] as Deal[],
            }))
          : [];

        const folder: Folder = {
          id: this.generateFolderId("folder"),
          retailerSlug: this.retailerSlug,
          title: this.config.folderTitle || `${this.retailerName} folder van de week`,
          validFrom: dates.from,
          validUntil: dates.until,
          pageCount: folderPages.length,
          thumbnailUrl: folderPages[0]?.imageUrl || "",
          pages: folderPages,
          embedUrl: embed?.url,
          pdfUrl: pdf?.url,
          contentSource,
          scrapedAt: new Date().toISOString(),
        };

        folders.push(folder);
        break; // First successful URL wins
      }

      // ---- Scrape additional deal pages ----
      if (this.config.dealUrls) {
        for (const dealUrl of this.config.dealUrls) {
          this.log(`Scraping deals from ${dealUrl}`);
          try {
            await page.goto(dealUrl, { waitUntil: "networkidle2", timeout: 30000 });
            await this.dismissCookieConsent(page);

            const htmlDeals = await this.extractDealsFromHtml(ctx);
            allDeals.push(...htmlDeals.deals);

            const jsonLdDeals = await this.extractJsonLd(ctx);
            allDeals.push(...jsonLdDeals.deals);
          } catch {
            this.log(`Failed to scrape deals from ${dealUrl}`);
          }
        }
      }

      // ---- Deduplicate deals ----
      const uniqueDeals = this.deduplicateDeals(allDeals);

      // ---- Persist ----
      this.log(`Results: ${folders.length} folder(s), ${uniqueDeals.length} deal(s), methods: [${ctx.methods.join(", ")}]`);

      const data: ScrapedData = {
        retailer: this.retailerSlug,
        folders,
        deals: uniqueDeals,
        scrapedAt: new Date().toISOString(),
        sourceUrls: ctx.sourceUrls,
        methods: ctx.methods,
      };

      if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
      const filePath = path.join(DATA_DIR, `${this.retailerSlug}.json`);

      const existing = this.readExistingData(filePath);
      if (existing) {
        const same =
          JSON.stringify(this.normalizeForComparison(existing)) ===
          JSON.stringify(this.normalizeForComparison(data));
        if (same) {
          this.log("No changes detected; skipping JSON write");
          return;
        }
      }

      fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf-8");
      this.log(`Saved to ${filePath}`);
    } catch (error) {
      this.log(`Scrape failed: ${error}`);
      throw error;
    } finally {
      await browser.close();
    }
  }

  // ---- Step 0: Cookie consent dismissal ----------------------------------

  protected async dismissCookieConsent(page: Page): Promise<void> {
    const selectors = [
      ...(this.config.cookieSelectors || []),
      // Generic consent button selectors (Dutch, French, English)
      'button[id*="accept"]',
      'button[class*="accept"]',
      'a[id*="accept"]',
      '[data-testid*="accept"]',
      'button:has-text("Accepteren")',
      'button:has-text("Alles accepteren")',
      'button:has-text("Tout accepter")',
      'button:has-text("Accept all")',
      'button:has-text("Akkoord")',
      'button:has-text("OK")',
      '#onetrust-accept-btn-handler',
      '.cookie-accept',
      '[class*="cookie"] button:first-of-type',
      '[class*="consent"] button',
      '[class*="gdpr"] button',
    ];

    for (const selector of selectors) {
      try {
        // :has-text is not standard CSS; handle with page.evaluate text matching
        if (selector.includes(":has-text(")) {
          const text = selector.match(/:has-text\("(.+?)"\)/)?.[1];
          const tag = selector.split(":")[0] || "button";
          if (text) {
            const clicked = await page.evaluate(
              (tagName: string, searchText: string) => {
                const els = document.querySelectorAll(tagName);
                for (const el of els) {
                  if (el.textContent?.includes(searchText)) {
                    (el as HTMLElement).click();
                    return true;
                  }
                }
                return false;
              },
              tag,
              text
            );
            if (clicked) {
              this.log(`Dismissed cookie consent via text: "${text}"`);
              await page.waitForNetworkIdle({ timeout: 3000 }).catch(() => {});
              return;
            }
          }
          continue;
        }

        const el = await page.$(selector);
        if (el) {
          await el.click();
          this.log(`Dismissed cookie consent via: ${selector}`);
          await page.waitForNetworkIdle({ timeout: 3000 }).catch(() => {});
          return;
        }
      } catch {
        // Selector didn't match, try next
      }
    }
  }

  // ---- Step 1: Find folder-specific link ---------------------------------

  protected async findFolderLink(page: Page): Promise<string | null> {
    const patterns = (this.config.folderLinkPatterns || []).map((p) => p.source);

    return page.evaluate(
      (patterns: string[]) => {
        const keywords = ["folder", "leaflet", "flyer", "brochure", "promofolder"];
        const links = Array.from(document.querySelectorAll("a[href]"));

        // Priority 1: match explicit patterns from config (e.g. cross-domain folder subdomains)
        if (patterns.length > 0) {
          for (const link of links) {
            const href = (link as HTMLAnchorElement).href;
            if (patterns.some((p) => new RegExp(p).test(href))) {
              return href;
            }
          }
        }

        // Priority 2: match generic folder keywords in href or link text
        for (const link of links) {
          const href = (link as HTMLAnchorElement).href.toLowerCase();
          const text = (link.textContent || "").toLowerCase();
          if (keywords.some((kw) => href.includes(kw) || text.includes(kw))) {
            return (link as HTMLAnchorElement).href;
          }
        }
        return null;
      },
      patterns
    );
  }

  // ---- Step 2: Embed detection -------------------------------------------

  protected async findEmbed(ctx: ScrapeContext): Promise<EmbedResult | null> {
    const { page, interceptedUrls } = ctx;

    // Actively wait for known embed iframes to appear (handles lazy loading)
    const embedSelector = 'iframe[src*="publitas"], iframe[src*="ipaper"], iframe[src*="yumpu"], iframe[src*="issuu"], iframe[src*="flipbook"]';
    try {
      await page.waitForSelector(embedSelector, { timeout: 5000 });
    } catch {
      // No known embed iframe appeared within timeout — continue with fallbacks
    }

    // Check iframes on the page
    const iframeSrc = await page.evaluate(() => {
      const trackingKeywords = [
        "about:", "javascript:", "google", "facebook", "doubleclick",
        "analytics", "tag", "consent", "cookie", "onetrust", "kameleoon",
        "hotjar", "tealium", "utag",
      ];
      const iframes = document.querySelectorAll("iframe[src]");

      // Priority: known embed platforms
      for (const iframe of iframes) {
        const src = (iframe as HTMLIFrameElement).src;
        if (
          src.includes("publitas") ||
          src.includes("ipaper") ||
          src.includes("yumpu") ||
          src.includes("issuu") ||
          src.includes("flipbook")
        ) {
          return src;
        }
      }

      // Fallback: any non-tracking iframe with a real URL
      for (const iframe of iframes) {
        const src = (iframe as HTMLIFrameElement).src;
        if (
          src.startsWith("http") &&
          !trackingKeywords.some((kw) => src.includes(kw))
        ) {
          return src;
        }
      }
      return null;
    });

    if (iframeSrc) {
      const source = this.detectEmbedSource(iframeSrc);
      const url = this.normalizeEmbedUrl(iframeSrc, source);
      this.log(`Found iframe embed (${source}): ${url}`);
      if (!ctx.methods.includes(source)) ctx.methods.push(source);
      return { url, source };
    }

    // Check intercepted network requests
    for (const url of interceptedUrls.publitas) {
      const normalized = this.normalizeEmbedUrl(url, "publitas");
      this.log(`Found Publitas from network: ${normalized}`);
      if (!ctx.methods.includes("publitas")) ctx.methods.push("publitas");
      return { url: normalized, source: "publitas" };
    }
    for (const url of interceptedUrls.ipaper) {
      this.log(`Found iPaper from network: ${url}`);
      if (!ctx.methods.includes("ipaper")) ctx.methods.push("ipaper");
      return { url, source: "ipaper" };
    }
    for (const url of interceptedUrls.yumpu) {
      this.log(`Found Yumpu from network: ${url}`);
      if (!ctx.methods.includes("yumpu")) ctx.methods.push("yumpu");
      return { url, source: "yumpu" };
    }
    for (const url of interceptedUrls.issuu) {
      this.log(`Found Issuu from network: ${url}`);
      if (!ctx.methods.includes("issuu")) ctx.methods.push("issuu");
      return { url, source: "issuu" };
    }

    // Check data attributes for embed URLs
    const dataEmbed = await page.evaluate(() => {
      const selectors = [
        "[data-folder-url]",
        "[data-embed-url]",
        "[data-publication-url]",
        "[data-flipbook-url]",
        "[data-viewer-url]",
      ];
      for (const sel of selectors) {
        const el = document.querySelector(sel);
        if (el) {
          return (
            (el as HTMLElement).dataset.folderUrl ||
            (el as HTMLElement).dataset.embedUrl ||
            (el as HTMLElement).dataset.publicationUrl ||
            (el as HTMLElement).dataset.flipbookUrl ||
            (el as HTMLElement).dataset.viewerUrl ||
            null
          );
        }
      }
      return null;
    });

    if (dataEmbed) {
      const source = this.detectEmbedSource(dataEmbed);
      this.log(`Found embed from data attribute (${source}): ${dataEmbed}`);
      if (!ctx.methods.includes(source)) ctx.methods.push(source);
      return { url: dataEmbed, source };
    }

    return null;
  }

  protected async findPdfFromEmbedUrl(ctx: ScrapeContext, embedUrl: string): Promise<PdfResult | null> {
    const intercepted = this.createInterceptedUrls();
    const page = await ctx.browser.newPage();
    try {
      await page.setUserAgent(DEFAULT_USER_AGENT);
      await page.setViewport({ width: 1440, height: 900 });
      this.setupNetworkInterception(page, intercepted);

      await page.goto(embedUrl, { waitUntil: "networkidle2", timeout: 30000 });
      await this.dismissCookieConsent(page);
      await page.waitForNetworkIdle({ timeout: 5000 }).catch(() => {});

      return await this.findPdf({ ...ctx, page, interceptedUrls: intercepted });
    } catch {
      return null;
    } finally {
      await page.close().catch(() => {});
    }
  }

  // ---- Step 3: PDF detection ---------------------------------------------

  protected async findPdf(ctx: ScrapeContext): Promise<PdfResult | null> {
    const { page, interceptedUrls } = ctx;

    // Check intercepted PDF URLs
    if (interceptedUrls.pdfs.length > 0) {
      const url = interceptedUrls.pdfs[0];
      this.log(`Found PDF from network: ${url}`);
      if (!ctx.methods.includes("pdf")) ctx.methods.push("pdf");
      return { url };
    }

    // Check page for PDF links (must be actual .pdf files)
    const pdfUrl = await page.evaluate(() => {
      const links = Array.from(document.querySelectorAll("a[href]"));
      for (const link of links) {
        const href = (link as HTMLAnchorElement).href;
        if (href.match(/\.pdf($|\?|#)/i)) return href;
      }
      // Check for download buttons that explicitly mention PDF
      for (const link of links) {
        const text = (link.textContent || "").toLowerCase();
        const href = (link as HTMLAnchorElement).href;
        if (
          text.includes("download") &&
          text.includes("pdf") &&
          href.startsWith("http")
        ) {
          return href;
        }
      }
      return null;
    });

    if (pdfUrl) {
      this.log(`Found PDF link: ${pdfUrl}`);
      if (!ctx.methods.includes("pdf")) ctx.methods.push("pdf");
      return { url: pdfUrl };
    }

    return null;
  }

  // ---- Step 4: JSON-LD / structured data extraction ----------------------

  protected async extractJsonLd(ctx: ScrapeContext): Promise<DealResult> {
    const { page } = ctx;
    const dates = this.getCurrentWeekDates();

    const deals = await page.evaluate(
      (retailerSlug: string, validFrom: string, validUntil: string) => {
        const results: any[] = [];
        const scripts = document.querySelectorAll('script[type="application/ld+json"]');

        scripts.forEach((script) => {
          try {
            const data = JSON.parse(script.textContent || "");
            const items = Array.isArray(data) ? data : [data];

            for (const item of items) {
              // Product schema
              if (item["@type"] === "Product" || item["@type"] === "Offer") {
                const offer = item.offers || item;
                results.push({
                  id: `jsonld-${results.length}`,
                  product: item.name || offer.name || "Unknown",
                  originalPrice: offer.highPrice ? parseFloat(offer.highPrice) : undefined,
                  promoPrice: offer.price ? parseFloat(offer.price) : undefined,
                  discount: offer.discount || undefined,
                  description: item.description || undefined,
                  imageUrl: item.image || undefined,
                  validFrom,
                  validUntil,
                  retailerSlug,
                });
              }

              // ItemList with offers
              if (item["@type"] === "ItemList" && item.itemListElement) {
                for (const listItem of item.itemListElement) {
                  const product = listItem.item || listItem;
                  const offer = product.offers || product;
                  if (product.name) {
                    results.push({
                      id: `jsonld-${results.length}`,
                      product: product.name,
                      originalPrice: offer.highPrice ? parseFloat(offer.highPrice) : undefined,
                      promoPrice: offer.price ? parseFloat(offer.price) : undefined,
                      description: product.description || undefined,
                      imageUrl: product.image || undefined,
                      validFrom,
                      validUntil,
                      retailerSlug,
                    });
                  }
                }
              }
            }
          } catch {
            // Invalid JSON-LD, skip
          }
        });

        return results;
      },
      this.retailerSlug,
      dates.from,
      dates.until
    );

    if (deals.length > 0) this.log(`Extracted ${deals.length} deal(s) from JSON-LD`);
    return { deals: deals as Deal[], source: "html" };
  }

  // ---- Step 5: HTML deal extraction --------------------------------------

  protected async extractDealsFromHtml(ctx: ScrapeContext): Promise<DealResult> {
    const { page } = ctx;
    const ps = this.config.priceSelectors;
    if (!ps) return { deals: [], source: "html" };

    const dates = this.getCurrentWeekDates();

    const deals = await page.evaluate(
      (cardSel: string, nameSel: string, origPriceSel: string | undefined, promoPriceSel: string | undefined, discountSel: string | undefined, imageSel: string | undefined, descSel: string | undefined, catSel: string | undefined, retailerSlug: string, validFrom: string, validUntil: string) => {
        const cards = document.querySelectorAll(cardSel);
        const results: any[] = [];

        cards.forEach((card, i) => {
          const nameEl = card.querySelector(nameSel);
          const name = nameEl?.textContent?.trim();
          if (!name) return;

          const parsePrice = (el: Element | null): number | undefined => {
            if (!el) return undefined;
            const text = el.textContent?.replace(/[^\d.,]/g, "").replace(",", ".") || "";
            const val = parseFloat(text);
            return isNaN(val) ? undefined : val;
          };

          const origEl = origPriceSel ? card.querySelector(origPriceSel) : null;
          const promoEl = promoPriceSel ? card.querySelector(promoPriceSel) : null;
          const discountEl = discountSel ? card.querySelector(discountSel) : null;
          const imageEl = imageSel ? card.querySelector(imageSel) : null;
          const descEl = descSel ? card.querySelector(descSel) : null;
          const catEl = catSel ? card.querySelector(catSel) : null;

          results.push({
            id: `html-${i}`,
            product: name,
            originalPrice: parsePrice(origEl),
            promoPrice: parsePrice(promoEl),
            discount: discountEl?.textContent?.trim() || undefined,
            description: descEl?.textContent?.trim() || undefined,
            category: catEl?.textContent?.trim() || undefined,
            imageUrl: imageEl ? (imageEl as HTMLImageElement).src || (imageEl as HTMLImageElement).dataset.src : undefined,
            validFrom,
            validUntil,
            retailerSlug,
          });
        });

        return results;
      },
      ps.card, ps.name, ps.originalPrice, ps.promoPrice, ps.discount, ps.image, ps.description, ps.category, this.retailerSlug, dates.from, dates.until
    );

    if (deals.length > 0) this.log(`Extracted ${deals.length} deal(s) from HTML`);
    return { deals: deals as Deal[], source: "html" };
  }

  // ---- Step 6: API response extraction -----------------------------------

  protected async extractDealsFromApi(ctx: ScrapeContext): Promise<DealResult> {
    // Subclasses can override to parse intercepted API JSON
    // Default implementation: no-op
    return { deals: [], source: "api" };
  }

  // ---- Step 7: Screenshot fallback ---------------------------------------

  protected async takeScreenshots(ctx: ScrapeContext): Promise<ScreenshotResult> {
    const { page } = ctx;
    this.log("Taking screenshot fallback...");

    if (!fs.existsSync(SCREENSHOT_DIR)) fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });

    const filename = `${this.generateFolderId("screenshot-p1")}.png`;
    const filepath = path.join(SCREENSHOT_DIR, filename);

    await page.screenshot({ path: filepath, fullPage: true });
    this.log(`Screenshot saved: ${filepath}`);

    return {
      pages: [
        {
          pageNumber: 1,
          imagePath: `/screenshots/${filename}`,
        },
      ],
    };
  }

  // ---- Network interception setup ----------------------------------------

  protected setupNetworkInterception(page: Page, intercepted: InterceptedUrls): void {
    page.on("response", (response) => {
      const url = response.url();
      const contentType = response.headers()["content-type"] || "";

      // PDFs
      if (url.match(/\.pdf($|\?)/i) || contentType.includes("application/pdf")) {
        if (!intercepted.pdfs.includes(url)) intercepted.pdfs.push(url);
      }

      // Publitas – only capture actual viewer URLs from view.publitas.com
      if (url.includes("view.publitas.com")) {
        try {
          const parsed = new URL(url);
          const parts = parsed.pathname.split("/").filter(Boolean);
          const excludedPaths = ["branding", "custom-menu", "analytics", "stats"];
          if (
            parts.length >= 2 &&
            !parts.some((p) => excludedPaths.includes(p))
          ) {
            const viewerUrl = `${parsed.origin}/${parts[0]}/${parts[1]}/`;
            if (!intercepted.publitas.includes(viewerUrl)) intercepted.publitas.push(viewerUrl);
          }
        } catch {
          // skip malformed URLs
        }
      }

      // iPaper
      if (url.includes("ipaper.io") || url.includes("ipapercms.dk")) {
        if (!intercepted.ipaper.includes(url)) intercepted.ipaper.push(url);
      }

      // Yumpu
      if (url.includes("yumpu.com")) {
        if (!intercepted.yumpu.includes(url)) intercepted.yumpu.push(url);
      }

      // Issuu – only capture the stacks embed URL or publication reader URL
      if (
        url.includes("issuu.com") &&
        (url.includes("/stacks/") || url.includes("e.issuu.com")) &&
        url.endsWith(".html")
      ) {
        if (!intercepted.issuu.includes(url)) intercepted.issuu.push(url);
      }

      // JSON API responses (potential deal data)
      if (
        contentType.includes("application/json") &&
        (url.includes("promo") ||
          url.includes("deal") ||
          url.includes("offer") ||
          url.includes("folder") ||
          url.includes("product") ||
          url.includes("flyer") ||
          url.includes("leaflet"))
      ) {
        if (!intercepted.apiJson.includes(url)) intercepted.apiJson.push(url);
      }
    });
  }

  // ---- Helpers -----------------------------------------------------------

  protected createInterceptedUrls(): InterceptedUrls {
    return { pdfs: [], publitas: [], ipaper: [], yumpu: [], issuu: [], apiJson: [], images: [] };
  }

  private detectEmbedSource(url: string): ContentSource {
    if (url.includes("publitas")) return "publitas";
    if (url.includes("ipaper")) return "ipaper";
    if (url.includes("yumpu")) return "yumpu";
    if (url.includes("issuu")) return "issuu";
    return "unknown";
  }

  protected normalizeEmbedUrl(url: string, source: ContentSource): string {
    if (source === "publitas") {
      // Ensure embedded mode parameter
      if (!url.includes("publitas_embed")) {
        const hasPage = url.includes("/page/");
        const base = hasPage ? url : `${url.replace(/\/$/, "")}/page/1`;
        const sep = base.includes("?") ? "&" : "?";
        return `${base}${sep}publitas_embed=embedded`;
      }
    }
    return url;
  }

  protected generateFolderId(suffix: string): string {
    const now = new Date();
    const week = this.getWeekNumber(now);
    return `${this.retailerSlug}-${now.getFullYear()}-w${week}-${suffix}`;
  }

  protected getWeekNumber(date: Date): number {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  }

  protected getCurrentWeekDates(): { from: string; until: string } {
    const now = new Date();
    const dayOfWeek = now.getDay();
    const monday = new Date(now);
    monday.setDate(now.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    return {
      from: monday.toISOString().split("T")[0],
      until: sunday.toISOString().split("T")[0],
    };
  }

  private deduplicateDeals(deals: Deal[]): Deal[] {
    const seen = new Set<string>();
    return deals.filter((d) => {
      const key = `${d.product.toLowerCase().trim()}-${d.promoPrice ?? ""}-${d.retailerSlug}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  protected log(msg: string): void {
    console.log(`[${this.retailerName}] ${msg}`);
  }

  private readExistingData(filePath: string): ScrapedData | null {
    if (!fs.existsSync(filePath)) return null;
    try {
      const raw = fs.readFileSync(filePath, "utf-8");
      return JSON.parse(raw) as ScrapedData;
    } catch {
      return null;
    }
  }

  private normalizeForComparison(data: ScrapedData): unknown {
    return {
      retailer: data.retailer,
      sourceUrls: data.sourceUrls,
      methods: data.methods,
      folders: data.folders.map((f) => {
        const { scrapedAt: _folderScrapedAt, ...rest } = f as any;
        return rest;
      }),
      deals: data.deals,
    };
  }
}
