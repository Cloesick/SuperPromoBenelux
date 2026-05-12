import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf.mjs";
import { Deal } from "../lib/types";

// ---------------------------------------------------------------------------
// Text-based deal extraction from PDFs
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// 1. PDF text extraction
// ---------------------------------------------------------------------------

export async function extractDealsFromPdf(
	pdfUrl: string,
	retailerSlug: string,
	validFrom: string,
	validUntil: string,
): Promise<Deal[]> {
	try {
		const response = await fetch(pdfUrl, {
			headers: {
				"User-Agent":
					"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
			},
		});
		if (!response.ok) return [];

		const buffer = new Uint8Array(await response.arrayBuffer());
		const doc = await pdfjsLib.getDocument({ data: buffer }).promise;
		const pages: string[] = [];

		for (let i = 1; i <= Math.min(doc.numPages, 12); i++) {
			const page = await doc.getPage(i);
			const content = await page.getTextContent();
			const pageText = content.items
				.map((item) => ("str" in item ? (item.str ?? "") : ""))
				.join(" ");
			pages.push(pageText);
		}

		const text = pages.join("\n");
		doc.destroy();

		// Sanity check: PDF should contain at least a few euro price patterns
		// to be a product catalog (not a certificate, terms doc, etc.)
		const priceCount = (text.match(/€\s*\d+[.,]\d{2}/g) || []).length;
		if (priceCount < 2) return [];

		return parseTextToDeals(text, retailerSlug, validFrom, validUntil, "pdf");
	} catch (err) {
		console.error(`[extractDealsFromPdf] Error for ${retailerSlug}:`, err);
		return [];
	}
}

// ---------------------------------------------------------------------------
// 3. Text parsing: extract product names, prices, discounts from raw text
// ---------------------------------------------------------------------------

interface TextBlock {
	product: string;
	originalPrice?: number;
	promoPrice?: number;
	discount?: string;
}

function parseTextToDeals(
	rawText: string,
	retailerSlug: string,
	validFrom: string,
	validUntil: string,
	source: "pdf",
): Deal[] {
	const lines = rawText
		.split(/\n/)
		.map((l) => l.trim())
		.filter((l) => l.length > 2);

	const blocks = extractProductBlocks(lines);
	const deals: Deal[] = [];

	for (const block of blocks) {
		if (!block.product || block.product.length < 3) continue;
		// Must have at least a price or discount to be useful
		if (!block.promoPrice && !block.originalPrice && !block.discount) continue;

		const id = `${retailerSlug}-${source}-${deals.length}-${Date.now()}`;

		deals.push({
			id,
			product: block.product,
			originalPrice: block.originalPrice,
			promoPrice: block.promoPrice,
			discount: block.discount,
			validFrom,
			validUntil,
			retailerSlug,
		});
	}

	return deals;
}

function extractProductBlocks(lines: string[]): TextBlock[] {
	const blocks: TextBlock[] = [];

	// Strategy: scan for price patterns and work backward/forward to find product names
	for (let i = 0; i < lines.length; i++) {
		const line = lines[i];

		// --- Pattern 1: Line contains a euro price ---
		const priceMatch = line.match(/€\s*(\d+[.,]\d{2})\s*/g);
		if (priceMatch && priceMatch.length > 0) {
			const prices = priceMatch.map((p) =>
				parseFloat(p.replace("€", "").replace(",", ".").trim()),
			);

			// Find product name: look at current line (before price) or previous line
			let productName = line
				.replace(/€\s*\d+[.,]\d{2}/g, "")
				.replace(/\d+[.,]\d{2}/g, "")
				.trim();

			if (productName.length < 3 && i > 0) {
				productName = lines[i - 1];
			}

			// Clean up product name
			productName = cleanProductName(productName);

			if (productName.length >= 3) {
				const block: TextBlock = { product: productName };

				if (prices.length >= 2) {
					// Two prices: likely original + promo
					block.originalPrice = Math.max(...prices);
					block.promoPrice = Math.min(...prices);
				} else if (prices.length === 1) {
					block.promoPrice = prices[0];
				}

				// Check for discount text nearby
				const discountMatch = line.match(
					/(-?\d+\s*%|[123]\s*\+\s*[123]|gratis|korting|réduction)/i,
				);
				if (discountMatch) {
					block.discount = discountMatch[0].trim();
				} else if (i + 1 < lines.length) {
					const nextDiscount = lines[i + 1].match(
						/(-?\d+\s*%|[123]\s*\+\s*[123]|gratis|korting|réduction)/i,
					);
					if (nextDiscount) block.discount = nextDiscount[0].trim();
				}

				blocks.push(block);
			}
			continue;
		}

		// --- Pattern 2: Line contains discount pattern without euro price ---
		const discountOnly = line.match(
			/(-\d+\s*%|\d+\s*\+\s*\d+\s*gratis|[234]e?\s*(halve\s*prijs|gratis)|koop\s*\d+\s*betaal)/i,
		);
		if (discountOnly) {
			// Look for product name on previous line
			let productName = i > 0 ? lines[i - 1] : "";
			productName = cleanProductName(productName);

			if (productName.length >= 3) {
				blocks.push({
					product: productName,
					discount: discountOnly[0].trim(),
				});
			}
			continue;
		}

		// --- Pattern 3: Price without euro sign (e.g. "2.99" or "2,99") ---
		const nakedPrice = line.match(/\b(\d{1,3}[.,]\d{2})\b/g);
		if (nakedPrice && nakedPrice.length >= 2) {
			// Multiple prices on one line — likely a product card
			const prices = nakedPrice.map((p) => parseFloat(p.replace(",", ".")));

			let productName = line.replace(/\b\d{1,3}[.,]\d{2}\b/g, "").trim();

			if (productName.length < 3 && i > 0) {
				productName = lines[i - 1];
			}

			productName = cleanProductName(productName);

			if (productName.length >= 3 && prices.length >= 2) {
				blocks.push({
					product: productName,
					originalPrice: Math.max(...prices),
					promoPrice: Math.min(...prices),
				});
			}
		}
	}

	return blocks;
}

function cleanProductName(name: string): string {
	return (
		name
			// Remove prices and special chars
			.replace(/€\s*\d+[.,]\d{2}/g, "")
			.replace(/\b\d{1,3}[.,]\d{2}\b/g, "")
			// Remove common noise words from OCR
			.replace(
				/^(per\s*(stuk|kg|liter|l)|vanaf|nu|nieuw|actie|promo|van)\s*/i,
				"",
			)
			// Remove leading/trailing special chars
			.replace(/^[^a-zA-Z0-9À-ÿ]+/, "")
			.replace(/[^a-zA-Z0-9À-ÿ]+$/, "")
			.trim()
	);
}
