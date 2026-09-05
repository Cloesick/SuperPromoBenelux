#!/usr/bin/env tsx
// ---------------------------------------------------------------------------
// Turn captured leaflet pages into comparable offers.
//
// Every piece of this path already existed and none of them were connected:
// `submitExtractionBatch`, `collectExtractionBatch`, `isPublishableProduct`,
// `resolveCanonical`, `insertCanonical` and `upsertOffer` had no callers, while
// `/prijzen/[product]` and `sitemap.ts` already read `getComparableProducts()`.
// The comparison feature therefore shipped a page backed by a table nothing
// ever wrote. This script is the producer side.
//
// It runs *after* the scraper rather than inside it. The extraction goes
// through the Batch API, which trades latency for half price and is explicitly
// not latency-sensitive — blocking a scrape run on it would hold a browser open
// for minutes to no benefit.
//
// Why it targets folders with no priced deals: Publitas serves leaflets as
// images with no text layer (verified — a viewer page reports zero text nodes),
// so for those retailers there is nothing for a parser to read and OCR recovers
// little. A vision model is the only path to a price, and these are exactly the
// folders where the cheaper paths already came back empty.
//
//   npx tsx scripts/extract-offers.mts --slug alvo      # one retailer
//   npx tsx scripts/extract-offers.mts --dry-run        # extract, don't write
//   npx tsx scripts/extract-offers.mts                  # every empty folder
// ---------------------------------------------------------------------------

import fs from "node:fs";
import path from "node:path";
import {
	submitExtractionBatch,
	isBatchReady,
	collectExtractionBatch,
	type PageRef,
} from "../src/scrapers/extractProductsFromImages";
import { isPublishableProduct } from "../src/lib/extractionGuard";
import { resolveCanonical } from "../src/lib/canonicalize";
import {
	findCanonicalByKey,
	insertCanonical,
	upsertOffer,
} from "../src/lib/catalogDb";

const DATA_DIR = path.join(process.cwd(), "data", "folders");

/* The batch usually ends in minutes, but the API's own ceiling is 24h. Polling
 * stops well short of that: a run that has not finished in half an hour is a
 * problem to look at, not to keep waiting on, and the batch id is printed so a
 * later run can collect it without re-paying for the pages. */
const POLL_INTERVAL_MS = 15_000;
const MAX_POLL_MS = 30 * 60_000;

const argv = process.argv.slice(2);
const dryRun = argv.includes("--dry-run");
const slugArg = argv.includes("--slug")
	? argv[argv.indexOf("--slug") + 1]
	: null;

interface FolderPage {
	pageNumber: number;
	imageUrl?: string;
}

function sleep(ms: number) {
	return new Promise((r) => setTimeout(r, ms));
}

/** Folders worth spending a model call on: leaflet pages, no prices yet. */
function selectFolders() {
	if (!fs.existsSync(DATA_DIR)) return [];
	const out: {
		slug: string;
		folderId: string;
		validFrom: string;
		validUntil: string;
		pages: FolderPage[];
	}[] = [];

	for (const file of fs.readdirSync(DATA_DIR).filter((f) => f.endsWith(".json"))) {
		const slug = file.replace(/\.json$/, "");
		if (slugArg && slug !== slugArg) continue;

		const data = JSON.parse(fs.readFileSync(path.join(DATA_DIR, file), "utf8"));
		const folder = data.folders?.[0];
		if (!folder) continue;

		const pages: FolderPage[] = (folder.pages ?? []).filter(
			(p: FolderPage) => typeof p.imageUrl === "string" && p.imageUrl,
		);
		if (pages.length === 0) continue;

		// A folder that already has prices is not what this is for. Re-reading it
		// would spend money to relearn what the text path already got right.
		const priced = (data.deals ?? []).filter(
			(d: { promoPrice?: number | null }) => d.promoPrice != null,
		).length;
		if (priced > 0 && !slugArg) continue;

		out.push({
			slug,
			folderId: folder.id ?? slug,
			validFrom: folder.validFrom ?? "",
			validUntil: folder.validUntil ?? "",
			pages,
		});
	}
	return out;
}

