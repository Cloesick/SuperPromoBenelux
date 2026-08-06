import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FolderViewer } from "./FolderViewer";
import type { Folder, Retailer } from "@/lib/types";

vi.mock("next/image", () => {
	return {
		default: (props: any) => {
			// next/image renders an img-like element for tests
			// Strip Next/Image-only props that would otherwise create noisy React warnings.
			const rest = { ...props };
			delete rest.priority;
			delete rest.placeholder;
			delete rest.blurDataURL;
			delete rest.fill;
			delete rest.quality;
			delete rest.loader;
			// eslint-disable-next-line @next/next/no-img-element
			return <img alt={rest.alt ?? ""} {...rest} />;
		},
	};
});

const baseRetailer: Retailer = {
	slug: "test",
	name: "Test",
	logo: "/logo.webp",
	color: "#000000",
	website: "https://example.com",
	description: "Test retailer",
	category: "supermarkt",
	verticals: ["general"],
	seo: {
		folderDay: "maandag",
		folderDayDetail: "Elke maandag",
		storeCount: "1",
		pricePositioning: "goedkoop",
		loyalty: "ja",
		openingHours: "9-17",
		uniqueSellingPoint: "USP",
	},
};

function makeFolder(partial: Partial<Folder>): Folder {
	return {
		id: "f1",
		retailerSlug: baseRetailer.slug,
		title: "Test folder",
		validFrom: "2026-01-01",
		validUntil: "2026-01-07",
		pageCount: 0,
		thumbnailUrl: "",
		pages: [],
		contentSource: "unknown",
		scrapedAt: new Date().toISOString(),
		...partial,
	};
}

describe("FolderViewer", () => {
	it("prefers pages mode when pages exist (even if embedUrl exists)", async () => {
		const folder = makeFolder({
			pages: [
				{ pageNumber: 1, imageUrl: "/p1.webp", deals: [] },
				{ pageNumber: 2, imageUrl: "/p2.webp", deals: [] },
			],
			pageCount: 2,
			embedUrl: "https://example.com/embed",
		});

		render(<FolderViewer folder={folder} retailer={baseRetailer} />);

		expect(await screen.findByText(/Pagina 1 van 2/i)).toBeInTheDocument();
		expect(document.querySelector("iframe")).toBeNull();
	});

	it("navigates next/prev in pages mode", async () => {
		const user = userEvent.setup();
		const folder = makeFolder({
			pages: [
				{ pageNumber: 1, imageUrl: "/p1.webp", deals: [] },
				{ pageNumber: 2, imageUrl: "/p2.webp", deals: [] },
			],
			pageCount: 2,
		});

		render(<FolderViewer folder={folder} retailer={baseRetailer} />);

		expect(await screen.findByText(/Pagina 1 van 2/i)).toBeInTheDocument();

		await user.click(screen.getByRole("button", { name: "Volgende" }));
		expect(await screen.findByText(/Pagina 2 van 2/i)).toBeInTheDocument();

		await user.click(screen.getByRole("button", { name: "Vorige" }));
		expect(await screen.findByText(/Pagina 1 van 2/i)).toBeInTheDocument();
	});

	it("renders embed iframe when no pages exist and embedUrl is present", async () => {
		const folder = makeFolder({
			embedUrl: "https://example.com/embed",
			pages: [],
			pageCount: 0,
		});

		render(<FolderViewer folder={folder} retailer={baseRetailer} />);

		// The embed UI should exist
		expect(await screen.findByText("Volledig scherm")).toBeInTheDocument();
		const iframe = document.querySelector("iframe");
		expect(iframe).not.toBeNull();
		expect(iframe?.getAttribute("src")).toContain("https://example.com/embed");
	});
});

// ---------------------------------------------------------------------------
// Fallback scenario tests
// ---------------------------------------------------------------------------

