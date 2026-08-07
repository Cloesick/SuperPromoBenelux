import { describe, expect, it } from "vitest";
import {
	clusterWords,
	areAdjacent,
	findPricesInText,
	findPricesInWords,
	extractProductName,
	clusterToDeal,
	cleanProductName,
	dealsFromWords,
	horizontalOverlap,
	verticalOverlap,
	mergeBoxes,
	type OcrWord,
} from "./ocrLayout";

// ---------------------------------------------------------------------------
// Layout builders
//
// Words are placed on a synthetic 20px-tall grid so the clustering thresholds
// (multiples of median word height) are predictable.
// ---------------------------------------------------------------------------

const H = 20;

function word(text: string, x: number, y: number, width = text.length * 10): OcrWord {
	return {
		text,
		bbox: { x0: x, y0: y, x1: x + width, y1: y + H },
		confidence: 90,
	};
}

/** A card: lines stacked at x, each 5px apart vertically. */
function card(x: number, y: number, lines: string[]): OcrWord[] {
	return lines.flatMap((line, i) =>
		line.split(" ").reduce<OcrWord[]>((acc, token) => {
			const prev = acc[acc.length - 1];
			const nextX = prev ? prev.bbox.x1 + 8 : x;
			acc.push(word(token, nextX, y + i * (H + 5)));
			return acc;
		}, []),
	);
}

// ---------------------------------------------------------------------------
// Geometry primitives
// ---------------------------------------------------------------------------

describe("geometry helpers", () => {
	it("reports positive overlap and negative gaps", () => {
		expect(horizontalOverlap({ x0: 0, y0: 0, x1: 100, y1: 20 }, { x0: 50, y0: 0, x1: 150, y1: 20 })).toBe(50);
		expect(horizontalOverlap({ x0: 0, y0: 0, x1: 100, y1: 20 }, { x0: 130, y0: 0, x1: 200, y1: 20 })).toBe(-30);
		expect(verticalOverlap({ x0: 0, y0: 0, x1: 10, y1: 20 }, { x0: 0, y0: 40, x1: 10, y1: 60 })).toBe(-20);
	});

	it("merges boxes to their union", () => {
		expect(mergeBoxes({ x0: 10, y0: 10, x1: 20, y1: 20 }, { x0: 5, y0: 15, x1: 30, y1: 25 })).toEqual({
			x0: 5,
			y0: 10,
			x1: 30,
			y1: 25,
		});
	});
});

describe("areAdjacent", () => {
	const opts = {
		minWordConfidence: 60,
		xGapFactor: 1.6,
		yGapFactor: 1.1,
		minWordsPerCluster: 2,
	};

	it("joins words sitting side by side on a line", () => {
		expect(areAdjacent(word("Coca", 0, 0), word("Cola", 50, 0), H, opts)).toBe(true);
	});

	it("separates words in different columns on the same row", () => {
		expect(areAdjacent(word("Coca", 0, 0), word("Stella", 600, 0), H, opts)).toBe(false);
	});

	it("joins stacked lines of one card", () => {
		expect(areAdjacent(word("Coca-Cola", 0, 0), word("6x1,5L", 0, 25), H, opts)).toBe(true);
	});

	it("separates cards stacked far apart vertically", () => {
		expect(areAdjacent(word("Coca-Cola", 0, 0), word("Stella", 0, 300), H, opts)).toBe(false);
	});
});

// ---------------------------------------------------------------------------
// Clustering — the behaviour flat reading order gets wrong
// ---------------------------------------------------------------------------

