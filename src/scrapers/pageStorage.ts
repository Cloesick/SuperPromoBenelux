// ---------------------------------------------------------------------------
// Where folder page images live
//
// public/ has never been committed to this repository, so a deploy from git
// serves no page images at all. Committing them is not viable either: the
// screenshots are ~140 MB per week and regenerated daily, which would grow git
// history by several GB a year and be cloned on every CI checkout.
//
// So page images are uploaded to blob storage and the folder JSON stores the
// absolute URL. The frontend needs no change: next.config.ts already allows
// `remotePatterns: hostname: "**"` and the viewer renders `unoptimized`.
//
// When no storage is configured this falls back to the local /screenshots path,
// so `npm run scrape` keeps working offline and in development exactly as
// before.
// ---------------------------------------------------------------------------

/** Public path used when no blob storage is configured. */
export function localPagePath(filename: string): string {
	return `/screenshots/${filename}`;
}

/** True when blob uploads are configured for this process. */
export function isBlobConfigured(): boolean {
	return !!process.env.BLOB_READ_WRITE_TOKEN;
}

export interface StoredPage {
	/** URL to record in the folder JSON: absolute when uploaded, else site-relative. */
	url: string;
	/** Whether the bytes were uploaded rather than only written locally. */
	uploaded: boolean;
}

/**
 * Store one folder page image and return the URL the site should render.
 *
 * Filenames already carry the ISO week (`colruyt-2026-w32-viewerimg-p1.webp`),
 * so uploads are immutable and safe to cache for a year. `addRandomSuffix` is
 * disabled for the same reason — re-running a scrape should overwrite the same
 * key rather than accumulate copies.
 *
 * Never throws: an upload failure falls back to the local path so the scrape
 * still produces a usable folder.
 */
export async function storePageImage(
	filename: string,
	bytes: Buffer,
	onProgress?: (msg: string) => void,
): Promise<StoredPage> {
	if (!isBlobConfigured()) {
		return { url: localPagePath(filename), uploaded: false };
	}

	try {
		const { put } = await import("@vercel/blob");
		const result = await put(`screenshots/${filename}`, bytes, {
			access: "public",
			contentType: "image/webp",
			addRandomSuffix: false,
			allowOverwrite: true,
			cacheControlMaxAge: 31_536_000,
		});
		return { url: result.url, uploaded: true };
	} catch (err) {
		onProgress?.(
			`  Blob upload failed for ${filename}, falling back to local path: ${err}`,
		);
		return { url: localPagePath(filename), uploaded: false };
	}
}
