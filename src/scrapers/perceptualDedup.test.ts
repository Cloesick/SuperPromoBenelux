import { describe, expect, it } from "vitest";
import sharp from "sharp";
import { BaseScraper, type ScrapeContext } from "./base";

// ---------------------------------------------------------------------------
// Duplicate detection used to compare captures byte-for-byte, which almost
// never matched: viewers re-render the same spread with sub-pixel differences,
// so IKEA recorded 60 "pages" that held 3 distinct images and Colruyt captured
// every Issuu spread twice. These tests pin the two properties that matter —
// noisy re-renders of one page collapse, genuinely different pages do not.
// ---------------------------------------------------------------------------

class TestScraper extends BaseScraper {
	config = { slug: "test", name: "Test", folderUrls: ["https://example.com"] };

	async hash(bytes: Buffer) {
		return this.perceptualHash(bytes);
	}

	static distance(a: string, b: string) {
		return BaseScraper.hammingDistance(a, b);
	}

	static get threshold() {
		return BaseScraper.DUPLICATE_HAMMING_THRESHOLD;
	}
}

/** A deterministic image: coloured blocks laid out on a grid. */
async function blocks(seed: number, noise = 0): Promise<Buffer> {
	const size = 240;
	const cell = size / 6;
	const px = Buffer.alloc(size * size * 3);
	for (let y = 0; y < size; y++) {
		for (let x = 0; x < size; x++) {
			const gx = Math.floor(x / cell);
			const gy = Math.floor(y / cell);
			// Bit pattern from the seed decides whether each cell is dark or light.
			const on = (seed >> ((gy * 6 + gx) % 31)) & 1;
			const base = on ? 220 : 35;
			const i = (y * size + x) * 3;
			// Noise perturbs pixels without changing the block layout, which is what
			// a viewer re-render looks like.
			const v = Math.max(0, Math.min(255, base + (noise ? ((x * 7 + y * 13) % noise) - noise / 2 : 0)));
			px[i] = px[i + 1] = px[i + 2] = v;
		}
	}
	return sharp(px, { raw: { width: size, height: size, channels: 3 } })
		.webp()
		.toBuffer();
}

describe("BaseScraper perceptual duplicate detection", () => {
	it("treats a noisy re-render of the same page as a duplicate", async () => {
		const scraper = new TestScraper();
		const clean = await scraper.hash(await blocks(0b1010110011, 0));
		const noisy = await scraper.hash(await blocks(0b1010110011, 40));

		expect(clean).not.toBeNull();
		expect(noisy).not.toBeNull();
		// Byte-identical comparison would miss this: the encoded images differ.
		expect(TestScraper.distance(clean!, noisy!)).toBeLessThanOrEqual(
			TestScraper.threshold,
		);
	});

	it("keeps genuinely different pages distinct", async () => {
		const scraper = new TestScraper();
		const a = await scraper.hash(await blocks(0b1010110011));
		const b = await scraper.hash(await blocks(0b0101001100));

		expect(TestScraper.distance(a!, b!)).toBeGreaterThan(TestScraper.threshold);
	});

	it("produces a 16-character hex fingerprint", async () => {
		const scraper = new TestScraper();
		const h = await scraper.hash(await blocks(0b1101));
		expect(h).toMatch(/^[0-9a-f]{16}$/);
	});

	it("returns null rather than throwing on an unreadable capture", async () => {
		const scraper = new TestScraper();
		// A blank buffer must not be treated as a unique page.
		expect(await scraper.hash(Buffer.from("not an image"))).toBeNull();
	});

	it("reports incomparable fingerprints as maximally distant", () => {
		// The seen-set also holds SHA1 fallbacks; those must never read as a
		// near-match against a real fingerprint.
		expect(TestScraper.distance("abcd", "abcdef0123456789")).toBe(
			Number.MAX_SAFE_INTEGER,
		);
	});
});

// Keep the unused import meaningful for type-checking the class shape.
export type { ScrapeContext };
