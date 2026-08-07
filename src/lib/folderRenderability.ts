// ---------------------------------------------------------------------------
// Whether a folder can actually be rendered.
//
// FolderViewer and the sitemap were deciding this separately, and disagreed.
// The sitemap counted any folder with an `embedUrl` or `pdfUrl` as renderable,
// while the viewer refuses both in specific cases — so Google was invited to
// index pages that render nothing:
//
//   lidl     no pages, no embed, PDF is attachment-disposition -> empty page
//   zalando  embedUrl points at a Usercentrics consent bridge  -> blank iframe
//
// These predicates are the single source of truth for both.
// ---------------------------------------------------------------------------

/**
 * Hosts that are not leaflet viewers at all: consent managers, CDN client
 * storage and tracking bridges that earlier scrapes recorded as an embedUrl.
 * coolblue carried an Optimizely client_storage URL and aldi a Usercentrics
 * cross-domain-bridge — both render a blank white iframe. New scrapes reject
 * these via the iframe size check in base.ts findEmbed; this covers folder JSON
 * already written.
 */
const JUNK_EMBED_HOSTS =
	/(?:^|\.)(?:usercentrics\.eu|optimizely\.com|cookielaw\.org|onetrust\.com|cookiebot\.com|consensu\.org|googletagmanager\.com|doubleclick\.net|pinterest\.com)$/i;

/** True when an embed URL points at something that is not a leaflet viewer. */
export function isJunkEmbedUrl(embedUrl?: string | null): boolean {
	if (!embedUrl) return false;
	try {
		return JUNK_EMBED_HOSTS.test(new URL(embedUrl).hostname);
	} catch {
		// An unparseable URL cannot be framed either.
		return true;
	}
}

/**
 * Hosts that serve a real leaflet but refuse to be framed
 * (X-Frame-Options: SAMEORIGIN/DENY), so the iframe stays blank.
 */
function isFrameRefusingHost(host: string): boolean {
	return (
		host === "ah.be" ||
		host.endsWith(".ah.be") ||
		host === "folder.aldi.be" ||
		host.endsWith(".folder.aldi.be") ||
		host === "view.publitas.com" ||
		host.endsWith(".publitas.com")
	);
}

/**
 * True when an embed URL addresses a viewer's homepage rather than a specific
 * leaflet — no path and no query, so nothing identifies a publication.
 *
 * Gamma recorded `https://folder.gamma.be/` because its navigation links the
 * bare viewer homepage and that matched the same pattern as a real folder link.
 * The page then rendered full chrome around a permanently empty iframe, while
 * Kruidvat's deep link on the identical platform loads its leaflet fine.
 */
export function isBareViewerHomepage(embedUrl?: string | null): boolean {
	if (!embedUrl) return false;
	try {
		const u = new URL(embedUrl);
		const hasPath = u.pathname.replace(/\/+$/, "").length > 0;
		return !hasPath && !u.search;
	} catch {
		return false;
	}
}

/**
 * True when an embed cannot be rendered — it is not a viewer at all, it points
 * at a viewer homepage rather than a leaflet, or the host refuses framing.
 * Delhaize is blocked wholesale regardless of host.
 */
export function isEmbedBlocked(
	embedUrl?: string | null,
	retailerSlug?: string,
): boolean {
	if (!embedUrl) return false;
	if (retailerSlug === "delhaize") return true;
	if (isJunkEmbedUrl(embedUrl)) return true;
	if (isBareViewerHomepage(embedUrl)) return true;
	try {
		return isFrameRefusingHost(new URL(embedUrl).hostname);
	} catch {
		return true;
	}
}

/** True when an embed URL is present and can actually be rendered. */
export function hasUsableEmbed(
	embedUrl?: string | null,
	retailerSlug?: string,
): boolean {
	return !!embedUrl && !isEmbedBlocked(embedUrl, retailerSlug);
}

/**
 * True when a PDF URL forces a download instead of rendering.
 *
 * albert-heijn, gamma, kruidvat, treac and lidl all sign their PDF links with
 * `response-content-disposition=attachment`, which an iframe cannot display —
 * the visitor gets a grey box. The download link still works, so the URL is
 * kept; it just cannot stand in for renderable content.
 */
export function isPdfForcedDownload(pdfUrl?: string | null): boolean {
	return !!pdfUrl && /response-content-disposition=attachment/i.test(pdfUrl);
}

/** True when a PDF URL is present and can be framed. */
export function hasUsablePdf(pdfUrl?: string | null): boolean {
	return !!pdfUrl && !isPdfForcedDownload(pdfUrl);
}

/**
 * True once a folder's validity window has passed.
 *
 * A leaflet is good through the whole of its last day, so the cutoff is the end
 * of `validUntil` in local time. This existed twice with different meanings —
 * folders.ts parsed the bare date, which is UTC midnight and expires a folder a
 * full day early, while FolderViewer appended `T23:59:59`. One folder could be
 * "current" to the page and "expired" to the viewer on the same afternoon.
 *
 * Unparseable dates are treated as not expired: dropping a folder because its
 * date is malformed loses real content over a formatting problem.
 */
export function isFolderExpired(
	validUntil?: string | null,
	now: Date = new Date(),
): boolean {
	if (!validUntil) return false;
	const until = new Date(`${validUntil}T23:59:59`);
	if (Number.isNaN(until.getTime())) return false;
	return until < now;
}

/** The folder shape these predicates need — a structural subset of `Folder`. */
export interface IndexableFolder {
	pages?: unknown[];
	embedUrl?: string | null;
	pdfUrl?: string | null;
	validUntil?: string | null;
}

/**
 * True when a folder page is worth putting in front of a search engine.
 *
 * This is the single predicate behind both the sitemap and the page's `robots`
 * tag, so the two cannot disagree — a URL we submit is always one we want
 * indexed. It has to answer the visitor's question, not merely exist:
 *
 *  - no pages, no framable embed, no inline PDF → the page renders an empty
 *    state, and advertising that is worse than staying silent;
 *  - expired → Publitas takes the embed offline after `validUntil`, so the page
 *    shows "binnenkort verwacht" and the leaflet is gone. brico sat six weeks
 *    past its window, still in the sitemap at priority 0.8.
 */
export function isFolderIndexable(
	folder?: IndexableFolder | null,
	retailerSlug?: string,
): boolean {
	if (!folder) return false;
	if (isFolderExpired(folder.validUntil)) return false;
	return (
		(folder.pages?.length ?? 0) > 0 ||
		hasUsableEmbed(folder.embedUrl, retailerSlug) ||
		hasUsablePdf(folder.pdfUrl)
	);
}
