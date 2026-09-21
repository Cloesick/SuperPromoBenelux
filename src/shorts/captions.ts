// ---------------------------------------------------------------------------
// Per-platform post copy for a short, with a tracked link back to the folder.
//
// Every link carries UTM tags, so GA4 (and the social pixels) can attribute a
// visit to the platform, week and retailer that brought it:
//   utm_source=<platform>&utm_medium=social&utm_campaign=folder-2026-w39
//   &utm_content=<retailer>-short
// ---------------------------------------------------------------------------

import type { Brief } from "./brief";

export type Platform = "youtube" | "tiktok" | "instagram" | "facebook" | "reddit";
export const PLATFORMS: Platform[] = ["youtube", "tiktok", "instagram", "facebook", "reddit"];

export interface PostCopy {
	platform: Platform;
	/** YouTube and Reddit need a title; the rest use caption only. */
	title: string | null;
	caption: string;
	link: string;
}

const SITE = "https://superpromobelgie.com";

export function isoWeekTag(d: Date): string {
	const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
	t.setUTCDate(t.getUTCDate() + 4 - (t.getUTCDay() || 7));
	const yearStart = Date.UTC(t.getUTCFullYear(), 0, 1);
	const week = Math.ceil(((t.getTime() - yearStart) / 86_400_000 + 1) / 7);
	return `${t.getUTCFullYear()}-w${String(week).padStart(2, "0")}`;
}

export function trackedLink(brief: Brief, platform: Platform): string {
	const q = new URLSearchParams({
		utm_source: platform,
		utm_medium: "social",
		utm_campaign: `folder-${isoWeekTag(new Date(`${brief.validFrom}T12:00:00Z`))}`,
		utm_content: `${brief.retailerSlug}-short`,
	});
	return `${SITE}/folders/${brief.retailerSlug}/?${q}`;
}

/** "21/09" from "2026-09-21". */
const dm = (isoDate: string) => `${isoDate.slice(8, 10)}/${isoDate.slice(5, 7)}`;

/** "Gehakt XXL 800 g: €4,29 (was €8,62, -50%)" */
export function offerLine(o: Brief["offers"][number]): string {
	const name = [o.product, o.detail].filter(Boolean).join(" ");
	const parts: string[] = [];
	if (o.priceNow) parts.push(`€${o.priceNow}`);
	const extra = [o.priceWas ? `was €${o.priceWas}` : null, o.mechanic].filter(Boolean).join(", ");
	return `${name}: ${parts.join(" ")}${extra ? `${parts.length ? " " : ""}(${extra})` : ""}`.replace(": (", ": ");
}

function hashtags(brief: Brief, max: number): string {
	const retailer = brief.retailerName.toLowerCase().replace(/[^a-z0-9]/g, "");
	const tags = [retailer, `${retailer}folder`, "folder", "promo", "belgie", "besparen", "aanbiedingen"];
	return tags.slice(0, max).map((t) => `#${t}`).join(" ");
}

export function postCopy(brief: Brief, platform: Platform): PostCopy {
	const link = trackedLink(brief, platform);
	const when = `geldig ${dm(brief.validFrom)} t.e.m. ${dm(brief.validUntil)}`;
	const lines = brief.offers.slice(0, 2).map((o) => `• ${offerLine(o)}`);
	const source = `Prijzen uit de ${brief.retailerName}-folder, ${when}. Niet gesponsord.`;
	const hero = brief.offers[0];
	const heroPrice = hero.priceNow ? ` €${hero.priceNow}` : hero.mechanic ? ` ${hero.mechanic}` : "";
	const shortTitle = `${brief.retailerName} folder: ${hero.product}${heroPrice}`;

	switch (platform) {
		case "youtube":
			return {
				platform,
				title: `${shortTitle} #shorts`.slice(0, 100),
				caption: [brief.hook, "", ...lines, "", `Hele folder: ${link}`, "", source, "", hashtags(brief, 5)].join("\n"),
				link,
			};
		case "tiktok":
		case "instagram":
			return {
				platform,
				title: null,
				caption: [
					`${brief.hook} 🛒`,
					...lines,
					platform === "instagram" ? "Hele folder: link in bio" : `Hele folder op superpromobelgie.com`,
					source,
					hashtags(brief, 7),
				].join("\n"),
				link,
			};
		case "facebook":
			return {
				platform,
				title: null,
				caption: [brief.hook, ...lines, `Bekijk de hele folder: ${link}`, source].join("\n"),
				link,
			};
		case "reddit":
			// No hashtags or emoji: they read as spam there.
			return {
				platform,
				title: `${brief.retailerName} folder ${when}: ${hero.product}${heroPrice}`.slice(0, 300),
				caption: [...lines, "", `Volledige folder: ${link}`, "", source].join("\n"),
				link,
			};
	}
}
