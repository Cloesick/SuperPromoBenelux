import { describe, expect, it } from "vitest";
import { normalizeSchemaImage } from "./schemaImage";

// ---------------------------------------------------------------------------
// Coolblue emitted `image` as an array of three URLs. Deal.imageUrl is typed
// `string`, but the value crosses a page.evaluate boundary as `any`, so nothing
// caught it until better-sqlite3 refused to bind an array — and because the
// insert is wrapped in a per-deal try/catch, all 22 rows vanished while the
// scrape reported success. These pin every shape schema.org allows.
// ---------------------------------------------------------------------------

describe("normalizeSchemaImage", () => {
	it("passes a plain URL through", () => {
		expect(normalizeSchemaImage("https://img.example.com/a.jpg")).toBe(
			"https://img.example.com/a.jpg",
		);
	});

	it("takes the first entry of an array", () => {
		// The exact shape Coolblue ships.
		expect(
			normalizeSchemaImage([
				"https://image.coolblue.be/500x500/products/1964308259",
				"https://image.coolblue.be/480x360/products/1964308259",
				"https://image.coolblue.be/512x288/products/1964308259",
			]),
		).toBe("https://image.coolblue.be/500x500/products/1964308259");
	});

	it("unwraps an ImageObject", () => {
		expect(normalizeSchemaImage({ url: "https://x.test/b.png" })).toBe(
			"https://x.test/b.png",
		);
		expect(normalizeSchemaImage({ contentUrl: "https://x.test/c.png" })).toBe(
			"https://x.test/c.png",
		);
	});

	it("handles an array of ImageObjects", () => {
		expect(
			normalizeSchemaImage([{ url: "https://x.test/d.png" }, "https://x.test/e.png"]),
		).toBe("https://x.test/d.png");
	});

	it("skips unusable leading entries", () => {
		expect(normalizeSchemaImage([null, "", "https://x.test/f.png"])).toBe(
			"https://x.test/f.png",
		);
	});

	it("returns undefined for anything unrecognised", () => {
		// Undefined costs nothing; a wrong image is rendered to visitors.
		expect(normalizeSchemaImage(undefined)).toBeUndefined();
		expect(normalizeSchemaImage(null)).toBeUndefined();
		expect(normalizeSchemaImage("")).toBeUndefined();
		expect(normalizeSchemaImage([])).toBeUndefined();
		expect(normalizeSchemaImage(42)).toBeUndefined();
		expect(normalizeSchemaImage({})).toBeUndefined();
	});

	it("always returns a bindable type", () => {
		// The actual contract that was violated: better-sqlite3 binds only
		// numbers, strings, bigints, buffers and null.
		for (const input of [
			"https://a.test/x.png",
			["https://a.test/x.png"],
			{ url: "https://a.test/x.png" },
			[{ contentUrl: "https://a.test/x.png" }],
			null,
			{},
		]) {
			const out = normalizeSchemaImage(input);
			expect(["string", "undefined"]).toContain(typeof out);
		}
	});
});