describe("FolderViewer fallback scenarios", () => {
	it("shows expired folder banner when validUntil is in the past and no pages", () => {
		const folder = makeFolder({
			validUntil: "2020-01-01",
			pages: [],
			pageCount: 0,
		});

		render(<FolderViewer folder={folder} retailer={baseRetailer} />);

		expect(screen.getByText("Deze folder is verlopen")).toBeInTheDocument();
		expect(
			screen.getByText(/De nieuwe Test folder wordt binnenkort verwacht/),
		).toBeInTheDocument();
	});

	it("shows retailer website link on expired folder", () => {
		const folder = makeFolder({
			validUntil: "2020-01-01",
			pages: [],
			pageCount: 0,
		});

		render(<FolderViewer folder={folder} retailer={baseRetailer} />);

		const link = screen.getByText(/Bekijk de website van Test/);
		expect(link).toBeInTheDocument();
		expect(link.closest("a")).toHaveAttribute("href", "https://example.com");
		expect(link.closest("a")).toHaveAttribute("target", "_blank");
	});

	it("treats Publitas embed as offline when folder is expired", () => {
		const folder = makeFolder({
			validUntil: "2020-01-01",
			embedUrl: "https://view.publitas.com/x/y/page/1",
			pages: [],
			pageCount: 0,
		});

		render(<FolderViewer folder={folder} retailer={baseRetailer} />);

		// Should NOT render an iframe — embed is treated as offline
		expect(document.querySelector("iframe")).toBeNull();
		// Should show expired banner
		expect(screen.getByText("Deze folder is verlopen")).toBeInTheDocument();
	});

	it("treats Folderz embed as offline when folder is expired", () => {
		const folder = makeFolder({
			validUntil: "2020-01-01",
			embedUrl: "https://www.folderz.be/something",
			pages: [],
			pageCount: 0,
		});

		render(<FolderViewer folder={folder} retailer={baseRetailer} />);

		expect(document.querySelector("iframe")).toBeNull();
		expect(screen.getByText("Deze folder is verlopen")).toBeInTheDocument();
	});

	it("treats Publitas PDF as offline when folder is expired", () => {
		const folder = makeFolder({
			validUntil: "2020-01-01",
			pdfUrl: "https://view.publitas.com/x/y.pdf",
			pages: [],
			pageCount: 0,
		});

		render(<FolderViewer folder={folder} retailer={baseRetailer} />);

		// PDF should not be shown
		expect(screen.getByText("Deze folder is verlopen")).toBeInTheDocument();
	});

	it("still shows non-Publitas embed even when folder is expired", () => {
		const folder = makeFolder({
			validUntil: "2020-01-01",
			embedUrl: "https://e.issuu.com/embed.html?u=colruyt&d=abc",
			pages: [],
			pageCount: 0,
		});

		render(<FolderViewer folder={folder} retailer={baseRetailer} />);

		// Issuu is not in the offline-risk list, so iframe should still render
		const iframe = document.querySelector("iframe");
		expect(iframe).not.toBeNull();
	});

	it("shows pages mode with screenshot fallback even when embed exists", () => {
		const folder = makeFolder({
			embedUrl: "https://view.publitas.com/x/y/page/1",
			pages: [
				{ pageNumber: 1, imageUrl: "/screenshots/p1.webp", deals: [] },
				{ pageNumber: 2, imageUrl: "/screenshots/p2.webp", deals: [] },
			],
			pageCount: 2,
		});

		render(<FolderViewer folder={folder} retailer={baseRetailer} />);

		// Pages mode is preferred when pages exist
		expect(screen.getByText(/Pagina 1 van 2/i)).toBeInTheDocument();
		expect(document.querySelector("iframe")).toBeNull();
	});

	it("shows pages from screenshots on expired folder with pages available", async () => {
		const folder = makeFolder({
			validUntil: "2020-01-01",
			embedUrl: "https://view.publitas.com/x/y/page/1",
			pages: [
				{ pageNumber: 1, imageUrl: "/screenshots/p1.webp", deals: [] },
				{ pageNumber: 2, imageUrl: "/screenshots/p2.webp", deals: [] },
			],
			pageCount: 2,
		});

		render(<FolderViewer folder={folder} retailer={baseRetailer} />);

		// Even though folder is expired, pages should render since screenshots are available
		expect(await screen.findByText(/Pagina 1 van 2/i)).toBeInTheDocument();
	});

	it("Colruyt always uses pages mode (forcePagesOnly)", () => {
		const colruytRetailer = {
			...baseRetailer,
			slug: "colruyt",
			name: "Colruyt",
		};
		const folder = makeFolder({
			retailerSlug: "colruyt",
			embedUrl: "https://e.issuu.com/embed.html?u=colruyt&d=abc",
			pages: [{ pageNumber: 1, imageUrl: "/p1.webp", deals: [] }],
			pageCount: 1,
		});

		render(<FolderViewer folder={folder} retailer={colruytRetailer} />);

		// Colruyt forces pages mode — no iframe even though embedUrl exists
		expect(document.querySelector("iframe")).toBeNull();
	});

	it("shows loading placeholder when no pages, no embed, not expired", () => {
		const futureDate = new Date(Date.now() + 7 * 24 * 3_600_000);
		const dateStr = futureDate.toISOString().split("T")[0];
		const folder = makeFolder({
			validUntil: dateStr,
			pages: [],
			pageCount: 0,
		});

		render(<FolderViewer folder={folder} retailer={baseRetailer} />);

		expect(
			screen.getByText(/folderpagina.s worden binnenkort geladen/i),
		).toBeInTheDocument();
	});
});

