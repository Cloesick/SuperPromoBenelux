import fs from "fs";
import path from "path";
import crypto from "node:crypto";
import { storePageImage } from "./pageStorage";

/**
 * Outcome of capturing one viewer page.
 *  written   — a new page; `url` is what the folder JSON should render
 *  duplicate — the viewer clamped past the last page; stop capturing
 *  blank     — nothing painted; skip this page but keep going
 */
type CaptureResult =
	| { status: "written"; url: string; thumbUrl?: string }
	| { status: "duplicate" }
	| { status: "blank" };
// rebrowser-puppeteer is a drop-in Puppeteer fork that patches the CDP
// `Runtime.Enable` leak — the main signal modern anti-bot services use to
// detect automation, and one that navigator.webdriver patching cannot hide.
import puppeteer, { Page, Browser } from "rebrowser-puppeteer";
import { Folder, Deal, ScrapedData, ContentSource } from "../lib/types";
import { syncDealsToDb } from "../lib/productsDb";
import { extractDealsFromPdf } from "./extractDealsFromText";

const DATA_DIR = path.join(process.cwd(), "data", "folders");
const SCREENSHOT_DIR = path.join(process.cwd(), "public", "screenshots");

// Full-resolution captures kept for OCR only. Deliberately outside public/ so
// they are never served: visitors get the optimised copy in SCREENSHOT_DIR.
const OCR_SOURCE_DIR = path.join(process.cwd(), "data", "ocr-src");

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
	pages: { pageNumber: number; imagePath: string; thumbPath?: string }[];
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

	/**
	 * Pause between sequential navigations.
	 *
	 * Request *rate* is a stronger blocking signal than fingerprint for most
	 * retailers — bursts of back-to-back `networkidle2` loads look nothing like
	 * a human. Applied before each navigation in a multi-request loop.
	 *
	 * Configure with SCRAPE_DELAY_MS (default 1500). Set to 0 to disable,
	 * e.g. in tests. Actual delay is randomised ±40% to avoid a fixed cadence.
	 */
	protected async politeDelay(): Promise<void> {
		const base = parseInt(process.env.SCRAPE_DELAY_MS ?? "1500", 10);
		if (!Number.isFinite(base) || base <= 0) return;
		const jitter = base * 0.4;
		const ms = Math.round(base - jitter + Math.random() * jitter * 2);
		await new Promise((r) => setTimeout(r, ms));
	}

	protected async preparePage(page: Page): Promise<void> {
		await page.setUserAgent(DEFAULT_USER_AGENT);
		await page.setViewport({ width: 1440, height: 900 });
		try {
			await page.evaluateOnNewDocument(() => {
				// Basic webdriver evasion
				Object.defineProperty(navigator, "webdriver", { get: () => false });
				// Pretend to have some plugins and languages
				Object.defineProperty(navigator, "plugins", {
					get: () => [1, 2, 3],
				});
				Object.defineProperty(navigator, "languages", {
					get: () => ["nl-BE", "nl", "en"],
				});
			});
		} catch {
			// ignore
		}
	}

	protected async isEmbeddableViewerUrl(url: string): Promise<boolean> {
		// Determine if a viewer URL is embeddable inside an iframe.
		// If it sets X-Frame-Options or CSP frame-ancestors that would block our site,
		// the frontend "Online" iframe will break and we should fall back to screenshots.
		const controller = new AbortController();
		const t = setTimeout(() => controller.abort(), 10000);
		try {
			const resp = await fetch(url, {
				method: "HEAD",
				redirect: "follow",
				signal: controller.signal,
			});
			const xfo = (resp.headers.get("x-frame-options") || "").toLowerCase();
			if (xfo.includes("deny")) return false;
			if (xfo.includes("sameorigin")) return false;

			const csp = (
				resp.headers.get("content-security-policy") || ""
			).toLowerCase();
			if (csp.includes("frame-ancestors")) {
				const m = csp.match(/frame-ancestors\s+([^;]+)/i);
				const rule = (m?.[1] || "").trim();
				if (rule.includes("'none'") || rule.includes("'self'")) return false;
				if (
					rule &&
					!rule.includes("*") &&
					!rule.includes("http://localhost") &&
					!rule.includes("https://superpromobelgie.com")
				) {
					return false;
				}
			}

			return true;
		} catch {
			// If we can't determine headers, don't block scraping. The offline fallback
			// and runtime logs will still guide improvements.
			return true;
		} finally {
			clearTimeout(t);
		}
	}

	protected async isBotChallengePage(page: Page): Promise<boolean> {
		try {
			const text = await page.evaluate(() => document.body?.innerText ?? "");
			const t = String(text).toLowerCase();
			return (
				t.includes("sorry voor de onderbreking") ||
				t.includes("click to verify") ||
				t.includes("captcha") ||
				t.includes("colruytgroup") ||
				t.includes("je een bot") ||
				t.includes("onmiddellijk weer toegang")
			);
		} catch {
			return false;
		}
	}

	async probeFingerprint(): Promise<{
		fingerprint: string;
		embedUrl?: string;
		pdfUrl?: string;
		source: ContentSource;
	}> {
		const browser = await puppeteer.launch({
			headless: true,
			executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
			args: [
				"--no-sandbox",
				"--disable-setuid-sandbox",
				"--disable-blink-features=AutomationControlled",
				"--disable-dev-shm-usage",
			],
		});

		try {
			const page = await browser.newPage();
			await this.preparePage(page);

			const intercepted = this.createInterceptedUrls();
			this.setupNetworkInterception(page, intercepted);

			const ctx: ScrapeContext = {
				page,
				browser,
				interceptedUrls: intercepted,
				sourceUrls: [],
				methods: [],
			};

			const url = this.config.folderUrls[0];
			if (!url) {
				return { fingerprint: "no-folder-url", source: "unknown" };
			}

			await page.goto(url, { waitUntil: "networkidle2", timeout: 30000 });
			ctx.sourceUrls.push(url);
			await this.dismissCookieConsent(page);
			if (await this.isBotChallengePage(page)) {
				return { fingerprint: "blocked", source: "unknown" };
			}

			const embed = await this.findEmbed(ctx);
			let pdf = await this.findPdf(ctx);
			if (!pdf && embed?.url) {
				const pdfFromEmbed = await this.findPdfFromEmbedUrl(ctx, embed.url);
				if (pdfFromEmbed) pdf = pdfFromEmbed;
			}

			const source: ContentSource = embed?.source || (pdf ? "pdf" : "unknown");
			const raw = embed?.url || pdf?.url || "none";

			// Avoid importing crypto here; monitor will hash `raw`.
			return {
				fingerprint: raw,
				embedUrl: embed?.url,
				pdfUrl: pdf?.url,
				source,
			};
		} finally {
			await browser.close();
		}
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
			args: [
				"--no-sandbox",
				"--disable-setuid-sandbox",
				"--disable-blink-features=AutomationControlled",
				"--disable-dev-shm-usage",
			],
		});

		try {
			const page = await browser.newPage();
			await this.preparePage(page);

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
			let successfulFolderUrl: string | null = null;

			for (const url of this.config.folderUrls) {
				this.log(`Navigating to ${url}`);
				await this.politeDelay();
				try {
					await page.goto(url, { waitUntil: "networkidle2", timeout: 30000 });
				} catch {
					this.log(`Navigation failed for ${url}, trying next...`);
					continue;
				}

				ctx.sourceUrls.push(url);
				successfulFolderUrl = url;

				// Step 0: Dismiss cookie consent
				await this.dismissCookieConsent(page);
				if (await this.isBotChallengePage(page)) {
					this.log(
						"Bot/captcha challenge detected; skipping this URL without saving screenshots",
					);
					continue;
				}

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
					if (ctx.sourceUrls.some((u) => u.split("#")[0] === canonicalLink))
						break;

					// Track if this link was matched by a folderLinkPattern
					const isPatternMatch = (this.config.folderLinkPatterns || []).some(
						(p) => p.test(folderLink),
					);

					this.log(`Following folder link: ${folderLink}`);
					await this.politeDelay();
					try {
						await page.goto(folderLink, {
							waitUntil: "networkidle2",
							timeout: 30000,
						});
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
								await page
									.waitForNetworkIdle({ timeout: 5000 })
									.catch(() => {});
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
					const finalSource: ContentSource =
						source !== "unknown" ? source : "publitas";
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

				// Step 3a: If the embed exists but is not embeddable (X-Frame-Options/CSP),
				//          generate renderable pages[] so the frontend does not show a broken iframe.
				let screenshots: ScreenshotResult | null = null;
				let embedNotEmbeddable = false;
				if (embed?.url) {
					const embeddable = await this.isEmbeddableViewerUrl(embed.url);
					if (!embeddable) {
						embedNotEmbeddable = true;
						const candidateUrl = pdf?.url || embed.url;
						this.log(
							`Embed is not embeddable; falling back to screenshots from ${candidateUrl}`,
						);
						try {
							screenshots = await this.takeScreenshots(ctx, candidateUrl);
						} catch (e) {
							this.log(`Screenshot fallback skipped: ${e}`);
						}
						if (
							screenshots?.pages.length &&
							!ctx.methods.includes("screenshot")
						) {
							ctx.methods.push("screenshot");
						}
					}
				}

				// Step 4: Try JSON-LD structured data extraction
				const jsonLdDeals = await this.extractJsonLd(ctx);
				if (jsonLdDeals.deals.length > 0) {
					allDeals.push(...jsonLdDeals.deals);
					if (!ctx.methods.includes(jsonLdDeals.source))
						ctx.methods.push(jsonLdDeals.source);
				}

				// Step 5: Try HTML deal extraction
				const htmlDeals = await this.extractDealsFromHtml(ctx);
				if (htmlDeals.deals.length > 0) {
					allDeals.push(...htmlDeals.deals);
					if (!ctx.methods.includes(htmlDeals.source))
						ctx.methods.push(htmlDeals.source);
				}

				// Step 6: Try API response extraction (from intercepted JSON)
				const apiDeals = await this.extractDealsFromApi(ctx);
				if (apiDeals.deals.length > 0) {
					allDeals.push(...apiDeals.deals);
					if (!ctx.methods.includes(apiDeals.source))
						ctx.methods.push(apiDeals.source);
				}

				// Step 3b: If the embed itself is "offline", generate renderable pages[]
				//          so the frontend does not show an unusable iframe.
				let embedWasOffline = false;
				if (!screenshots && embed?.url) {
					const offline = await this.isOfflinePublicationUrl(ctx, embed.url);
					if (offline.isOffline) {
						embedWasOffline = true;
						this.log(
							`Embed appears offline; attempting rediscovery (redirect=${offline.redirectUrl || "none"})`,
						);

						// If the offline message points to a generic page (e.g. retailer homepage),
						// try to re-discover the actual viewer/PDF from there.
						if (offline.redirectUrl && offline.redirectUrl !== embed.url) {
							try {
								// Clear existing intercepted buckets so we only consider the redirect page.
								ctx.interceptedUrls.pdfs.length = 0;
								ctx.interceptedUrls.publitas.length = 0;
								ctx.interceptedUrls.ipaper.length = 0;
								ctx.interceptedUrls.yumpu.length = 0;
								ctx.interceptedUrls.issuu.length = 0;
								ctx.interceptedUrls.apiJson.length = 0;

								await page.goto(offline.redirectUrl, {
									waitUntil: "networkidle2",
									timeout: 30000,
								});
								await this.dismissCookieConsent(page);
								if (await this.isBotChallengePage(page)) {
									throw new Error("Blocked by bot/captcha challenge");
								}
								ctx.sourceUrls.push(offline.redirectUrl);
								await page
									.waitForNetworkIdle({ timeout: 5000 })
									.catch(() => {});

								const redirectedEmbed = await this.findEmbed(ctx);
								if (redirectedEmbed?.url) {
									this.log(
										`Rediscovered embed from redirect: ${redirectedEmbed.url}`,
									);
									embed = redirectedEmbed;
								}

								let redirectedPdf = await this.findPdf(ctx);
								if (!redirectedPdf && embed?.url) {
									const pdfFromEmbed = await this.findPdfFromEmbedUrl(
										ctx,
										embed.url,
									);
									if (pdfFromEmbed) redirectedPdf = pdfFromEmbed;
								}
								if (redirectedPdf?.url) {
									this.log(
										`Rediscovered PDF from redirect: ${redirectedPdf.url}`,
									);
									pdf = redirectedPdf;
								}
							} catch {
								// ignore rediscovery failures
							}
						}

						// If the (possibly updated) embed is still offline, render screenshots from
						// the best available URL.
						const candidateUrl =
							pdf?.url || embed?.url || offline.redirectUrl || embed.url;
						this.log(
							`Embed still offline; falling back to screenshots from ${candidateUrl}`,
						);
						try {
							screenshots = await this.takeScreenshots(ctx, candidateUrl);
						} catch (e) {
							this.log(`Screenshot fallback skipped: ${e}`);
							// If the embed is offline/unavailable (or blocked) we still want to
							// produce a renderable folder. IMPORTANT: the page may currently be
							// on the embed URL, so we must navigate back to the outer retailer
							// folder page to avoid screenshotting the embed error screen again.
							try {
								screenshots = await this.takeScreenshots(ctx, url);
							} catch (e2) {
								this.log(`Outer-page screenshot fallback skipped: ${e2}`);
							}
						}
						if (
							screenshots &&
							screenshots.pages.length > 0 &&
							!ctx.methods.includes("screenshot")
						) {
							ctx.methods.push("screenshot");
						}
					}
				}

				// Step 7: Render fallback (Instance 1)
				// If we can't get an embed/pdf, render a screenshot so we still have a folder.
				// Aldi's viewer is embeddable but does not provide controllable next/prev in our UI.
				// We force-render screenshot pages so the site always has working navigation.
				if (!screenshots && this.retailerSlug === "aldi" && embed?.url) {
					this.log("Aldi: forcing screenshot page rendering for navigation");
					try {
						const screenshotUrl = embed.url
							.replace(/([?&])HideStandardUI=true(&|$)/i, "$1")
							.replace(/([?&])HideNavigationBars=true(&|$)/i, "$1")
							.replace(/\?&/, "?")
							.replace(/[?&]$/, "");
						screenshots = await this.takeScreenshots(ctx, screenshotUrl);
						if (
							screenshots &&
							screenshots.pages.length > 0 &&
							!ctx.methods.includes("screenshot")
						) {
							ctx.methods.push("screenshot");
						}
					} catch (e) {
						this.log(`Aldi screenshot render skipped: ${e}`);
					}
				}
				if (!screenshots && embed?.url && !pdf) {
					this.log("Rendering pages from discovered embed URL");
					try {
						screenshots = await this.takeScreenshots(ctx, embed.url);
						if (
							screenshots &&
							screenshots.pages.length > 0 &&
							!ctx.methods.includes("screenshot")
						) {
							ctx.methods.push("screenshot");
						}
					} catch (e) {
						this.log(`Embed screenshot render skipped: ${e}`);
					}
				}
				if (!screenshots && !embed && !pdf) {
					try {
						screenshots = await this.takeScreenshots(ctx);
					} catch (e) {
						this.log(`Screenshot fallback skipped: ${e}`);
					}
					if (
						screenshots &&
						screenshots.pages.length > 0 &&
						!ctx.methods.includes("screenshot")
					) {
						ctx.methods.push("screenshot");
					}
				}

				// ---- Build folder object ----
				const dates = this.getCurrentWeekDates();
				const contentSource: ContentSource =
					embed?.source ||
					(pdf
						? "pdf"
						: screenshots
							? "screenshot"
							: allDeals.length > 0
								? "html"
								: "unknown");

				const folderPages = screenshots
					? screenshots.pages.map((p) => ({
							pageNumber: p.pageNumber,
							imageUrl: p.imagePath,
							thumbnailUrl: p.thumbPath,
							deals: [] as Deal[],
						}))
					: [];

				const folder: Folder = {
					id: this.generateFolderId("folder"),
					retailerSlug: this.retailerSlug,
					title:
						this.config.folderTitle ||
						`${this.retailerName} folder van de week`,
					validFrom: dates.from,
					validUntil: dates.until,
					pageCount: folderPages.length,
					thumbnailUrl: folderPages[0]?.imageUrl || "",
					pages: folderPages,
					embedUrl:
						embedWasOffline ||
						embedNotEmbeddable ||
						(embed?.source === "issuu" && folderPages.length > 0)
							? undefined
							: embed?.url,
					pdfUrl: pdf?.url,
					contentSource,
					scrapedAt: new Date().toISOString(),
				};

				folders.push(folder);
				break; // First successful URL wins
			}

			// If no folder URL succeeded, still emit a folder via screenshot rendering.
			if (folders.length === 0) {
				const url = this.config.folderUrls[0];
				if (url) {
					this.log(
						`No folder scraped. Rendering screenshot fallback from ${url}`,
					);
					try {
						await page.goto(url, { waitUntil: "networkidle2", timeout: 30000 });
						await this.dismissCookieConsent(page);
						if (await this.isBotChallengePage(page)) {
							this.log(
								"Bot/captcha challenge detected; skipping final screenshot fallback",
							);
							return;
						}
						successfulFolderUrl = url;
						ctx.sourceUrls.push(url);

						const screenshots = await this.takeScreenshots(ctx);
						if (
							screenshots.pages.length > 0 &&
							!ctx.methods.includes("screenshot")
						) {
							ctx.methods.push("screenshot");
						}

						const dates = this.getCurrentWeekDates();
						const folderPages = screenshots.pages.map((p) => ({
							pageNumber: p.pageNumber,
							imageUrl: p.imagePath,
							thumbnailUrl: p.thumbPath,
							deals: [] as Deal[],
						}));

						folders.push({
							id: this.generateFolderId("folder"),
							retailerSlug: this.retailerSlug,
							title:
								this.config.folderTitle ||
								`${this.retailerName} folder van de week`,
							validFrom: dates.from,
							validUntil: dates.until,
							pageCount: folderPages.length,
							thumbnailUrl: folderPages[0]?.imageUrl || "",
							pages: folderPages,
							contentSource: "screenshot",
							scrapedAt: new Date().toISOString(),
						});
					} catch (e) {
						this.log(`Fallback render failed: ${e}`);
					}
				}
			}

			// ---- Scrape additional deal pages ----
			if (this.config.dealUrls) {
				for (const dealUrl of this.config.dealUrls) {
					this.log(`Scraping deals from ${dealUrl}`);
					await this.politeDelay();
					try {
						await page.setExtraHTTPHeaders({
							// Add some basic anti-bot headers
							"User-Agent":
								"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/74.0.3729.169 Safari/537.3",
							Accept:
								"text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9",
							"Accept-Language": "en-US,en;q=0.9",
							"Accept-Encoding": "gzip, deflate, br",
						});

						await page.goto(dealUrl, {
							waitUntil: "networkidle2",
							timeout: 30000,
						});
						await this.dismissCookieConsent(page);
						if (await this.isBotChallengePage(page)) {
							this.log(
								"Bot/captcha challenge detected; skipping products fallback render",
							);
							break;
						}

						const htmlDeals = await this.extractDealsFromHtml(ctx);
						allDeals.push(...htmlDeals.deals);

						const jsonLdDeals = await this.extractJsonLd(ctx);
						// ... (rest of the code remains the same)
						allDeals.push(...jsonLdDeals.deals);
					} catch {
						this.log(`Failed to scrape deals from ${dealUrl}`);
					}
				}
			}

			// ---- Alternative extraction fallbacks ----
			if (allDeals.length === 0) {
				// Fallback A: PDF text extraction (if a PDF URL was found)
				const pdfUrl = folders[0]?.pdfUrl;
				if (pdfUrl) {
					this.log(`Trying PDF text extraction from ${pdfUrl.slice(0, 80)}...`);
					try {
						const dates = this.getCurrentWeekDates();
						const pdfDeals = await extractDealsFromPdf(
							pdfUrl,
							this.retailerSlug,
							dates.from,
							dates.until,
						);
						if (pdfDeals.length > 0) {
							allDeals.push(...pdfDeals);
							if (!ctx.methods.includes("pdf-text"))
								ctx.methods.push("pdf-text");
							this.log(
								`PDF text extraction yielded ${pdfDeals.length} deal(s)`,
							);
						}
					} catch (e) {
						this.log(`PDF text extraction failed: ${e}`);
					}
				}
			}

			if (allDeals.length === 0) {
				// Fallback B: Generic page text extraction from dealUrls
				const dealPages = this.config.dealUrls ?? [this.config.folderUrls[0]];
				for (const dealUrl of dealPages) {
					this.log(`Trying generic text extraction from ${dealUrl}`);
					await this.politeDelay();
					try {
						await page.goto(dealUrl, {
							waitUntil: "networkidle2",
							timeout: 30000,
						});
						await this.dismissCookieConsent(page);
						if (await this.isBotChallengePage(page)) break;

						const pageDeals = await this.extractDealsFromPageText(ctx);
						if (pageDeals.length > 0) {
							allDeals.push(...pageDeals);
							if (!ctx.methods.includes("page-text"))
								ctx.methods.push("page-text");
							this.log(
								`Generic text extraction yielded ${pageDeals.length} deal(s) from ${dealUrl}`,
							);
							break;
						}
					} catch {
						this.log(`Generic text extraction failed for ${dealUrl}`);
					}
				}
			}

			// Fallback C: OCR the leaflet screenshots.
			// For viewer-only retailers (Colruyt, Delhaize, ALDI) there is no PDF
			// text layer and no product markup, so every earlier fallback returns
			// nothing and the leaflet images are the only content that exists.
			if (allDeals.length === 0 && (folders[0]?.pages?.length ?? 0) > 0) {
				this.log("Trying OCR of leaflet screenshots...");
				try {
					const dates = this.getCurrentWeekDates();
					const { extractDealsFromScreenshots } = await import("./ocr");
					const ocrResult = await extractDealsFromScreenshots(
						this.retailerSlug,
						dates.from,
						dates.until,
						{
							week: this.currentWeekTag(),
							onProgress: (msg) => this.log(msg),
						},
					);
					if (ocrResult.deals.length > 0) {
						allDeals.push(...ocrResult.deals);
						if (!ctx.methods.includes("ocr")) ctx.methods.push("ocr");
						this.log(
							`OCR yielded ${ocrResult.deals.length} deal(s) from ${ocrResult.pagesProcessed} page(s)`,
						);
					}
				} catch (e) {
					this.log(`OCR fallback skipped: ${e}`);
				}
			}

			// ---- Deduplicate deals ----
			const uniqueDeals = this.deduplicateDeals(allDeals);

			// Instance 2 fallback: if no deals/products could be extracted, render pages
			// so the UI can still show "folder products" from rendered folder pages.
			if (uniqueDeals.length === 0 && folders.length > 0) {
				const primaryFolder = folders[0];
				const hasRenderablePages =
					primaryFolder.pages && primaryFolder.pages.length > 0;
				if (!hasRenderablePages) {
					const url = successfulFolderUrl || this.config.folderUrls[0];
					if (url) {
						this.log(
							`No deals extracted. Rendering folder pages for fallback from ${url}`,
						);
						try {
							await page.goto(url, {
								waitUntil: "networkidle2",
								timeout: 30000,
							});
							await this.dismissCookieConsent(page);
							if (await this.isBotChallengePage(page)) {
								this.log(
									"Bot/captcha challenge detected; skipping products fallback render",
								);
								throw new Error("Blocked by bot/captcha challenge");
							}

							const screenshots = await this.takeScreenshots(ctx);
							if (
								screenshots.pages.length > 0 &&
								!ctx.methods.includes("screenshot")
							) {
								ctx.methods.push("screenshot");
							}

							primaryFolder.pages = screenshots.pages.map((p) => ({
								pageNumber: p.pageNumber,
								imageUrl: p.imagePath,
								thumbnailUrl: p.thumbPath,
								deals: [] as Deal[],
							}));
							primaryFolder.pageCount = primaryFolder.pages.length;
							primaryFolder.thumbnailUrl =
								primaryFolder.pages[0]?.imageUrl || primaryFolder.thumbnailUrl;
						} catch (e) {
							this.log(`Products fallback render failed: ${e}`);
						}
					}
				}
			}

			// ---- Persist ----
			this.log(
				`Results: ${folders.length} folder(s), ${uniqueDeals.length} deal(s), methods: [${ctx.methods.join(", ")}]`,
			);
			if (folders.length === 0 && uniqueDeals.length === 0) {
				this.log(
					"No folders/deals extracted (likely blocked). Skipping JSON write to avoid overwriting existing data.",
				);
				return;
			}

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

			// ---- Sync deals to database ----
			if (uniqueDeals.length > 0) {
				try {
					const vertical = process.env.NEXT_PUBLIC_RETAIL_VERTICAL ?? "general";
					const synced = syncDealsToDb({
						retailerSlug: this.retailerSlug,
						retailerName: this.retailerName,
						vertical,
						deals: uniqueDeals,
						scrapedAt: data.scrapedAt,
						sourceMethod: this.dealExtractionMethod(ctx.methods),
						sourceUrl: ctx.sourceUrls[0],
						folderTitle: folders[0]?.title,
					});
					this.log(
						`Synced ${synced}/${uniqueDeals.length} deal(s) to database`,
					);
				} catch (dbErr) {
					this.log(`Database sync failed (non-fatal): ${dbErr}`);
				}
			}
		} catch (error) {
			this.log(`Scrape failed: ${error}`);
			throw error;
		} finally {
			await browser.close();
		}
	}

	// ---- Step 0: Cookie consent dismissal ----------------------------------

	/** How long to keep looking for a consent dialog before giving up. */
	protected static readonly CONSENT_WAIT_MS = 8000;

	/**
	 * Consent-dialog button labels, lowercased, in the order they are tried.
	 *
	 * Matching is case-insensitive because these are frequently uppercase in the
	 * markup, not just via CSS — Douglas ships "ACCEPTEREN", which the previous
	 * case-sensitive `includes("Accepteren")` could never match, so its dialog
	 * survived every capture and the folder shipped 60 screenshots of the modal.
	 *
	 * Refusal comes first deliberately. Declining non-essential cookies dismisses
	 * the dialog just as effectively as accepting, so there is no reason to opt a
	 * scraper into tracking on the site owner's behalf. Accept variants are the
	 * fallback for dialogs that offer no refusal at all, and a bare "ok" is last
	 * so it cannot win over a more specific choice.
	 */
	protected static readonly CONSENT_REFUSE_TEXTS = [
		"weigeren",
		"alleen noodzakelijke",
		"ablehnen",
		"refuser",
		"reject all",
		"only necessary",
		"necessary only",
	];

	/**
	 * Accept-button labels, matched EXACTLY.
	 *
	 * Substring matching is unsafe here: "ok" appears inside plenty of unrelated
	 * labels, and a false-positive accept opts the scrape into tracking. A
	 * false-positive refusal merely declines cookies, so the refuse list above is
	 * matched as a substring instead — ALDI Belgium labels its refuse button
	 * "Alle niet strikt noodzakelijke cookies en/of andere technologieën
	 * weigeren", which no exact match could ever cover.
	 *
	 * "aanvaarden" is the Belgian-Dutch form ALDI uses; "accepteren" alone missed
	 * it entirely.
	 */
	protected static readonly CONSENT_ACCEPT_TEXTS = [
		"alles accepteren",
		"alle cookies accepteren",
		"alle cookies aanvaarden",
		"alles aanvaarden",
		"aanvaarden",
		"alles akzeptieren",
		"tout accepter",
		"accept all cookies",
		"accept all",
		"akkoord",
		"accepteren",
		"akzeptieren",
		"accepter",
		"i accept",
		"ok",
		// Locale/interstitial gates. Several BE/NL retailers raise one of these
		// after the cookie choice — bol's "Hoe wil jij bollen?" picker covered the
		// top of every screenshot until it was dismissed.
		"doorgaan",
		"continuer",
		"continue",
	];

	/**
	 * Dismiss a cookie/consent dialog.
	 *
	 * Consent managers inject their dialog asynchronously, so a single pass
	 * immediately after load usually runs before the dialog exists — which is why
	 * this silently did nothing for Douglas, bol and ALDI. This polls until the
	 * dialog appears, only clicks elements that are actually visible, and
	 * verifies the dialog is gone rather than assuming the first click worked.
	 */
	protected async dismissCookieConsent(page: Page): Promise<void> {
		const configured = this.config.cookieSelectors || [];
		const deadline = Date.now() + BaseScraper.CONSENT_WAIT_MS;

		while (Date.now() < deadline) {
			// page.evaluate can throw synchronously — a page object without it (as in
			// the screenshot unit tests) raises TypeError before any promise exists,
			// so `.catch()` alone would not contain it. Consent handling must never
			// be able to fail a scrape.
			let result: { clicked: string | null; dialogPresent?: boolean } | null;
			try {
				result = await page
					.evaluate(
					// No inner functions: this body is serialised into the browser,
					// where tsx's keepNames transform references a `__name` helper that
					// does not exist, so a named inner function throws at runtime. The
					// visibility test is therefore repeated inline.
					function (
						selectors: string[],
						refuseTexts: string[],
						acceptTexts: string[],
					) {
						// Walk the document AND every shadow root. Usercentrics — which
						// Douglas, bol and ALDI all use — renders its dialog inside a
						// closed-off shadow tree, so document.querySelectorAll cannot see
						// its buttons at all and no selector list would ever have matched.
						// Traversal is an explicit stack because a named recursive helper
						// would hit the __name problem described above.
						const roots: (Document | ShadowRoot)[] = [document];
						const all: Element[] = [];
						const configuredHits: Element[] = [];
						for (let r = 0; r < roots.length && r < 200; r++) {
							const scoped = roots[r].querySelectorAll("*");
							for (let i = 0; i < scoped.length; i++) {
								const el = scoped[i];
								if ((el as HTMLElement).shadowRoot) {
									roots.push((el as HTMLElement).shadowRoot as ShadowRoot);
								}
								const tag = el.tagName;
								const role = el.getAttribute("role");
								if (
									tag === "BUTTON" ||
									tag === "A" ||
									role === "button" ||
									tag === "INPUT"
								) {
									all.push(el);
								}
							}
							// Retailer-specific selectors must also be searched per root.
							for (let s = 0; s < selectors.length; s++) {
								const hit = roots[r].querySelector(selectors[s]);
								if (hit) configuredHits.push(hit);
							}
						}

						const visible: Element[] = [];
						for (let i = 0; i < all.length; i++) {
							const style = window.getComputedStyle(all[i]);
							if (
								style.display === "none" ||
								style.visibility === "hidden" ||
								parseFloat(style.opacity || "1") === 0
							) {
								continue;
							}
							const rect = all[i].getBoundingClientRect();
							if (rect.width > 0 && rect.height > 0) visible.push(all[i]);
						}

						// Configured selectors first — they are retailer-specific and exact.
						for (let i = 0; i < configuredHits.length; i++) {
							const el = configuredHits[i];
							// A hidden match is a pre-rendered dialog that has not opened
							// yet; clicking it does nothing and would end the search.
							const style = window.getComputedStyle(el);
							if (
								style.display === "none" ||
								style.visibility === "hidden" ||
								parseFloat(style.opacity || "1") === 0
							) {
								continue;
							}
							const rect = el.getBoundingClientRect();
							if (rect.width <= 0 || rect.height <= 0) continue;
							(el as HTMLElement).click();
							return { clicked: "selector", dialogPresent: true };
						}

						// Refusals are matched as substrings so sentence-length labels
						// still resolve; accepts are matched exactly so a bare "ok"
						// cannot fire on "cookiebeleid".
						for (let ti = 0; ti < refuseTexts.length; ti++) {
							for (let ci = 0; ci < visible.length; ci++) {
								const el = visible[ci];
								const label = (
									el.textContent ||
									(el as HTMLInputElement).value ||
									""
								)
									.trim()
									.replace(/\s+/g, " ")
									.toLowerCase();
								if (label && label.indexOf(refuseTexts[ti]) !== -1) {
									(el as HTMLElement).click();
									return {
										clicked: "refuse:" + refuseTexts[ti],
										dialogPresent: true,
									};
								}
							}
						}

						for (let ti = 0; ti < acceptTexts.length; ti++) {
							for (let ci = 0; ci < visible.length; ci++) {
								const el = visible[ci];
								const label = (
									el.textContent ||
									(el as HTMLInputElement).value ||
									""
								)
									.trim()
									.replace(/\s+/g, " ")
									.toLowerCase();
								if (label && label === acceptTexts[ti]) {
									(el as HTMLElement).click();
									return {
										clicked: "accept:" + acceptTexts[ti],
										dialogPresent: true,
									};
								}
							}
						}

						// Nothing to click. Report whether a dialog is even present, so the
						// caller can stop early instead of polling a page that has none.
						// Searched across the same roots: a shadow-hosted dialog would
						// otherwise read as absent and end the wait immediately.
						// Requiring a consent-looking word means an unrelated modal does
						// not count: bol raises a locale picker ("Hoe wil jij bollen?")
						// after the cookie choice, which matched [role="dialog"] and made
						// every navigation burn the full wait while logging a misleading
						// "cookie dialog still present".
						const dialogSelector =
							'[id*="onetrust"], [class*="cookie"], [class*="consent"], [class*="gdpr"], [id*="usercentrics"], [role="dialog"]';
						let dialogPresent = false;
						for (let r = 0; r < roots.length && !dialogPresent; r++) {
							const dialog = roots[r].querySelector(dialogSelector);
							if (!dialog) continue;
							const style = window.getComputedStyle(dialog);
							const rect = dialog.getBoundingClientRect();
							if (
								style.display === "none" ||
								style.visibility === "hidden" ||
								rect.width <= 0 ||
								rect.height <= 0
							) {
								continue;
							}
							const text = (dialog.textContent || "").toLowerCase();
							dialogPresent =
								text.indexOf("cookie") !== -1 ||
								text.indexOf("consent") !== -1 ||
								text.indexOf("toestemming") !== -1 ||
								text.indexOf("privacy") !== -1;
						}
						return { clicked: null as string | null, dialogPresent };
					},
						configured,
						BaseScraper.CONSENT_REFUSE_TEXTS,
						BaseScraper.CONSENT_ACCEPT_TEXTS,
					)
					.catch(() => null);
			} catch {
				return;
			}

			if (result?.clicked) {
				this.log(`Dismissed cookie consent via ${result.clicked}`);
				await page.waitForNetworkIdle({ timeout: 3000 }).catch(() => {});
				// Some managers reopen a second layer; loop again to catch it.
				await new Promise((r) => setTimeout(r, 500));
				continue;
			}

			// No dialog on the page and nothing clicked: there is nothing to wait
			// for. Keep polling only while a dialog is visible but unmatched.
			if (result && !result.dialogPresent) return;

			await new Promise((r) => setTimeout(r, 500));
		}

		this.log(
			`Consent dialog unresolved after ${BaseScraper.CONSENT_WAIT_MS}ms`,
		);
	}

	// ---- Step 1: Find folder-specific link ---------------------------------

	protected async findFolderLink(page: Page): Promise<string | null> {
		const patterns = (this.config.folderLinkPatterns || []).map(
			(p) => p.source,
		);

		return page.evaluate(function (patterns: string[]) {
			const keywords = [
				"folder",
				"leaflet",
				"flyer",
				"brochure",
				"promofolder",
			];
			const links = Array.from(document.querySelectorAll("a[href]"));

			// A viewer's homepage matches the same pattern as a specific leaflet:
			// `^https://folder.gamma.be/` matches both `folder.gamma.be/` and
			// `folder.gamma.be/gamma-week-32/`. Gamma's navigation links the bare
			// homepage, so returning the first match recorded that as the embed and
			// the folder page rendered an empty iframe. Kruidvat only worked because
			// its first match happened to carry a path. Prefer a deep link, and fall
			// back to a bare origin only when nothing better exists.
			//
			// The path test is inlined rather than extracted into a helper: this
			// body is serialised into the browser, where tsx's keepNames transform
			// references a `__name` helper that does not exist there, so any named
			// inner function throws "__name is not defined" at runtime.
			if (patterns.length > 0) {
				let shallowMatch: string | null = null;
				for (let i = 0; i < links.length; i++) {
					const link = links[i];
					const href = (link as HTMLAnchorElement).href;
					for (let pi = 0; pi < patterns.length; pi++) {
						const p = patterns[pi];
						if (!new RegExp(p).test(href)) continue;
						let hasPath = false;
						try {
							hasPath = new URL(href).pathname.replace(/\/+$/, "").length > 0;
						} catch {
							hasPath = false;
						}
						if (hasPath) return href;
						if (!shallowMatch) shallowMatch = href;
					}
				}
				if (shallowMatch) return shallowMatch;
			}

			for (let i = 0; i < links.length; i++) {
				const link = links[i];
				const href = (link as HTMLAnchorElement).href.toLowerCase();
				const text = (link.textContent || "").toLowerCase();
				for (let ki = 0; ki < keywords.length; ki++) {
					const kw = keywords[ki];
					if (href.includes(kw) || text.includes(kw)) {
						return (link as HTMLAnchorElement).href;
					}
				}
			}
			return null;
		}, patterns);
	}

	// ---- Step 2: Embed detection -------------------------------------------

	protected async findEmbed(ctx: ScrapeContext): Promise<EmbedResult | null> {
		const { page, interceptedUrls } = ctx;

		// Actively wait for known embed iframes to appear (handles lazy loading)
		const embedSelector =
			'iframe[src*="publitas"], iframe[src*="ipaper"], iframe[src*="yumpu"], iframe[src*="issuu"], iframe[src*="flipbook"]';
		try {
			await page.waitForSelector(embedSelector, { timeout: 5000 });
		} catch {
			// No known embed iframe appeared within timeout — continue with fallbacks
		}

		// Check iframes on the page
		const iframeSrc = await page.evaluate(function () {
			const trackingKeywords = [
				"about:",
				"javascript:",
				"google",
				"facebook",
				"doubleclick",
				"analytics",
				"tag",
				"consent",
				"cookie",
				"onetrust",
				"kameleoon",
				"hotjar",
				"tealium",
				"utag",
				// Conversion pixels. Colruyt shipped ct.pinterest.com/ct.html as its
				// folder embed, so the site iframed a tracking beacon instead of the
				// leaflet.
				"pinterest",
				"criteo",
				"taboola",
				"outbrain",
				"tiktok",
				"snapchat",
				"linkedin",
				"bing.com",
				"clarity.ms",
				"adnxs",
				"adsrvr",
				"adservice",
				"segment.",
				"mixpanel",
				"amplitude",
				"/pixel",
				"/beacon",
				"/ct.html",
				"/track",
			];

			// Size is the reliable discriminator: a conversion pixel renders at 0x0
			// or 1x1, a leaflet viewer fills the page. Keyword lists never keep up
			// with new ad networks; geometry does not need to.
			const MIN_VIEWER_PX = 300;
			const iframes = document.querySelectorAll("iframe[src]");

			for (let i = 0; i < iframes.length; i++) {
				const iframe = iframes[i] as HTMLIFrameElement;
				const src = iframe.src;
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

			for (let i = 0; i < iframes.length; i++) {
				const iframe = iframes[i] as HTMLIFrameElement;
				const src = iframe.src;
				if (!src.startsWith("http")) continue;
				let isTracking = false;
				const lower = src.toLowerCase();
				for (let k = 0; k < trackingKeywords.length; k++) {
					if (lower.includes(trackingKeywords[k])) {
						isTracking = true;
						break;
					}
				}
				if (isTracking) continue;

				// Must be large enough to be a viewer rather than a pixel.
				const rect = iframe.getBoundingClientRect();
				const w = Math.max(rect.width, iframe.offsetWidth || 0);
				const h = Math.max(rect.height, iframe.offsetHeight || 0);
				if (w < MIN_VIEWER_PX || h < MIN_VIEWER_PX) continue;

				return src;
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
		const dataEmbed = await page.evaluate(function () {
			const selectors = [
				"[data-folder-url]",
				"[data-embed-url]",
				"[data-publication-url]",
				"[data-flipbook-url]",
				"[data-viewer-url]",
			];
			for (let i = 0; i < selectors.length; i++) {
				const sel = selectors[i];
				const el = document.querySelector(sel);
				if (!el) continue;
				const ds = (el as HTMLElement).dataset as any;
				return (
					ds.folderUrl ||
					ds.embedUrl ||
					ds.publicationUrl ||
					ds.flipbookUrl ||
					ds.viewerUrl ||
					null
				);
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

	protected async findPdfFromEmbedUrl(
		ctx: ScrapeContext,
		embedUrl: string,
	): Promise<PdfResult | null> {
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
		const pdfUrl = await page.evaluate(function () {
			const links = Array.from(document.querySelectorAll("a[href]"));
			for (let i = 0; i < links.length; i++) {
				const link = links[i] as HTMLAnchorElement;
				const href = link.href;
				if (href.match(/\.pdf($|\?|#)/i)) return href;
			}
			for (let i = 0; i < links.length; i++) {
				const link = links[i] as HTMLAnchorElement;
				const text = (link.textContent || "").toLowerCase();
				const href = link.href;
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

		const fnSrc = `(
			function (retailerSlug, validFrom, validUntil) {
				const results = [];
				const scripts = document.querySelectorAll('script[type="application/ld+json"]');
				for (let si = 0; si < scripts.length; si++) {
					const script = scripts[si];
					try {
						const data = JSON.parse(script.textContent || "");
						const items = Array.isArray(data) ? data : [data];
						for (let ii = 0; ii < items.length; ii++) {
							const item = items[ii];
							if (item["@type"] === "Product" || item["@type"] === "Offer") {
								const offer = item.offers || item;
								results.push({
									id: 'jsonld-' + results.length,
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
							if (item["@type"] === "ItemList" && item.itemListElement) {
								for (let li = 0; li < item.itemListElement.length; li++) {
									const listItem = item.itemListElement[li];
									const product = listItem.item || listItem;
									const offer = product.offers || product;
									if (product && product.name) {
										results.push({
											id: 'jsonld-' + results.length,
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
						// skip
					}
				}
				return results;
			}
		)`;

		const dealsRaw = await page.evaluate(
			(src: string, args: string[]) => {
				const fn = (0, eval)(src) as (...a: any[]) => any;
				return fn(args[0], args[1], args[2]);
			},
			fnSrc,
			[this.retailerSlug, dates.from, dates.until],
		);

		const deals = Array.isArray(dealsRaw)
			? (dealsRaw as Deal[])
			: ([] as Deal[]);
		if (deals.length > 0)
			this.log(`Extracted ${deals.length} deal(s) from JSON-LD`);
		return { deals, source: "html" };
	}

	// ---- Step 5: HTML deal extraction --------------------------------------

	protected async extractDealsFromHtml(
		ctx: ScrapeContext,
	): Promise<DealResult> {
		const { page } = ctx;
		const ps = this.config.priceSelectors;
		if (!ps) return { deals: [], source: "html" };

		const dates = this.getCurrentWeekDates();

		const fnSrc = `(
			function (cardSel, nameSel, origPriceSel, promoPriceSel, discountSel, imageSel, descSel, catSel, retailerSlug, validFrom, validUntil) {
				const cards = document.querySelectorAll(cardSel);
				const results = [];
				for (let i = 0; i < cards.length; i++) {
					const card = cards[i];
					const nameEl = card.querySelector(nameSel);
					const name = nameEl && nameEl.textContent ? nameEl.textContent.trim() : "";
					if (!name) continue;

					const parsePrice = (el) => {
						if (!el) return undefined;
						const text = String(el.textContent || "").replace(/[^\d.,]/g, "").replace(",", ".");
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
						id: 'html-' + i,
						product: name,
						originalPrice: parsePrice(origEl),
						promoPrice: parsePrice(promoEl),
						discount: discountEl && discountEl.textContent ? discountEl.textContent.trim() : undefined,
						description: descEl && descEl.textContent ? descEl.textContent.trim() : undefined,
						category: catEl && catEl.textContent ? catEl.textContent.trim() : undefined,
						imageUrl: imageEl ? (imageEl.src || (imageEl.dataset ? imageEl.dataset.src : undefined)) : undefined,
						validFrom,
						validUntil,
						retailerSlug,
					});
				}
				return results;
			}
		)`;

		const deals = await page.evaluate(
			(src: string, args: any[]) => {
				const fn = (0, eval)(src) as (...a: any[]) => any;
				return fn(...args);
			},
			fnSrc,
			[
				ps.card,
				ps.name,
				ps.originalPrice,
				ps.promoPrice,
				ps.discount,
				ps.image,
				ps.description,
				ps.category,
				this.retailerSlug,
				dates.from,
				dates.until,
			],
		);

		if (deals.length > 0)
			this.log(`Extracted ${deals.length} deal(s) from HTML`);

		return { deals: deals as Deal[], source: "html" };
	}

	// ---- Step 6: API response extraction -----------------------------------

	protected async extractDealsFromApi(ctx: ScrapeContext): Promise<DealResult> {
		void ctx;
		// Subclasses can override to parse intercepted API JSON
		// Default implementation: no-op
		return { deals: [], source: "api" };
	}

	// ---- Step 6b: Generic page text extraction (fallback) ------------------

	protected async extractDealsFromPageText(
		ctx: ScrapeContext,
	): Promise<Deal[]> {
		const { page } = ctx;
		const dates = this.getCurrentWeekDates();

		const fnSrc = `(
			function (retailerSlug, validFrom, validUntil) {
				// Navigation / UI noise words — reject elements whose cleaned name matches these
				const NOISE_RE = /^(menu|footer|header|nav|cookie|login|registr|winkel|winkels|jobs|bezorg|verzend|levering|service|advies|contact|klantenservice|openingsuren|over ons|alle (acties|categorie|product|promo)|acties voor jou|top promo|weekactie\\d|aanbiedingen|promotions? page|acties & promoties|gratis (ruilen|retour|advies|verzend)|voor \\d+u|download|volgende week|meer info|bekijk |lees meer|inloggen|uitloggen|mijn account|zoeken|categorie)/i;

				// Only look at elements likely to be individual product cards (not containers)
				const allElements = document.querySelectorAll(
					'[class*="product-card"], [class*="productCard"], [class*="product-tile"], [class*="productTile"], ' +
					'[class*="product-item"], [class*="productItem"], [class*="deal-card"], [class*="dealCard"], ' +
					'[class*="offer-card"], [class*="offerCard"], [class*="promo-card"], [class*="promoCard"], ' +
					'[data-product], [data-product-id], [data-item-id], [data-testid*="product"]'
				);

				// If specific selectors found nothing, try broader but size-limited approach
				const elements = allElements.length > 0 ? allElements : document.querySelectorAll(
					'article, [role="listitem"], [class*="product"]:not(nav):not(header):not(footer), ' +
					'[class*="card"]:not(nav):not(header):not(footer)'
				);

				const results = [];
				const seen = new Set();

				for (const el of elements) {
					const text = (el.textContent || "").trim();
					// Product cards should be between 15-300 chars; longer = likely a container
					if (text.length < 15 || text.length > 300) continue;

					// MUST have at least one euro price — this is the key quality gate
					// Supports European format: €1.499,00 and simple: €49,99 or €49.99
					const euroMatch = text.match(/€\\s*(\\d{1,3}(?:\\.\\d{3})*,\\d{2}|\\d+[,.]\\d{2})/g);
					if (!euroMatch || euroMatch.length === 0) continue;

					// Also look for percentage discounts
					const discountMatch = text.match(/(-\\d+\\s*%|\\d+\\s*\\+\\s*\\d+\\s*gratis|[234]e?\\s*(halve\\s*prijs|gratis)|1\\+1)/i);

					// Extract product name: first text line that isn't a price or noise
					const lines = text.split(/\\n/).map(l => l.trim()).filter(l => l.length > 3);
					let productName = "";
					for (const line of lines) {
						const cleaned = line
							.replace(/€\\s*\\d{1,3}(?:\\.\\d{3})*[,.]\\d{2}/g, "")
							.replace(/\\b\\d{1,3}(?:\\.\\d{3})*[,.]\\d{2}\\b/g, "")
							.replace(/-?\\d+\\s*%/g, "")
							// Strip rating/badge noise: "Promo4.7Cashback" prefix
							.replace(/^(Promo|Sale|Actie|Nieuw|New|Aanbieding)\\s*/i, "")
							.replace(/^\\d[.,]\\d\\s*/g, "")
							.replace(/^(Cashback|Gratis|Korting|Bonus|Cadeau)\\s*/i, "")
							.trim();
						if (cleaned.length >= 5 && !cleaned.match(/^[\\d\\s%€,.+-]+$/) && !NOISE_RE.test(cleaned)) {
							productName = cleaned.slice(0, 100);
							break;
						}
					}

					if (!productName || productName.length < 5) continue;

					// Deduplicate by normalized name
					const key = productName.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 30);
					if (seen.has(key)) continue;
					seen.add(key);

					// Parse prices — handle European format (1.499,00 = 1499)
					const prices = euroMatch.map(p => {
						let s = p.replace("€", "").trim();
						if (s.includes(",") && s.indexOf(".") < s.indexOf(",")) {
							// European: dots are thousands, comma is decimal (1.499,00)
							s = s.replace(/\\./g, "").replace(",", ".");
						} else if (s.includes(",") && !s.includes(".")) {
							// Comma only: comma is decimal (49,99)
							s = s.replace(",", ".");
						}
						return parseFloat(s);
					}).filter(p => !isNaN(p) && p > 0.01 && p < 50000);

					if (prices.length === 0) continue;

					let originalPrice, promoPrice;
					if (prices.length >= 2) {
						originalPrice = Math.max(...prices);
						promoPrice = Math.min(...prices);
						// Sanity: original should be > promo
						if (originalPrice <= promoPrice) {
							promoPrice = prices[0];
							originalPrice = undefined;
						}
					} else {
						promoPrice = prices[0];
					}

					results.push({
						id: 'pagetext-' + results.length,
						product: productName,
						originalPrice,
						promoPrice,
						discount: discountMatch ? discountMatch[0].trim() : undefined,
						validFrom,
						validUntil,
						retailerSlug,
					});
				}
				return results;
			}
		)`;

		try {
			const deals = await page.evaluate(
				(src: string, args: string[]) => {
					const fn = (0, eval)(src) as (...a: any[]) => any;
					return fn(args[0], args[1], args[2]);
				},
				fnSrc,
				[this.retailerSlug, dates.from, dates.until],
			);
			return Array.isArray(deals) ? (deals as Deal[]) : [];
		} catch (err) {
			this.log(`Generic page text extraction error: ${err}`);
			return [];
		}
	}

	protected async isOfflinePublicationUrl(
		ctx: ScrapeContext,
		url: string,
	): Promise<{ isOffline: boolean; redirectUrl?: string }> {
		const page = await ctx.browser.newPage();
		try {
			await page.setUserAgent(DEFAULT_USER_AGENT);
			await page.setViewport({ width: 1440, height: 900 });
			await page.goto(url, { waitUntil: "networkidle2", timeout: 30000 });
			await this.dismissCookieConsent(page);
			await page.waitForNetworkIdle({ timeout: 5000 }).catch(() => {});

			const text = await page
				.evaluate(() => document.body?.innerText ?? "")
				.catch(() => "");
			const t = String(text).toLowerCase();
			const isOffline =
				t.includes("deze publicatie is offline") ||
				t.includes("this publication is offline") ||
				t.includes("deze publicatie is niet gevonden") ||
				t.includes("this publication was not found") ||
				t.includes("publication not found");
			if (!isOffline) return { isOffline: false };

			const redirectUrl =
				String(text).match(/https?:\/\/[^\s)\]]+/i)?.[0] || undefined;
			return { isOffline: true, redirectUrl };
		} catch {
			return { isOffline: false };
		} finally {
			await page.close().catch(() => {});
		}
	}

	// ---- Step 7: Screenshot fallback ---------------------------------------

	protected async takeScreenshots(
		ctx: ScrapeContext,
		overrideUrl?: string,
	): Promise<ScreenshotResult> {
		const { page } = ctx;
		this.log("Taking screenshot fallback...");
		if (!overrideUrl && (await this.isBotChallengePage(page))) {
			throw new Error("Blocked by bot/captcha challenge");
		}

		// Leaflet captures are the only content source for viewer-only retailers,
		// and they feed OCR rather than just the UI. At deviceScaleFactor 1 a
		// 1440x900 capture of a double-page spread renders price text a few pixels
		// tall, which OCRs at ~48% confidence — unusable. Raising the pixel ratio
		// is what makes those retailers extractable at all.
		const shotScale = (() => {
			const n = parseInt(process.env.SCREENSHOT_SCALE ?? "3", 10);
			return Number.isFinite(n) && n >= 1 && n <= 4 ? n : 3;
		})();
		try {
			await page.setViewport({
				width: 1440,
				height: 900,
				deviceScaleFactor: shotScale,
			});
		} catch {
			// Non-fatal: fall back to whatever viewport is already set.
		}

		if (!fs.existsSync(SCREENSHOT_DIR))
			fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });

		if (overrideUrl) {
			try {
				await page.goto(overrideUrl, {
					waitUntil: "networkidle2",
					timeout: 30000,
				});
				await this.dismissCookieConsent(page);
				if (await this.isBotChallengePage(page)) {
					throw new Error("Blocked by bot/captcha challenge");
				}
				ctx.sourceUrls.push(overrideUrl);
			} catch (e) {
				throw e;
			}
		}

		const isPdfUrl = (u: string): boolean => {
			const s = u.toLowerCase();
			return s.includes(".pdf") || s.includes("/pdfs/");
		};

		const maxPages = parseInt(process.env.MAX_SCREENSHOT_PAGES ?? "60", 10);

		// If we're looking at a PDF URL, try to generate page-like screenshots by
		// scrolling the browser PDF renderer and capturing viewport slices.
		// This is a best-effort fallback to avoid broken "publication offline" embeds.
		const currentUrl = overrideUrl ?? page.url();
		if (currentUrl && isPdfUrl(currentUrl)) {
			const pages: { pageNumber: number; imagePath: string; thumbPath?: string }[] = [];
			const view = page.viewport();
			const width = view?.width ?? 1440;
			const height = view?.height ?? 900;

			for (let i = 1; i <= (Number.isFinite(maxPages) ? maxPages : 12); i++) {
				const y = (i - 1) * height;
				try {
					await page.evaluate((yy) => window.scrollTo(0, yy), y);
					await page.waitForNetworkIdle({ timeout: 2000 }).catch(() => {});
					await new Promise((r) => setTimeout(r, 250));
				} catch {
					// ignore
				}

				let scrollY = 0;
				try {
					scrollY = await page.evaluate(() => window.scrollY || 0);
				} catch {
					// ignore
				}

				// If we can't scroll further (or PDF renderer doesn't scroll), stop.
				if (i > 1 && scrollY < y - 5) break;

				const filename = `${this.generateFolderId("viewerimg-p" + i)}.webp`;
				const filepath = path.join(SCREENSHOT_DIR, filename);
				await page.screenshot({
					path: filepath,
					clip: { x: 0, y: scrollY, width, height },
				});
				pages.push({ pageNumber: i, imagePath: `/screenshots/${filename}` });
			}

			return { pages };
		}

		// iPaper (used by Aldi) renders each page as a signed Zoom.jpg URL. These are
		// much easier to capture reliably than attempting to click through a canvas-based
		// viewer UI. When detected, fetch pages directly and save them to /public/screenshots.
		try {
			await page.waitForNetworkIdle({ timeout: 5000 }).catch(() => {});
			await new Promise((r) => setTimeout(r, 1200));
		} catch {
			// ignore
		}
		const iPaperMatch = (ctx.interceptedUrls.images || []).find((u) =>
			/ipaper\.io\/iPaper\/Papers\/.+\/Pages\/\d+\/Zoom\.jpg/i.test(u),
		);
		if (iPaperMatch) {
			const m = iPaperMatch.match(
				/(https?:\/\/[^\s]+?\/iPaper\/Papers\/([^/]+)\/Pages\/)\d+(\/Zoom\.jpg)(\?[^\s]+)?/i,
			);
			if (m) {
				const base = m[1];
				const paperId = m[2];
				const suffix = m[3];
				const query = m[4] || "";
				this.log(
					`iPaper detected (paperId=${paperId}). Fetching pages directly...`,
				);

				const pages: { pageNumber: number; imagePath: string; thumbPath?: string }[] = [];
				const max = Number.isFinite(maxPages) ? maxPages : 12;
				for (let i = 1; i <= max; i++) {
					const url = `${base}${i}${suffix}${query}`;
					const controller = new AbortController();
					const t = setTimeout(() => controller.abort(), 15000);
					try {
						const resp = await fetch(url, {
							method: "GET",
							redirect: "follow",
							signal: controller.signal,
						});
						if (!resp.ok) break;
						const buf = Buffer.from(await resp.arrayBuffer());
						if (buf.length < 1000) break;

						const filename = `${this.generateFolderId("viewerimg-p" + i)}.jpg`;
						const filepath = path.join(SCREENSHOT_DIR, filename);
						fs.writeFileSync(filepath, buf);
						pages.push({
							pageNumber: i,
							imagePath: `/screenshots/${filename}`,
						});
					} catch {
						break;
					} finally {
						clearTimeout(t);
					}
				}

				if (pages.length > 0) {
					return { pages };
				}
			}
		}

		const isIssuuEmbed =
			(typeof overrideUrl === "string" &&
				overrideUrl.includes("e.issuu.com/embed.html")) ||
			page.url().includes("e.issuu.com/embed.html");
		const isPublitasEmbed =
			(typeof overrideUrl === "string" &&
				overrideUrl.includes("view.publitas.com/")) ||
			page.url().includes("view.publitas.com/");

		const getViewerClip = async (): Promise<{
			x: number;
			y: number;
			width: number;
			height: number;
		} | null> => {
			if (typeof (page as any).$ !== "function") return null;
			const candidates = [
				"iframe",
				"embed",
				"canvas",
				"img",
				"main",
				"article",
			];
			let best: {
				x: number;
				y: number;
				width: number;
				height: number;
				area: number;
			} | null = null;

			for (const sel of candidates) {
				try {
					// $$ not $: the leaflet is rarely the *first* element of its kind
					// — viewers put logos and controls before it — so considering
					// only one match per selector produced a loose crop that kept the
					// viewer's own toolbar and arrows in the saved page image.
					const els =
						typeof (page as any).$$ === "function"
							? await page.$$(sel)
							: [await page.$(sel)].filter(Boolean);

					for (const el of els) {
						if (!el) continue;
						const box = await el.boundingBox();
						if (!box) continue;
						const area = Math.max(0, box.width) * Math.max(0, box.height);
						if (!best || area > best.area) {
							best = {
								x: box.x,
								y: box.y,
								width: box.width,
								height: box.height,
								area,
							};
						}
					}
				} catch {
					// ignore
				}
			}

			if (!best) return null;
			if (best.width < 50 || best.height < 50) return null;

			const view = page.viewport();
			if (view) {
				const minArea = (view.width * view.height) / 8;
				if (best.area < minArea) return null;
			}

			return {
				x: Math.max(0, best.x),
				y: Math.max(0, best.y),
				width: Math.max(1, best.width),
				height: Math.max(1, best.height),
			};
		};

		const waitForViewer = async (): Promise<void> => {
			try {
				if (typeof (page as any).waitForSelector === "function") {
					await (page as any)
						.waitForSelector("iframe, embed, canvas, img", { timeout: 10000 })
						.catch(() => {});
				}
			} catch {
				// ignore
			}
			await new Promise((r) => setTimeout(r, 1200));
		};

		const isOfflinePublication = async (): Promise<boolean> => {
			try {
				if (typeof (page as any).evaluate !== "function") return false;
				const text = await (page as any).evaluate(
					() => document.body?.innerText ?? "",
				);
				const t = String(text).toLowerCase();
				return (
					t.includes("deze publicatie is offline") ||
					t.includes("this publication is offline") ||
					t.includes("deze publicatie is niet gevonden") ||
					t.includes("this publication was not found") ||
					t.includes("publication not found")
				);
			} catch {
				return false;
			}
		};

		if (isIssuuEmbed) {
			const baseUrl = overrideUrl ?? page.url();
			const pages: { pageNumber: number; imagePath: string; thumbPath?: string }[] = [];
			const seenPageHashes = new Set<string>();

			for (let i = 1; i <= (Number.isFinite(maxPages) ? maxPages : 12); i++) {
				let u: URL;
				try {
					u = new URL(baseUrl);
				} catch {
					break;
				}

				u.searchParams.set("pageNumber", String(i));
				// Deliberately keep Issuu's two-page spread. These captures are what
				// the site renders to visitors: a spread fills the frame, and with
				// MAX_SCREENSHOT_PAGES captures it covers roughly twice as much of
				// the leaflet. Forcing singlePage shrank the content to ~40% of the
				// frame, cut coverage, and doubled the bytes served. At
				// deviceScaleFactor 3 each half of a spread is still ~2000px wide,
				// which is ample for OCR.
				const url = u.toString();

				try {
					await this.politeDelay();
					await page.goto(url, { waitUntil: "networkidle2", timeout: 30000 });
					await waitForViewer();
				} catch {
					break;
				}

				if (await isOfflinePublication()) {
					throw new Error(
						"Publication is offline/unavailable; refusing to generate screenshots",
					);
				}

				const filename = `${this.generateFolderId("viewerimg-p" + i)}.webp`;
				const filepath = path.join(SCREENSHOT_DIR, filename);
				const clip = await getViewerClip();
				// A repeated image means the viewer clamped past the last page.
				const captured = await this.captureDedupedPage(
					page,
					filepath,
					clip ?? null,
					seenPageHashes,
				);
				if (captured.status === "duplicate") {
					this.log(`Reached end of folder at page ${i}`);
					break;
				}
				// A blank page is skipped entirely: recording it would point the
				// folder at a file that was never written.
				if (captured.status === "blank") continue;
				pages.push({
					pageNumber: pages.length + 1,
					imagePath: captured.url,
					thumbPath: captured.thumbUrl,
				});
			}

			if (pages.length > 0) {
				this.log(`Screenshots saved: ${pages.length} page(s)`);
				return { pages };
			}
		}

		if (isPublitasEmbed) {
			const baseUrl = overrideUrl ?? page.url();
			const maxPages = parseInt(process.env.MAX_SCREENSHOT_PAGES ?? "60", 10);
			const pages: { pageNumber: number; imagePath: string; thumbPath?: string }[] = [];
			const seenPageHashes = new Set<string>();

			for (let i = 1; i <= (Number.isFinite(maxPages) ? maxPages : 12); i++) {
				let u: URL;
				try {
					u = new URL(baseUrl);
				} catch {
					break;
				}

				if (
					u.pathname.includes("/page/") ||
					/\/page\/\d+(\/)?$/.test(u.pathname)
				) {
					u.pathname = u.pathname.replace(/\/page\/\d+(\/)?$/, `/page/${i}`);
					if (!u.pathname.includes("/page/")) {
						u.pathname = u.pathname.replace(/\/+$/, "") + `/page/${i}`;
					}
				} else {
					u.searchParams.set("page", String(i));
					u.searchParams.set("pageNumber", String(i));
				}
				const url = u.toString();

				try {
					await this.politeDelay();
					await page.goto(url, { waitUntil: "networkidle2", timeout: 30000 });
					await waitForViewer();
				} catch {
					break;
				}

				if (await isOfflinePublication()) {
					throw new Error(
						"Publication is offline/unavailable; refusing to generate screenshots",
					);
				}

				const filename = `${this.generateFolderId("viewerimg-p" + i)}.webp`;
				const filepath = path.join(SCREENSHOT_DIR, filename);
				const clip = await getViewerClip();
				// A repeated image means the viewer clamped past the last page.
				const captured = await this.captureDedupedPage(
					page,
					filepath,
					clip ?? null,
					seenPageHashes,
				);
				if (captured.status === "duplicate") {
					this.log(`Reached end of folder at page ${i}`);
					break;
				}
				// A blank page is skipped entirely: recording it would point the
				// folder at a file that was never written.
				if (captured.status === "blank") continue;
				pages.push({
					pageNumber: pages.length + 1,
					imagePath: captured.url,
					thumbPath: captured.thumbUrl,
				});
			}

			if (pages.length > 0) {
				this.log(`Screenshots saved: ${pages.length} page(s)`);
				return { pages };
			}
		}

		const filename = `${this.generateFolderId("viewerimg-p1")}.webp`;
		const filepath = path.join(SCREENSHOT_DIR, filename);

		if (await isOfflinePublication()) {
			throw new Error(
				"Publication is offline/unavailable; refusing to generate screenshots",
			);
		}

		const genericPages: { pageNumber: number; imagePath: string; thumbPath?: string }[] = [];
		const clickNext = async (): Promise<boolean> => {
			const candidates = [
				"button[aria-label*='Volgende']",
				"button[aria-label*='Next']",
				"button[title*='Volgende']",
				"button[title*='Next']",
				"a[aria-label*='Volgende']",
				"a[aria-label*='Next']",
				".swiper-button-next",
				".slick-next",
				".next",
			];
			for (const sel of candidates) {
				try {
					const el = await page.$(sel);
					if (!el) continue;
					await el.click().catch(() => {});
					await page.waitForNetworkIdle({ timeout: 3000 }).catch(() => {});
					await new Promise((r) => setTimeout(r, 600));
					return true;
				} catch {
					// ignore
				}
			}

			try {
				const iframes = await page.$$("iframe");
				let bestFrame: any = null;
				let bestArea = 0;
				for (const iframe of iframes) {
					const box = await iframe.boundingBox().catch(() => null);
					if (!box) continue;
					const area = Math.max(0, box.width) * Math.max(0, box.height);
					if (area > bestArea) {
						bestArea = area;
						bestFrame = iframe;
					}
				}
				if (bestFrame) {
					const frame = await bestFrame.contentFrame().catch(() => null);
					if (frame) {
						for (const sel of candidates) {
							try {
								const el = await frame.$(sel);
								if (!el) continue;
								await el.click().catch(() => {});
								await page
									.waitForNetworkIdle({ timeout: 3000 })
									.catch(() => {});
								await new Promise((r) => setTimeout(r, 600));
								return true;
							} catch {
								// ignore
							}
						}
					}
				}
			} catch {
				// ignore
			}
			return false;
		};

		try {
			const maxPages = parseInt(process.env.MAX_SCREENSHOT_PAGES ?? "60", 10);
			// Route through captureDedupedPage like the Issuu and Publitas paths.
			// This branch used to call page.screenshot() directly, so it skipped
			// blank detection, duplicate collapsing, resizing, thumbnails and the
			// OCR-source copy — which is why Douglas shipped 60 full-size captures
			// of the same cookie dialog while the other paths stopped at the real
			// end of the leaflet.
			const seenPageHashes = new Set<string>();
			for (let i = 1; i <= (Number.isFinite(maxPages) ? maxPages : 12); i++) {
				await waitForViewer();
				const perPageFilename = `${this.generateFolderId("viewerimg-p" + i)}.webp`;
				const perPageFilepath = path.join(SCREENSHOT_DIR, perPageFilename);
				const clip = await getViewerClip();
				const captured = await this.captureDedupedPage(
					page,
					perPageFilepath,
					clip ?? null,
					seenPageHashes,
				);

				if (captured.status === "duplicate") {
					this.log(`Reached end of folder at page ${i}`);
					break;
				}
				if (captured.status === "written") {
					genericPages.push({
						pageNumber: genericPages.length + 1,
						imagePath: captured.url,
						thumbPath: captured.thumbUrl,
					});
				}
				// A blank page is skipped but the viewer keeps advancing: some
				// viewers render an empty slot mid-leaflet.

				if (i >= (Number.isFinite(maxPages) ? maxPages : 12)) break;
				const didClick = await clickNext();
				if (!didClick) break;
			}
		} catch {
			// ignore and fall back to single screenshot
		}
		// One page is a real result, not a failure. This used to require >1, which
		// was harmless while duplicate captures inflated every folder past the
		// ceiling — but once near-duplicates collapse, a single-page leaflet is a
		// normal outcome. Falling through discarded that page AND overwrote its
		// file with the raw single-screenshot below, which on Douglas produced a
		// zero-byte image the folder still pointed at.
		if (genericPages.length >= 1) {
			this.log(
				`Screenshots saved (generic viewer): ${genericPages.length} page(s)`,
			);
			return { pages: genericPages };
		}

		// Last resort: one capture of whatever is on screen. Routed through
		// captureDedupedPage so it gets the same empty/blank rejection, resizing
		// and thumbnail as every other path — writing straight to disk here is
		// what let a zero-byte file be recorded as a page.
		let single = await this.captureDedupedPage(
			page,
			filepath,
			await getViewerClip().catch(() => null),
			new Set<string>(),
		);
		if (single.status !== "written") {
			single = await this.captureDedupedPage(
				page,
				filepath,
				null,
				new Set<string>(),
			);
		}

		if (single.status !== "written") {
			this.log("No usable screenshot could be captured");
			return { pages: [] };
		}

		this.log(`Screenshot saved: ${filepath}`);

		return {
			pages: [
				{
					pageNumber: 1,
					imagePath: single.url,
					thumbPath: single.thumbUrl,
				},
			],
		};
	}

	// ---- Network interception setup ----------------------------------------

	protected setupNetworkInterception(
		page: Page,
		intercepted: InterceptedUrls,
	): void {
		page.on("response", (response) => {
			const url = response.url();
			const contentType = response.headers()["content-type"] || "";

			// Images (used for iPaper, and as general signals for screenshot-based capture)
			if (
				contentType.startsWith("image/") ||
				url.match(/\.(png|jpe?g|webp|gif)(?:$|\?)/i)
			) {
				if (!intercepted.images.includes(url)) intercepted.images.push(url);
			}

			// PDFs
			if (
				url.match(/\.pdf($|\?)/i) ||
				contentType.includes("application/pdf")
			) {
				if (!intercepted.pdfs.includes(url)) intercepted.pdfs.push(url);
			}

			// Publitas – only capture actual viewer URLs from view.publitas.com
			if (url.includes("view.publitas.com")) {
				try {
					const parsed = new URL(url);
					const parts = parsed.pathname.split("/").filter(Boolean);
					const excludedPaths = [
						"branding",
						"custom-menu",
						"analytics",
						"stats",
					];
					if (
						parts.length >= 2 &&
						!parts.some((p) => excludedPaths.includes(p))
					) {
						const viewerUrl = `${parsed.origin}/${parts[0]}/${parts[1]}/`;
						if (!intercepted.publitas.includes(viewerUrl))
							intercepted.publitas.push(viewerUrl);
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
		return {
			pdfs: [],
			publitas: [],
			ipaper: [],
			yumpu: [],
			issuu: [],
			apiJson: [],
			images: [],
		};
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

	/** Below this mean per-channel standard deviation an image carries no content. */
	protected static readonly BLANK_STDDEV_THRESHOLD = 3;

	/** Width folder page images are served at. */
	protected static readonly PAGE_IMAGE_WIDTH = 1800;

	/** WebP quality for folder page images. */
	protected static readonly PAGE_IMAGE_QUALITY = 78;

	/**
	 * Width of the thumbnail-strip images.
	 *
	 * The strip draws one entry per page in a 64x88 box, and next/image runs
	 * `unoptimized`, so without a separate small file a 60-page folder makes the
	 * visitor download every full-size page to render its thumbnails — 26 MB on
	 * IKEA. 160px covers a 2x display at that box size.
	 */
	protected static readonly THUMB_IMAGE_WIDTH = 160;

	/** WebP quality for thumbnails — they are never seen above 64px wide. */
	protected static readonly THUMB_IMAGE_QUALITY = 65;

	/**
	 * How many of the 64 fingerprint bits may differ before two captures are
	 * treated as the same page. Calibrated against folders whose true page count
	 * is known: at 4, Action keeps 18 distinct spreads of 60 captures and Colruyt
	 * resolves to 10 (its cover plus nine Issuu spreads). Raising it starts
	 * merging genuinely different leaflet pages.
	 */
	protected static readonly DUPLICATE_HAMMING_THRESHOLD = 4;

	/**
	 * Number of bits that differ between two 64-bit fingerprints.
	 *
	 * Fingerprints are 16-character hex strings rather than bigints: this file
	 * compiles below an ES2020 target, where BigInt literals are unavailable.
	 * Comparing a nibble at a time keeps it to plain numbers.
	 */
	protected static hammingDistance(a: string, b: string): number {
		if (a.length !== b.length) return Number.MAX_SAFE_INTEGER;
		let count = 0;
		for (let i = 0; i < a.length; i++) {
			let nibble = parseInt(a[i], 16) ^ parseInt(b[i], 16);
			while (nibble > 0) {
				count += nibble & 1;
				nibble >>= 1;
			}
		}
		return count;
	}

	/**
	 * 64-bit difference hash of an image.
	 *
	 * Reduces to 9x8 greyscale and records, for each pixel, whether it is
	 * brighter than its right-hand neighbour. That encodes coarse layout while
	 * discarding the rendering noise that defeats byte-level comparison.
	 *
	 * Returned as a 16-character hex string, one nibble per four pixels. Returns
	 * null when the image cannot be read, so the caller can fall back to exact
	 * hashing rather than treat an unreadable capture as unique.
	 */
	protected async perceptualHash(bytes: Buffer): Promise<string | null> {
		try {
			const sharp = (await import("sharp")).default;
			const px = await sharp(bytes, { limitInputPixels: false })
				.resize(9, 8, { fit: "fill" })
				.greyscale()
				.raw()
				.toBuffer();

			let hex = "";
			let nibble = 0;
			let bitsInNibble = 0;
			for (let y = 0; y < 8; y++) {
				for (let x = 0; x < 8; x++) {
					const i = y * 9 + x;
					nibble = (nibble << 1) | (px[i] > px[i + 1] ? 1 : 0);
					if (++bitsInNibble === 4) {
						hex += nibble.toString(16);
						nibble = 0;
						bitsInNibble = 0;
					}
				}
			}
			return hex;
		} catch {
			return null;
		}
	}

	/** Thumbnail filename for a page image: `foo.webp` -> `foo-thumb.webp`. */
	protected static thumbFilename(filename: string): string {
		const ext = path.extname(filename);
		return `${filename.slice(0, -ext.length || undefined)}-thumb.webp`;
	}

	/**
	 * Prepare a captured page for delivery to visitors.
	 *
	 * next.config.ts sets `images.unoptimized: true`, so Next does not resize or
	 * re-encode anything: whatever is written here is exactly what a visitor
	 * downloads, and page one is rendered with `priority`. A raw
	 * deviceScaleFactor-3 capture is ~4300px wide and hundreds of KB, which is a
	 * poor LCP on the pages meant to earn traffic.
	 *
	 * Resizing to a sensible display width and re-encoding as WebP keeps enough
	 * detail to zoom into leaflet prices while cutting the bytes substantially.
	 * The full-resolution capture is not retained: OCR reads these same files and
	 * 1800px still exceeds the ~1200px per leaflet page it needs.
	 *
	 * Returns the original bytes on any failure — a broken optimiser must never
	 * cost a page.
	 */
	protected async optimizePageImage(bytes: Buffer): Promise<Buffer> {
		try {
			const sharp = (await import("sharp")).default;
			const meta = await sharp(bytes, { limitInputPixels: false }).metadata();
			if (!meta.width) return bytes;

			const out = await sharp(bytes, { limitInputPixels: false })
				.resize({
					width: Math.min(meta.width, BaseScraper.PAGE_IMAGE_WIDTH),
					withoutEnlargement: true,
				})
				.webp({ quality: BaseScraper.PAGE_IMAGE_QUALITY })
				.toBuffer();

			return out.length > 0 && out.length < bytes.length ? out : bytes;
		} catch {
			return bytes;
		}
	}

	/**
	 * True when a capture is a flat, contentless image.
	 *
	 * Returns false on any error: a detection failure must never discard a real
	 * leaflet page.
	 */
	protected async isBlankCapture(bytes: Buffer): Promise<boolean> {
		try {
			const sharp = (await import("sharp")).default;
			const { channels } = await sharp(bytes, { limitInputPixels: false }).stats();
			if (!channels || channels.length === 0) return false;
			const meanStdev =
				channels.reduce((sum, c) => sum + c.stdev, 0) / channels.length;
			return meanStdev < BaseScraper.BLANK_STDDEV_THRESHOLD;
		} catch {
			return false;
		}
	}

	/**
	 * Capture one viewer page, skipping it if it duplicates one already taken.
	 *
	 * Leaflet viewers clamp navigation past the final page: requesting page 30
	 * of an 18-page folder re-renders page 18. Hashing the pixels detects that,
	 * so capture can run to a generous ceiling and stop at the true end instead
	 * of a hardcoded page count. Returns false once the folder is exhausted.
	 */
	protected async captureDedupedPage(
		page: Page,
		filepath: string,
		clip: { x: number; y: number; width: number; height: number } | null,
		seenHashes: Set<string>,
	): Promise<CaptureResult> {
		const buffer = clip
			? await page.screenshot({ clip })
			: await page.screenshot({ fullPage: true });

		// Defensive: a screenshot backend that returns nothing cannot be hashed.
		// Treat the page as new rather than aborting the folder — capturing a
		// possible duplicate is far cheaper than truncating the leaflet.
		if (!buffer) return { status: "blank" };

		const raw = Buffer.from(buffer as Uint8Array);

		// An empty buffer would be written as a zero-byte file and recorded as a
		// real page: the viewer then renders its full chrome around an image that
		// can never load, which is how zooplus shipped a one-page folder showing
		// nothing at all. isBlankCapture cannot judge this — sharp rejects the
		// buffer before any statistics exist.
		if (raw.length === 0) {
			this.log("Skipped an empty page capture");
			return { status: "blank" };
		}

		// Skip blank pages. A viewer that hasn't finished painting yields a flat
		// image, which is stored as a real page and shows the visitor an empty
		// slot in the thumbnail strip. Uniform images have almost no per-channel
		// variance, so standard deviation separates them from leaflet content
		// far more reliably than file size.
		if (await this.isBlankCapture(raw)) {
			this.log("Skipped a blank page capture");
			return { status: "blank" };
		}

		const bytes = await this.optimizePageImage(raw);

		// Detect a repeated page perceptually rather than byte-for-byte. Viewers
		// re-render the same spread with sub-pixel differences, and pages with
		// lazy-loaded carousels differ on every capture, so an exact hash almost
		// never matches: IKEA produced 60 "pages" that were 3 distinct images, and
		// Colruyt captured every Issuu spread twice. A downscaled luminance
		// fingerprint ignores that noise while still separating real leaflet pages
		// — measured against known-good folders, Action keeps 18 of 60 distinct
		// spreads and Colruyt resolves to its true cover-plus-nine-spreads.
		const fingerprint = await this.perceptualHash(bytes);
		if (fingerprint !== null) {
			for (const seen of seenHashes) {
				// Only compare against other fingerprints; the set also holds SHA1
				// fallbacks, which are a different length and not bit-comparable.
				if (!seen.startsWith("p:")) continue;
				const distance = BaseScraper.hammingDistance(seen.slice(2), fingerprint);
				if (distance <= BaseScraper.DUPLICATE_HAMMING_THRESHOLD) {
					return { status: "duplicate" };
				}
			}
			seenHashes.add(`p:${fingerprint}`);
		} else {
			// Fingerprinting failed; fall back to exact bytes rather than nothing.
			const hash = crypto.createHash("sha1").update(bytes).digest("hex");
			if (seenHashes.has(hash)) return { status: "duplicate" };
			seenHashes.add(hash);
		}

		fs.writeFileSync(filepath, bytes);

		// Keep the full-resolution capture for OCR only. Serving it would cost
		// visitors ~4300px of image on a page rendered with `priority`, but
		// downscaling before OCR loses recognition — Colruyt fell from 60 deals to
		// 21 when the optimised image was the only copy. This directory is not
		// under public/ and is never served.
		try {
			if (!fs.existsSync(OCR_SOURCE_DIR)) {
				fs.mkdirSync(OCR_SOURCE_DIR, { recursive: true });
			}
			fs.writeFileSync(path.join(OCR_SOURCE_DIR, path.basename(filepath)), raw);
		} catch {
			// OCR source is an optimisation; failing to keep it must not fail a page.
		}

		const stored = await storePageImage(path.basename(filepath), bytes, (m) =>
			this.log(m),
		);

		// A missing thumbnail costs bytes, not correctness — the viewer falls back
		// to the full page image — so a failure here must never drop the page.
		let thumbUrl: string | undefined;
		try {
			const thumbName = BaseScraper.thumbFilename(path.basename(filepath));
			const sharp = (await import("sharp")).default;
			const thumbBytes = await sharp(bytes, { limitInputPixels: false })
				.resize({ width: BaseScraper.THUMB_IMAGE_WIDTH, withoutEnlargement: true })
				.webp({ quality: BaseScraper.THUMB_IMAGE_QUALITY })
				.toBuffer();
			fs.writeFileSync(path.join(path.dirname(filepath), thumbName), thumbBytes);
			const storedThumb = await storePageImage(thumbName, thumbBytes, (m) =>
				this.log(m),
			);
			thumbUrl = storedThumb.url;
		} catch {
			// Fall through: page.thumbnailUrl stays undefined.
		}

		return { status: "written", url: stored.url, thumbUrl };
	}

	/**
	 * Week tag used in screenshot filenames, e.g. "2026-w32".
	 * Mirrors generateFolderId() so OCR can locate this week's leaflet images.
	 */
	protected currentWeekTag(date: Date = new Date()): string {
		return `${date.getFullYear()}-w${this.getWeekNumber(date)}`;
	}

	/**
	 * Which method actually produced the deals, for provenance in the database.
	 *
	 * ctx.methods mixes two kinds of entry: how the folder was *found* (issuu,
	 * publitas, screenshot) and how deals were *extracted* (html, pdf-text,
	 * ocr). Recording the first entry attributed OCR-derived rows to "issuu",
	 * which matters because confidence in a price depends on how it was read.
	 * The last extraction method wins: fallbacks run in ascending order of
	 * desperation, so the final one is the one that yielded the deals.
	 */
	protected dealExtractionMethod(methods: ContentSource[]): ContentSource {
		const extraction: ContentSource[] = [
			"html",
			"api",
			"pdf-text",
			"page-text",
			"ocr",
		];
		for (let i = methods.length - 1; i >= 0; i--) {
			if (extraction.includes(methods[i])) return methods[i];
		}
		return methods[0] ?? "unknown";
	}

	protected getWeekNumber(date: Date): number {
		const d = new Date(
			Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()),
		);
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
				const rest = { ...(f as unknown as Record<string, unknown>) };
				delete rest.scrapedAt;
				return rest;
			}),
			deals: data.deals,
		};
	}
}