describe("clusterWords", () => {
	it("keeps two side-by-side promos apart", () => {
		// This is the exact failure of flat OCR: reading order emits
		// "Coca-Cola Stella Artois 5,99 12,49" and pairs the wrong price.
		const words = [
			...card(0, 0, ["Coca-Cola", "6x1,5L", "5,99"]),
			...card(700, 0, ["Stella Artois", "24x33cl", "12,49"]),
		];

		const clusters = clusterWords(words);
		expect(clusters).toHaveLength(2);
		expect(clusters[0].text).toContain("Coca-Cola");
		expect(clusters[0].text).toContain("5,99");
		expect(clusters[0].text).not.toContain("Stella");
		expect(clusters[1].text).toContain("Stella");
		expect(clusters[1].text).not.toContain("Coca-Cola");
	});

	it("keeps vertically separated promos apart", () => {
		const clusters = clusterWords([
			...card(0, 0, ["Coca-Cola", "5,99"]),
			...card(0, 400, ["Stella Artois", "12,49"]),
		]);
		expect(clusters).toHaveLength(2);
	});

	it("groups a 2x2 grid of promos into four clusters", () => {
		const clusters = clusterWords([
			...card(0, 0, ["Melk", "1,09"]),
			...card(700, 0, ["Kaas", "3,49"]),
			...card(0, 400, ["Brood", "2,19"]),
			...card(700, 400, ["Boter", "2,99"]),
		]);
		expect(clusters).toHaveLength(4);
		expect(clusters.map((c) => c.text.split(" ")[0])).toEqual(["Melk", "Kaas", "Brood", "Boter"]);
	});

	it("drops low-confidence words before clustering", () => {
		const words: OcrWord[] = [
			{ ...word("Coca-Cola", 0, 0), confidence: 95 },
			{ ...word("5,99", 0, 25), confidence: 95 },
			{ ...word("§§~", 0, 50), confidence: 12 },
		];
		const clusters = clusterWords(words);
		expect(clusters).toHaveLength(1);
		expect(clusters[0].text).not.toContain("§§~");
	});

	it("discards isolated stray marks", () => {
		const clusters = clusterWords([...card(0, 0, ["Coca-Cola", "5,99"]), word("x", 2000, 2000)]);
		expect(clusters).toHaveLength(1);
	});

	it("returns nothing for empty input", () => {
		expect(clusterWords([])).toEqual([]);
	});

	it("orders clusters top-to-bottom then left-to-right", () => {
		const clusters = clusterWords([
			...card(700, 400, ["Boter", "2,99"]),
			...card(0, 0, ["Melk", "1,09"]),
			...card(700, 0, ["Kaas", "3,49"]),
		]);
		expect(clusters.map((c) => c.text.split(" ")[0])).toEqual(["Melk", "Kaas", "Boter"]);
	});
});

// ---------------------------------------------------------------------------
// Price and name recovery
// ---------------------------------------------------------------------------

describe("findPricesInText", () => {
	it("finds comma and dot decimal prices", () => {
		expect(findPricesInText("Coca-Cola 5,99 was 8.99")).toEqual([5.99, 8.99]);
	});

	it("finds euro-prefixed prices", () => {
		expect(findPricesInText("nu € 12,49")).toEqual([12.49]);
	});

	it("ignores superscript-cent forms rather than guessing the decimal point", () => {
		// "549" on a leaflet means EUR 5.49, but inferring that would invent data.
		expect(findPricesInText("Stella 549 vanaf 6 blikken")).toEqual([]);
	});

	it("does not slice a price out of a longer number", () => {
		// Without a left boundary this matched "8509,24" inside the article number.
		expect(findPricesInText("artikelnummer 678509,24")).toEqual([]);
		expect(findPricesInText("EAN 5410228123456")).toEqual([]);
	});

	it("does not read an IP address as a price", () => {
		// A Boots anti-bot block page was OCR'd and stored as a EUR 45.60 deal
		// reduced from EUR 193.74 — both numbers sliced out of IP addresses, and
		// the only data that retailer had.
		expect(findPricesInText("Your IP: 193.74.248.194")).toEqual([]);
		expect(findPricesInText("Proxy IP: 45.60.13.206 (ID 10567-100)")).toEqual([]);
	});

	it("does not read a thousands separator as a price", () => {
		// "1.499,00" matched as "499,00", which is where krefel's EUR 1.49
		// against EUR 799 rows came from.
		expect(findPricesInText("Krefel 1.499,00")).toEqual([]);
		expect(findPricesInText("Versie 1.2.3 kost 9,95")).toEqual([9.95]);
	});

	it("still reads ordinary leaflet prices", () => {
		expect(findPricesInText("Hamburgers 4 stuks 5,49")).toEqual([5.49]);
		expect(findPricesInText("Corona 6 x 33 cl € 5,99 1,33")).toEqual([5.99, 1.33]);
		expect(findPricesInText("nu 12,50 i.p.v. 24,99")).toEqual([12.5, 24.99]);
	});

	it("still matches a price at the start of a token", () => {
		expect(findPricesInText("5,99 per stuk")).toEqual([5.99]);
	});
});

describe("extractProductName", () => {
	it("takes the longest run of word-like tokens", () => {
		const cluster = clusterWords(card(0, 0, ["Douwe Egberts koffie", "500 gram", "5,99"]))[0];
		expect(extractProductName(cluster)).toBe("Douwe Egberts koffie");
	});

	it("stops the run at prices and unit markers", () => {
		const cluster = clusterWords(card(0, 0, ["Melk", "1,09", "per liter"]))[0];
		expect(extractProductName(cluster)).not.toContain("1,09");
	});
});

// ---------------------------------------------------------------------------
// Cluster -> Deal
// ---------------------------------------------------------------------------