// ---------------------------------------------------------------------------
// Rendering failures that previously produced a page that looked healthy
// ---------------------------------------------------------------------------

describe("FolderViewer — silent failure modes", () => {
	it("falls back to the placeholder when every page image 404s", async () => {
		// public/ was never committed, so every /screenshots/* URL 404s in
		// production. Without onError the counter, thumbnails and arrows render
		// around an invisible image and the folder looks merely empty.
		const folder = makeFolder({
			pages: [
				{ pageNumber: 1, imageUrl: "/missing-1.webp", deals: [] },
				{ pageNumber: 2, imageUrl: "/missing-2.webp", deals: [] },
			],
			pageCount: 2,
			validUntil: "2999-01-01",
		});

		render(<FolderViewer folder={folder} retailer={baseRetailer} />);
		expect(screen.getByText(/Pagina 1 van 2/)).toBeInTheDocument();

		for (const img of screen.getAllByRole("img")) {
			fireEvent.error(img);
		}

		// Mode re-selection runs in an effect, so the fallback lands a tick later.
		await waitFor(() => {
			expect(screen.queryByText(/Pagina 1 van 2/)).not.toBeInTheDocument();
		});
		expect(screen.getByText(/worden binnenkort geladen/i)).toBeInTheDocument();
	});

	it("prefers a working embed over pages whose images all failed", async () => {
		const folder = makeFolder({
			pages: [{ pageNumber: 1, imageUrl: "/missing-1.webp", deals: [] }],
			pageCount: 1,
			embedUrl: "https://e.issuu.com/embed.html?d=x",
			validUntil: "2999-01-01",
		});

		const { container } = render(
			<FolderViewer folder={folder} retailer={baseRetailer} />,
		);
		expect(container.querySelector("iframe")).toBeNull();

		for (const img of screen.getAllByRole("img")) {
			fireEvent.error(img);
		}

		await waitFor(() => {
			expect(container.querySelector("iframe")).not.toBeNull();
		});
	});

	it("warns that an expired folder's prices may be stale, even in pages mode", () => {
		// The expired card lower down is unreachable once pages exist, so an
		// expired folder used to render last week's prices with no notice.
		const folder = makeFolder({
			pages: [{ pageNumber: 1, imageUrl: "/p1.webp", deals: [] }],
			pageCount: 1,
			validUntil: "2020-01-07",
		});

		render(<FolderViewer folder={folder} retailer={baseRetailer} />);
		expect(screen.getByText(/Pagina 1 van 1/)).toBeInTheDocument();
		expect(screen.getByText(/verlopen/i)).toBeInTheDocument();
		expect(screen.getByText(/niet meer geldig/i)).toBeInTheDocument();
	});

	it("does not iframe a consent-manager or CDN URL recorded as an embed", () => {
		// aldi carried a Usercentrics cross-domain-bridge and coolblue an
		// Optimizely client_storage URL — both render a blank white iframe.
		for (const junk of [
			"https://app.usercentrics.eu/browser-sdk/x/cross-domain-bridge.html",
			"https://a6689543890403328.cdn.optimizely.com/client_storage/x.html",
		]) {
			const { container, unmount } = render(
				<FolderViewer
					folder={makeFolder({ embedUrl: junk, validUntil: "2999-01-01" })}
					retailer={baseRetailer}
				/>,
			);
			expect(container.querySelector("iframe"), junk).toBeNull();
			unmount();
		}
	});

	it("does not iframe a PDF served as a forced download", () => {
		// An attachment-disposition URL downloads instead of rendering, leaving
		// a grey frame. Keep the link, drop the embedded viewer.
		const folder = makeFolder({
			pdfUrl:
				"https://s3.example.com/folder.pdf?response-content-disposition=attachment",
			validUntil: "2999-01-01",
		});

		const { container } = render(
			<FolderViewer folder={folder} retailer={baseRetailer} />,
		);
		expect(container.querySelector("iframe")).toBeNull();
	});

	it("draws the thumbnail strip from thumbnailUrl, not the full page image", () => {
		// next/image runs unoptimized, so a strip entry pointing at imageUrl makes
		// the visitor download the full-size page to fill a 64x88 box — 26 MB to
		// render IKEA's 60 thumbnails.
		const folder = makeFolder({
			pages: [
				{
					pageNumber: 1,
					imageUrl: "/p1.webp",
					thumbnailUrl: "/p1-thumb.webp",
					deals: [],
				},
				{
					pageNumber: 2,
					imageUrl: "/p2.webp",
					thumbnailUrl: "/p2-thumb.webp",
					deals: [],
				},
			],
			validUntil: "2999-01-01",
		});

		const { container } = render(
			<FolderViewer folder={folder} retailer={baseRetailer} />,
		);
		const srcs = [...container.querySelectorAll("img")].map((img) =>
			img.getAttribute("src"),
		);

		expect(srcs).toContain("/p1-thumb.webp");
		expect(srcs).toContain("/p2-thumb.webp");
		// The page being read is still the full-resolution image.
		expect(srcs).toContain("/p1.webp");
		expect(srcs).not.toContain("/p2.webp");
	});

	it("falls back to the full page image when a page has no thumbnail", () => {
		// Folders scraped before thumbnails existed must still render a strip.
		const folder = makeFolder({
			pages: [
				{ pageNumber: 1, imageUrl: "/p1.webp", deals: [] },
				{ pageNumber: 2, imageUrl: "/p2.webp", deals: [] },
			],
			validUntil: "2999-01-01",
		});

		const { container } = render(
			<FolderViewer folder={folder} retailer={baseRetailer} />,
		);
		const srcs = [...container.querySelectorAll("img")].map((img) =>
			img.getAttribute("src"),
		);
		expect(srcs).toContain("/p2.webp");
	});

	it("survives a folder JSON with no pages key at all", () => {
		const folder = makeFolder({ validUntil: "2999-01-01" });
		// Simulates malformed scraper output reaching a client component.
		delete (folder as Partial<Folder>).pages;

		expect(() =>
			render(<FolderViewer folder={folder} retailer={baseRetailer} />),
		).not.toThrow();
	});
});
