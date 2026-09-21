#!/usr/bin/env tsx
// ---------------------------------------------------------------------------
// Read each retailer's current folder cover and write a brief for its short.
//
//   npx tsx scripts/shorts/analyze.mts [week] [slug ...]
//
// For every target retailer with a current folder on the site, sends page 1 to
// Claude and asks for the hero offers exactly as printed (product, pack size,
// price, struck price, mechanic), where each sits on the cover, the logo, a
// hook line and a genre for the premium reel. The answer is validated against
// the Brief schema; anything else is dropped, not guessed at.
//
// Skips a retailer whose brief for the same folder already exists, so running
// this three times a week only pays for folders that actually changed.
//
// Needs ANTHROPIC_API_KEY. Without it the step reports and exits 0: the rest of
// the pipeline renders whatever briefs exist.
// ---------------------------------------------------------------------------

import fs from "node:fs";
import path from "node:path";
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import { Box, Brief, Offer } from "../../src/shorts/brief";
import { isoWeekTag } from "../../src/shorts/captions";
import { getRetailerBySlug } from "../../src/lib/retailers";
import { isFolderExpired } from "../../src/lib/folderRenderability";

/** Supermarkets first: their covers are food, which the reels are built for. */
export const DEFAULT_TARGETS = ["lidl", "albert-heijn", "aldi", "colruyt", "delhaize", "jumbo", "carrefour", "action"];

const args = process.argv.slice(2);
const week = args[0] && /^\d{4}-w\d{2}$/.test(args[0]) ? args.shift()! : isoWeekTag(new Date());
const targets = args.length ? args : (process.env.SHORTS_RETAILERS?.split(/[\s,]+/).filter(Boolean) ?? DEFAULT_TARGETS);

// What Claude returns: the brief minus what we already know from the folder.
const Reading = z.object({
	offers: z.array(Offer).min(1).max(3),
	logoBox: Box.nullable(),
	hook: z.string(),
	genre: z.string(),
	validFromPrinted: z.string().nullable(),
	validUntilPrinted: z.string().nullable(),
});

const PROMPT = `This is page 1 of a Belgian retailer's weekly promotional folder.

Pick the offers a shopper would care most about: the hero (usually the biggest
product photo with a price) first, then at most two more. For each, copy the
text exactly as printed, in Dutch:
- product: the product name as printed
- detail: pack size or variant as printed, or null
- priceNow: the promo price digits as printed with a comma ("4,29"), no euro
  sign, or null if the offer is only a mechanic
- priceWas: the struck-through regular price, or null
- mechanic: "-50%", "1+1 gratis", "2de aan halve prijs" etc. as printed, or null
- category: one of food, drinks, household, drugstore, diy, garden, pets,
  fashion, electronics, toys, other
- box: the region holding the product photo AND its price tag, as fractions
  0..1 of the page width and height (x, y = top-left corner)

Also give:
- logoBox: the retailer's logo on this page as fractions, or null
- hook: a short Dutch opening line for a 15-second video, at most 40
  characters, true to the hero offer ("Gehakt aan halve prijs")
- genre: the premium video's scene for the hero, from its category: food a
  cooking scene naming the dish, pet food happy pets, perfume a compliment
  scene, and so on
- validFromPrinted / validUntilPrinted: the validity dates printed on the page
  as YYYY-MM-DD, or null

Never invent a price. If you cannot read one, use null.`;

interface SiteFolder {
	id: string;
	validFrom: string;
	validUntil: string;
	pages?: { imageUrl?: string }[];
}

function currentFolder(slug: string): SiteFolder | null {
	const file = path.join("data", "folders", `${slug}.json`);
	if (!fs.existsSync(file)) return null;
	const data = JSON.parse(fs.readFileSync(file, "utf-8"));
	return (data.folders ?? []).find((f: SiteFolder) => !isFolderExpired(f.validUntil) && f.pages?.[0]?.imageUrl) ?? null;
}

function existingBriefFor(folderId: string, slug: string): string | null {
	const root = path.join("data", "shorts");
	if (!fs.existsSync(root)) return null;
	for (const w of fs.readdirSync(root)) {
		const f = path.join(root, w, slug, "brief.json");
		if (fs.existsSync(f) && JSON.parse(fs.readFileSync(f, "utf-8")).folderId === folderId) return f;
	}
	return null;
}

async function main() {
	if (!process.env.ANTHROPIC_API_KEY && !process.env.ANTHROPIC_AUTH_TOKEN) {
		console.log("No ANTHROPIC_API_KEY: skipping cover analysis; existing briefs will still render.");
		return;
	}
	const client = new Anthropic();
	let failed = 0;

	for (const slug of targets) {
		const folder = currentFolder(slug);
		const retailer = getRetailerBySlug(slug);
		if (!folder || !retailer) {
			console.log(`- ${slug.padEnd(14)} no current folder with a cover`);
			continue;
		}
		const done = existingBriefFor(folder.id, slug);
		if (done) {
			console.log(`= ${slug.padEnd(14)} already briefed (${done})`);
			continue;
		}

		try {
			const response = await client.messages.parse({
				model: "claude-opus-5",
				max_tokens: 16000,
				output_config: { effort: "medium", format: zodOutputFormat(Reading) },
				messages: [
					{
						role: "user",
						content: [
							{ type: "image", source: { type: "url", url: folder.pages![0].imageUrl! } },
							{ type: "text", text: PROMPT },
						],
					},
				],
			});
			if (response.stop_reason === "refusal" || !response.parsed_output) {
				throw new Error(`no usable reading (stop_reason ${response.stop_reason})`);
			}
			const r = response.parsed_output;
			const brief = Brief.parse({
				retailerSlug: slug,
				retailerName: retailer.name,
				folderId: folder.id,
				// The dates the folder prints win over the site's estimate.
				validFrom: r.validFromPrinted ?? folder.validFrom,
				validUntil: r.validUntilPrinted ?? folder.validUntil,
				coverUrl: folder.pages![0].imageUrl!,
				logoBox: r.logoBox,
				offers: r.offers,
				hook: r.hook.slice(0, 60),
				genre: r.genre,
				source: "claude",
			});
			const dir = path.join("data", "shorts", week, slug);
			fs.mkdirSync(dir, { recursive: true });
			fs.writeFileSync(path.join(dir, "brief.json"), JSON.stringify(brief, null, 2) + "\n");
			const h = brief.offers[0];
			console.log(`✓ ${slug.padEnd(14)} ${h.product} ${h.priceNow ? "€" + h.priceNow : h.mechanic ?? ""}`);
		} catch (e) {
			failed++;
			if (e instanceof Anthropic.RateLimitError) console.error(`✗ ${slug}: rate limited`);
			else if (e instanceof Anthropic.APIError) console.error(`✗ ${slug}: API ${e.status} ${e.message}`);
			else console.error(`✗ ${slug}: ${(e as Error).message}`);
		}
	}
	if (failed) process.exitCode = 1;
}

await main();
