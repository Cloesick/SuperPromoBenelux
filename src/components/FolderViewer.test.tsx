import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
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
	logo: "/logo.png",
	color: "#000000",
	website: "https://example.com",
	description: "Test retailer",
	category: "supermarkt",
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
				{ pageNumber: 1, imageUrl: "/p1.png", deals: [] },
				{ pageNumber: 2, imageUrl: "/p2.png", deals: [] },
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
				{ pageNumber: 1, imageUrl: "/p1.png", deals: [] },
				{ pageNumber: 2, imageUrl: "/p2.png", deals: [] },
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
				{ pageNumber: 1, imageUrl: "/screenshots/p1.png", deals: [] },
				{ pageNumber: 2, imageUrl: "/screenshots/p2.png", deals: [] },
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
				{ pageNumber: 1, imageUrl: "/screenshots/p1.png", deals: [] },
				{ pageNumber: 2, imageUrl: "/screenshots/p2.png", deals: [] },
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
			pages: [{ pageNumber: 1, imageUrl: "/p1.png", deals: [] }],
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
