import fs from "fs";
import path from "path";
import { Folder, Deal, ScrapedData, Vertical } from "./types";
import { getRetailerSlugsForVertical } from "./retailers";
import { isFolderExpired } from "./folderRenderability";

const DATA_DIR = path.join(process.cwd(), "data", "folders");

function readScrapedData(retailerSlug: string): ScrapedData | null {
	const filePath = path.join(DATA_DIR, `${retailerSlug}.json`);
	if (!fs.existsSync(filePath)) return null;

	try {
		const raw = fs.readFileSync(filePath, "utf-8");
		return JSON.parse(raw);
	} catch {
		console.error(`Failed to read folder data for ${retailerSlug}`);
		return null;
	}
}

export function getFoldersForRetailer(retailerSlug: string): Folder[] {
	const data = readScrapedData(retailerSlug);
	return data?.folders ?? [];
}

export function getDealsForRetailer(retailerSlug: string): Deal[] {
	const data = readScrapedData(retailerSlug);
	return data?.deals ?? [];
}

export function getCurrentFolder(retailerSlug: string): Folder | null {
	const folders = getFoldersForRetailer(retailerSlug);
	if (folders.length === 0) return null;

	const now = new Date();
	// `new Date("2026-08-09")` is UTC midnight, which retired a folder a full
	// day before it actually expired. isFolderExpired runs to the end of the
	// last valid day, and is the same rule the viewer and the sitemap use.
	const current = folders.find(
		(f) => now >= new Date(f.validFrom) && !isFolderExpired(f.validUntil, now),
	);

	return current ?? folders[0];
}

export function getScrapedAt(retailerSlug: string): Date | null {
	const data = readScrapedData(retailerSlug);
	return data?.scrapedAt ? new Date(data.scrapedAt) : null;
}

export function getAllCurrentFolders(): { slug: string; folder: Folder }[] {
	if (!fs.existsSync(DATA_DIR)) return [];

	const files = fs.readdirSync(DATA_DIR).filter((f) => f.endsWith(".json"));

	return files
		.map((file) => {
			const slug = file.replace(".json", "");
			const folder = getCurrentFolder(slug);
			if (!folder) return null;
			return { slug, folder };
		})
		.filter(Boolean) as { slug: string; folder: Folder }[];
}

export function getCurrentFoldersForVertical(
	vertical: Vertical,
): { slug: string; folder: Folder }[] {
	const slugs = new Set(getRetailerSlugsForVertical(vertical));
	return getAllCurrentFolders().filter(({ slug }) => slugs.has(slug));
}

/**
 * The bits of a folder a listing card needs, safe to hand to a client component.
 *
 * The index pages listed retailers as logo + category + a generic sentence and
 * showed no leaflet at all — asking visitors to click on faith, on a site whose
 * entire product is the leaflet. The cover, the page count and the validity
 * window are all already in the scraped data; this is what carries them across
 * the server/client boundary without shipping whole folder objects.
 */
export interface FolderPreview {
	/** Absolute (blob) or site-relative cover image URL. */
	coverUrl?: string;
	pageCount: number;
	validFrom?: string;
	validUntil?: string;
	expired: boolean;
}

/** Preview for one retailer, or null when it has no current folder. */
export function getFolderPreview(retailerSlug: string): FolderPreview | null {
	const folder = getCurrentFolder(retailerSlug);
	if (!folder) return null;

	const pages = folder.pages ?? [];
	return {
		// The folder thumbnail is the scraper's own choice of cover; page one is
		// the fallback, because a folder that renders always has a first page.
		coverUrl: folder.thumbnailUrl || pages[0]?.thumbnailUrl || pages[0]?.imageUrl,
		pageCount: pages.length,
		validFrom: folder.validFrom,
		validUntil: folder.validUntil,
		expired: isFolderExpired(folder.validUntil),
	};
}

/** Previews keyed by slug, for the listing pages. */
export function getFolderPreviews(slugs: string[]): Record<string, FolderPreview> {
	const out: Record<string, FolderPreview> = {};
	for (const slug of slugs) {
		const preview = getFolderPreview(slug);
		if (preview) out[slug] = preview;
	}
	return out;
}