async function main() {
	if (!process.env.ANTHROPIC_API_KEY) {
		console.error(
			"ANTHROPIC_API_KEY is not set — extraction skipped.\n" +
				"Folders keep their existing text-parsed deals; nothing is overwritten.",
		);
		process.exit(0);
	}
	if (!dryRun && !process.env.POSTGRES_URL && !process.env.POSTGRES_PRISMA_URL) {
		console.error(
			"POSTGRES_URL is not set. Offers would be silently discarded by\n" +
				"catalogDb's getSql() guard, so this run would cost money and store\n" +
				"nothing. Set it, or pass --dry-run to inspect the extraction first.",
		);
		process.exit(1);
	}

	const folders = selectFolders();
	if (folders.length === 0) {
		console.log("No folders need extraction.");
		return;
	}

	const pageRefs: PageRef[] = [];
	const origin = new Map<string, { slug: string; folderId: string; page: number; validFrom: string; validUntil: string }>();

	for (const f of folders) {
		for (const p of f.pages) {
			const customId = `${f.folderId}:${p.pageNumber}`;
			pageRefs.push({ customId, imageUrl: p.imageUrl! });
			origin.set(customId, {
				slug: f.slug,
				folderId: f.folderId,
				page: p.pageNumber,
				validFrom: f.validFrom,
				validUntil: f.validUntil,
			});
		}
	}

	console.log(
		`Submitting ${pageRefs.length} page(s) from ${folders.length} folder(s): ` +
			folders.map((f) => `${f.slug}(${f.pages.length})`).join(", "),
	);

	const batchId = await submitExtractionBatch(pageRefs);
	if (!batchId) {
		console.error("Batch was not created — no client or no pages.");
		process.exit(1);
	}
	console.log(`Batch ${batchId} submitted. Polling...`);

	const deadline = Date.now() + MAX_POLL_MS;
	while (!(await isBatchReady(batchId))) {
		if (Date.now() > deadline) {
			console.error(
				`Batch ${batchId} still running after ${MAX_POLL_MS / 60_000} min.\n` +
					"It is not lost — collect it later with this id.",
			);
			process.exit(1);
		}
		await sleep(POLL_INTERVAL_MS);
	}

	const results = await collectExtractionBatch(batchId);
	console.log(`Collected ${results.size} page result(s).`);

	let extracted = 0;
	let published = 0;
	let stored = 0;

	for (const [customId, products] of results) {
		const src = origin.get(customId);
		if (!src) continue;

		for (const product of products) {
			extracted++;
			// Structured output guarantees the shape and nothing about the truth:
			// a hallucinated price is schema-valid, well-formed and wrong.
			if (!isPublishableProduct(product)) continue;
			published++;

			if (dryRun) {
				console.log(
					`  [${src.slug} p${src.page}] ${product.brand ?? ""} ${product.name} ` +
						`${(product.priceCents! / 100).toFixed(2)} EUR (conf ${product.confidence})`,
				);
				continue;
			}

			const { id } = await resolveCanonical(product, {
				find: findCanonicalByKey,
				insert: insertCanonical,
			});

			await upsertOffer({
				canonicalId: id,
				retailerSlug: src.slug,
				priceCents: product.priceCents!,
				originalPriceCents: product.originalPriceCents,
				promoType: null,
				promoLabel: product.promoLabel,
				validFrom: src.validFrom,
				validUntil: src.validUntil,
				folderId: src.folderId,
				sourcePage: src.page,
				confidence: product.confidence,
			});
			stored++;
		}
	}

	console.log(
		`\nextracted=${extracted} publishable=${published} ` +
			`${dryRun ? "(dry run, nothing written)" : `stored=${stored}`}`,
	);
	if (extracted > 0 && published === 0) {
		console.error(
			"Every product failed the plausibility guard. That is a prompt or " +
				"image-quality problem, not a storage one.",
		);
	}
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});