describe("cleanProductName", () => {
	it("keeps the example product that follows a vb.: marker", () => {
		expect(cleanProductName("ml vb.: Mosterd op grootmoeders wijze")).toBe(
			"Mosterd op grootmoeders wijze",
		);
		expect(cleanProductName("g vb.: Mascarpone Pomodoro")).toBe("Mascarpone Pomodoro");
	});

	it("strips orphan unit tokens leaked from the line above", () => {
		expect(cleanProductName("cl Juicy Crime")).toBe("Juicy Crime");
		expect(cleanProductName("je winkel Cuvee des Trolls")).toBe("winkel Cuvee des Trolls");
	});

	it("drops a truncated opening bracket", () => {
		expect(cleanProductName("alle koude sauzen (uitgezonderd Ketchup")).toBe("alle koude sauzen");
	});

	it("leaves a clean name untouched", () => {
		expect(cleanProductName("Noilly Prat vermout Original Dry")).toBe(
			"Noilly Prat vermout Original Dry",
		);
	});
});

describe("findPricesInWords", () => {
	it("drops a price that a following unit marker identifies as per-unit", () => {
		// Real Colruyt layout: pack price followed by its per-litre equivalent.
		const words = [word("5,99", 0, 0), word("(/L)", 60, 0), word("1,33", 120, 0)];
		expect(findPricesInWords(words)).toEqual([1.33]);
	});

	it("drops a per-unit price written as a single token", () => {
		expect(findPricesInWords([word("2,49", 0, 0), word("1,33/L", 60, 0)])).toEqual([2.49]);
	});

	it("keeps ordinary price pairs", () => {
		expect(findPricesInWords([word("8,99", 0, 0), word("5,99", 60, 0)])).toEqual([8.99, 5.99]);
	});
});

describe("clusterToDeal", () => {
	it("rejects an implausible discount ratio as a mispaired price", () => {
		// Observed: Corona Extra at EUR 2.80 shown against a EUR 21.98 unit price.
		const cluster = clusterWords(card(0, 0, ["Corona Extra", "2,80 21,98"]))[0];
		const deal = clusterToDeal(cluster, "colruyt", "2026-08-03", "2026-08-09", 0);
		expect(deal?.promoPrice).toBe(2.8);
		expect(deal?.originalPrice).toBeUndefined();
	});

	it("keeps a credible discount pair", () => {
		const cluster = clusterWords(card(0, 0, ["Leffe blond", "8,99 5,99"]))[0];
		const deal = clusterToDeal(cluster, "colruyt", "2026-08-03", "2026-08-09", 0);
		expect(deal?.promoPrice).toBe(5.99);
		expect(deal?.originalPrice).toBe(8.99);
	});

	it("pairs a name with the price physically beside it", () => {
		const cluster = clusterWords(card(0, 0, ["Coca-Cola zero", "6x1,5L", "5,99"]))[0];
		const deal = clusterToDeal(cluster, "colruyt", "2026-08-03", "2026-08-09", 0);
		// Pack size is kept: EUR 5.99 is only comparable across retailers once
		// the quantity it buys is known.
		expect(deal?.product).toBe("Coca-Cola zero 6x1,5L");
		expect(deal?.promoPrice).toBe(5.99);
	});

	it("reads a strikethrough pair as promo and original", () => {
		const cluster = clusterWords(card(0, 0, ["Stella Artois", "8,99 5,99"]))[0];
		const deal = clusterToDeal(cluster, "colruyt", "2026-08-03", "2026-08-09", 0);
		expect(deal?.promoPrice).toBe(5.99);
		expect(deal?.originalPrice).toBe(8.99);
	});

	it("returns null when the card has no price", () => {
		const cluster = clusterWords(card(0, 0, ["Combineer naar keuze", "vanaf 4 blikken"]))[0];
		expect(clusterToDeal(cluster, "colruyt", "2026-08-03", "2026-08-09", 0)).toBeNull();
	});

	it("returns null when the card has no name", () => {
		const cluster = clusterWords(card(0, 0, ["5,99 8,99"]))[0];
		expect(clusterToDeal(cluster, "colruyt", "2026-08-03", "2026-08-09", 0)).toBeNull();
	});
});

describe("dealsFromWords", () => {
	it("produces one correctly paired deal per card", () => {
		const deals = dealsFromWords(
			[
				...card(0, 0, ["Coca-Cola", "5,99"]),
				...card(700, 0, ["Stella Artois", "12,49"]),
				...card(0, 400, ["Combineer naar keuze"]),
			],
			"colruyt",
			"2026-08-03",
			"2026-08-09",
		);

		expect(deals).toHaveLength(2);
		expect(deals.map((d) => [d.product, d.promoPrice])).toEqual([
			["Coca-Cola", 5.99],
			["Stella Artois", 12.49],
		]);
	});
});
