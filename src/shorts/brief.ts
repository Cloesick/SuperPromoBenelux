// ---------------------------------------------------------------------------
// A short's brief: what the front page of this week's folder says.
//
// Produced by scripts/shorts/analyze.mts, which asks Claude to read the cover,
// and consumed by the renderer and the captions. Everything a video says about
// a price comes from here, and everything here comes from the folder, so the
// schema keeps prices as the exact strings the folder prints ("4,29", "1+1
// gratis") and boxes as fractions of the cover, so the renderer can crop the
// real leaflet rather than recreate it.
// ---------------------------------------------------------------------------

import { z } from "zod";

/** A region of the cover, as fractions 0..1 of its width and height. */
export const Box = z.object({
	x: z.number().min(0).max(1),
	y: z.number().min(0).max(1),
	w: z.number().min(0).max(1),
	h: z.number().min(0).max(1),
});
export type Box = z.infer<typeof Box>;

export const Category = z.enum([
	"food",
	"drinks",
	"household",
	"drugstore",
	"diy",
	"garden",
	"pets",
	"fashion",
	"electronics",
	"toys",
	"other",
]);
export type Category = z.infer<typeof Category>;

export const Offer = z.object({
	/** Product as printed, in Dutch: "Rund- en varkensgehakt XXL". */
	product: z.string().min(1),
	/** Pack size or variant as printed: "800 g". */
	detail: z.string().nullable(),
	/** Promo price as printed, euro sign omitted: "4,29". Null for pure mechanics. */
	priceNow: z.string().nullable(),
	/** Struck-through regular price as printed: "8,62". */
	priceWas: z.string().nullable(),
	/** Mechanic as printed: "-50%", "1+1 gratis", "1+2 gratis". */
	mechanic: z.string().nullable(),
	category: Category,
	/** Where the offer sits on the cover: product photo plus its price tag. */
	box: Box,
});
export type Offer = z.infer<typeof Offer>;

export const Brief = z.object({
	retailerSlug: z.string(),
	retailerName: z.string(),
	/** The folder this brief was made from, to refuse a stale brief. */
	folderId: z.string(),
	validFrom: z.string(),
	validUntil: z.string(),
	coverUrl: z.string(),
	/** The retailer's logo on the cover, cropped for intro and outro. */
	logoBox: Box.nullable(),
	/** Hero first; at most three, the renderer uses two. */
	offers: z.array(Offer).min(1).max(3),
	/** Opening line in Dutch, max ~40 characters: "Gehakt aan halve prijs". */
	hook: z.string().min(1).max(60),
	/**
	 * The premium reel's genre, chosen from the hero's category: food is a
	 * cooking scene, pet food happy pets, perfume a compliment scene. Used for
	 * the ChatCut Ghibli reel, not by the template.
	 */
	genre: z.string(),
	/** "claude" when analyze.mts produced it, "manual" when a person did. */
	source: z.enum(["claude", "manual"]),
});
export type Brief = z.infer<typeof Brief>;

/**
 * Why a brief must not be published, or null when it may be.
 *
 * Auto-publish runs unattended, so this is the whole safety margin: a wrong
 * price or an expired folder going out under the site's name is worse than
 * posting nothing. Checked against the folder file the site itself serves.
 */
export function publishBlocker(
	brief: Brief,
	folder: { id: string; validFrom: string; validUntil: string } | null,
	today: Date = new Date(),
): string | null {
	if (!folder) return "retailer has no folder on the site";
	if (folder.id !== brief.folderId) return `brief is for ${brief.folderId}, site shows ${folder.id}`;
	const day = today.toISOString().slice(0, 10);
	if (folder.validUntil < day) return `folder ended ${folder.validUntil}`;
	// A short posted with two days left sells a promo people can barely use.
	const daysLeft = (Date.parse(folder.validUntil) - Date.parse(day)) / 86_400_000;
	if (daysLeft < 2) return `folder ends ${folder.validUntil}, too close to post`;
	const hero = brief.offers[0];
	if (!hero.priceNow && !hero.mechanic) return "hero offer has neither a price nor a mechanic";
	if (hero.priceNow && !/^\d{1,4}([.,]\d{2})?$/.test(hero.priceNow.trim()))
		return `hero price "${hero.priceNow}" is not a price`;
	return null;
}
