import { describe, expect, it } from "vitest";
import {
	hasUsableEmbed,
	hasUsablePdf,
	isEmbedBlocked,
	isJunkEmbedUrl,
	isPdfForcedDownload,
	isFolderExpired,
	isFolderIndexable,
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

describe("isFolderExpired", () => {
	const during = new Date("2026-08-09T14:00:00");
	const after = new Date("2026-08-10T00:00:01");

	it("keeps a folder valid through the whole of its last day", () => {
		// The bug this replaces: `new Date("2026-08-09")` is UTC midnight, so a
		// folder was retired on the morning of the day it was still valid.
		expect(isFolderExpired("2026-08-09", during)).toBe(false);
	});

	it("expires it once the last day has passed", () => {
		expect(isFolderExpired("2026-08-09", after)).toBe(true);
	});

	it("treats a missing or unparseable date as not expired", () => {
		// Losing real content over a formatting problem is the worse failure.
		expect(isFolderExpired(undefined, after)).toBe(false);
		expect(isFolderExpired("not-a-date", after)).toBe(false);
	});
});

describe("isFolderIndexable", () => {
	const future = "2099-01-01";

	it("indexes a folder with captured pages", () => {
		expect(isFolderIndexable({ pages: [{}], validUntil: future }, "colruyt")).toBe(true);
	});

	it("indexes a folder whose embed the viewer can frame", () => {
		expect(
			isFolderIndexable(
				{ embedUrl: "https://folder.example.com/leaflet/2026-w32/", validUntil: future },
				"aveve",
			),
		).toBe(true);
	});

	it("indexes a Publitas folder via its PDF, not its embed", () => {
		// view.publitas.com sends X-Frame-Options, so the embed is unusable and
		// the inline PDF is the only thing that renders. This is how the 15
		// harvested retailers earn their place in the sitemap.
		const folder = {
			embedUrl: "https://view.publitas.com/brico-folder/brico-f10/",
			pdfUrl: "https://view.publitas.com/95978/3131030/pdfs/a.pdf",
			validUntil: future,
		};
		expect(hasUsableEmbed(folder.embedUrl, "brico")).toBe(false);
		expect(isFolderIndexable(folder, "brico")).toBe(true);
	});

	it("refuses a folder that renders nothing at all", () => {
		expect(
			isFolderIndexable(
				{
					pdfUrl: "https://s3.example.com/a.pdf?response-content-disposition=attachment",
					validUntil: future,
				},
				"lidl",
			),
		).toBe(false);
	});

	it("refuses an expired folder even when it still has an embed", () => {
		// brico sat six weeks past validUntil, still in the sitemap at priority
		// 0.8, while Publitas had already taken the embed offline.
		expect(
			isFolderIndexable(
				{
					embedUrl: "https://view.publitas.com/brico/x/",
					pdfUrl: "https://view.publitas.com/95978/3131030/pdfs/a.pdf",
					validUntil: "2026-06-24",
				},
				"brico",
			),
		).toBe(false);
	});

	it("refuses a missing folder", () => {
		expect(isFolderIndexable(null, "aldi")).toBe(false);
	});
});
