// ---------------------------------------------------------------------------
// Normalise a schema.org `image` value to a single URL string.
//
// schema.org declares `image` as `URL | ImageObject | Array<URL|ImageObject>`,
// and retailers use all three shapes. Coolblue emits an array of three URLs.
//
// That array used to be copied straight into `Deal.imageUrl`, which is typed
// `string` — but the value crosses a `page.evaluate` boundary as `any`, so the
// compiler never saw the violation. It survived validation (which does not
// inspect imageUrl) and reached better-sqlite3, which refuses to bind an array:
// "SQLite3 can only bind numbers, strings, bigints, buffers, and null". The
// insert is wrapped in a per-deal try/catch, so all 22 Coolblue rows were
// silently dropped while the scrape reported success — losing the only
// extraction path in the system with 100% price coverage.
// ---------------------------------------------------------------------------

/**
 * Best single image URL from a schema.org `image` value, or undefined.
 *
 * Returns undefined rather than a placeholder for anything unrecognised: a
 * missing image costs nothing, while a wrong one is rendered to visitors.
 */
export function normalizeSchemaImage(value: unknown): string | undefined {
	if (typeof value === "string") {
		return value.trim() || undefined;
	}

	if (Array.isArray(value)) {
		// First usable entry wins; ordering in schema.org is the publisher's
		// preference, and entries may themselves be ImageObjects.
		for (const entry of value) {
			const resolved = normalizeSchemaImage(entry);
			if (resolved) return resolved;
		}
		return undefined;
	}

	if (value && typeof value === "object") {
		// ImageObject: the URL lives under `url`, occasionally `contentUrl`.
		const obj = value as { url?: unknown; contentUrl?: unknown };
		return normalizeSchemaImage(obj.url ?? obj.contentUrl);
	}

	return undefined;
}
