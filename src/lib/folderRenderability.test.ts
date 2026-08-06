import { describe, expect, it } from "vitest";
import {
	hasUsableEmbed,
	hasUsablePdf,
	isEmbedBlocked,
	isJunkEmbedUrl,
	isPdfForcedDownload,
} from "./folderRenderability";

// ---------------------------------------------------------------------------
// These predicates decide two things at once: what FolderViewer renders, and
// what the sitemap submits to Google. They were duplicated and drifted, which
// put albert-heijn and lidl — pages that render nothing whatsoever — into the
// sitemap at weekly priority 0.8.
// ---------------------------------------------------------------------------

describe("isJunkEmbedUrl", () => {
	it("rejects consent managers and tracking bridges recorded as embeds", () => {
		expect(
			isJunkEmbedUrl("https://app.eu.usercentrics.eu/cross-domain-bridge.html"),
		).toBe(true);
		expect(isJunkEmbedUrl("https://cdn.optimizely.com/client_storage.html")).toBe(
			true,
		);
		expect(isJunkEmbedUrl("https://consent.cookiebot.com/x")).toBe(true);
	});

	it("accepts a genuine leaflet viewer", () => {
		expect(isJunkEmbedUrl("https://folder.gamma.be/week32")).toBe(false);
	});

	it("treats an unparseable URL as unusable rather than throwing", () => {
		expect(isJunkEmbedUrl("not a url")).toBe(true);
	});

	it("is not fooled by a junk host appearing as a path segment", () => {
		expect(isJunkEmbedUrl("https://folder.gamma.be/usercentrics.eu")).toBe(false);
	});
});

describe("isEmbedBlocked", () => {
	it("blocks hosts that refuse framing", () => {
		// albert-heijn's embed is a Publitas URL: it holds a real leaflet, but
		// X-Frame-Options means the iframe stays blank.
		expect(isEmbedBlocked("https://view.publitas.com/x/y", "albert-heijn")).toBe(
			true,
		);
		expect(isEmbedBlocked("https://folder.aldi.be/week32", "aldi")).toBe(true);
		expect(isEmbedBlocked("https://ah.be/folder", "albert-heijn")).toBe(true);
	});

	it("blocks delhaize regardless of host", () => {
		expect(isEmbedBlocked("https://folder.delhaize.be/x", "delhaize")).toBe(true);
	});

	it("allows a framable retailer viewer", () => {
		expect(isEmbedBlocked("https://folder.kruidvat.be/week32", "kruidvat")).toBe(
			false,
		);
	});

	it("reports no block when there is no embed at all", () => {
		expect(isEmbedBlocked(undefined, "lidl")).toBe(false);
		// ...but that is not the same as having something to render.
		expect(hasUsableEmbed(undefined, "lidl")).toBe(false);
	});
});

describe("isPdfForcedDownload", () => {
	it("detects attachment-disposition signed URLs", () => {
		expect(
			isPdfForcedDownload(
				"https://s3.example.com/f.pdf?response-content-disposition=attachment",
			),
		).toBe(true);
	});

	it("accepts an inline PDF", () => {
		expect(isPdfForcedDownload("https://example.com/folder.pdf")).toBe(false);
		expect(hasUsablePdf("https://example.com/folder.pdf")).toBe(true);
	});

	it("treats a missing PDF as unusable", () => {
		expect(hasUsablePdf(undefined)).toBe(false);
	});
});

describe("the cases that were wrongly indexed", () => {
	it("lidl: no embed and an attachment-only PDF renders nothing", () => {
		const embedUrl = undefined;
		const pdfUrl =
			"https://s3.example.com/lidl.pdf?response-content-disposition=attachment";
		expect(hasUsableEmbed(embedUrl, "lidl")).toBe(false);
		expect(hasUsablePdf(pdfUrl)).toBe(false);
	});

	it("zalando: a consent-bridge embed is not renderable content", () => {
		expect(
			hasUsableEmbed(
				"https://app.eu.usercentrics.eu/cross-domain-bridge.html",
				"zalando",
			),
		).toBe(false);
	});
});
