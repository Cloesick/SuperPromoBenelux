/**
 * Shapes and renderability rules for data/folders/<slug>.json, shared by the
 * specs that assert against scraped folder data.
 *
 * The predicates below deliberately restate src/lib/folderRenderability.ts
 * instead of importing it. A spec that shares its predicate with the code under
 * test agrees with that code by construction — including when it is wrong — and
 * the earlier version of folder-viewer.cy.ts demonstrated the cost of guessing
 * instead: it asserted a Publitas iframe long after the app had (correctly)
 * stopped rendering one. Keeping a second, independent copy here means a silent
 * change to the app's rules shows up as a failing test rather than as agreement.
 */

export interface FolderPage {
	pageNumber: number;
	imageUrl: string;
	/**
	 * Small variant written by the scraper for the thumbnail strip. Folders
	 * scraped before thumbnails existed do not have one.
	 */
	thumbnailUrl?: string;
	deals?: unknown[];
}

export interface ScrapedFolder {
	id: string;
	retailerSlug?: string;
	title: string;
	validFrom: string;
	validUntil: string;
	pageCount?: number;
	pages?: FolderPage[];
	embedUrl?: string;
	pdfUrl?: string;
}

export interface FolderFile {
	retailer: string;
	scrapedAt: string;
	folders: ScrapedFolder[];
	deals: unknown[];
	sourceUrls?: unknown[];
	methods?: unknown[];
}

export function isRecord(v: unknown): v is Record<string, unknown> {
	return typeof v === "object" && v !== null;
}

/** Consent managers and tracking bridges earlier scrapes recorded as embeds. */
const JUNK_EMBED_HOSTS =
	/(?:^|\.)(?:usercentrics\.eu|optimizely\.com|cookielaw\.org|onetrust\.com|cookiebot\.com|consensu\.org|googletagmanager\.com|doubleclick\.net|pinterest\.com)$/i;

/** Hosts that serve a real leaflet but answer with X-Frame-Options. */
const FRAME_REFUSING_HOSTS =
	/(?:^|\.)(?:ah\.be|folder\.aldi\.be|publitas\.com)$/i;

/** An embed pointing at a viewer's homepage rather than at a leaflet. */
export function isBareViewerHomepage(embedUrl?: string): boolean {
	if (!embedUrl) return false;
	try {
		const u = new URL(embedUrl);
		return u.pathname.replace(/\/+$/, "").length === 0 && !u.search;
	} catch {
		return false;
	}
}

export function isEmbedBlocked(
	embedUrl: string | undefined,
	retailerSlug: string,
): boolean {
	if (!embedUrl) return false;
	if (retailerSlug === "delhaize") return true;
	if (isBareViewerHomepage(embedUrl)) return true;
	try {
		const host = new URL(embedUrl).hostname;
		return JUNK_EMBED_HOSTS.test(host) || FRAME_REFUSING_HOSTS.test(host);
	} catch {
		return true;
	}
}

/** Signed PDF links that download instead of rendering, so cannot be framed. */
export function isPdfForcedDownload(pdfUrl?: string): boolean {
	return !!pdfUrl && /response-content-disposition=attachment/i.test(pdfUrl);
}

/**
 * The viewer FolderViewer should end up in for this folder. Page images win
 * over everything, then a framable embed, then a framable PDF; "empty" means the
 * viewer has nothing it can show and must say so.
 */
export function expectedViewer(
	folder: ScrapedFolder | undefined,
	retailerSlug: string,
): "pages" | "embed" | "pdf" | "empty" {
	if (!folder) return "empty";
	if ((folder.pages ?? []).length > 0) return "pages";
	if (folder.embedUrl && !isEmbedBlocked(folder.embedUrl, retailerSlug)) {
		return "embed";
	}
	if (folder.pdfUrl && !isPdfForcedDownload(folder.pdfUrl)) return "pdf";
	return "empty";
}
