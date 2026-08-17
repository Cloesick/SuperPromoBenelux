import { describe, expect, it } from "vitest";
import sitemap from "./sitemap";
import { categories } from "@/lib/catalog";
import { getSiteBaseUrl } from "@/lib/site";

const baseUrl = getSiteBaseUrl();
const urls = sitemap().map((entry) => entry.url);

describe("sitemap", () => {
	// next.config.ts sets `trailingSlash: true`, so /folders 308-redirects to
	// /folders/ and the canonical tag points at the slashed form. Emitting the
	// unslashed URL made every entry a redirect, which Google reports as
	// "Page with redirect" and indexes nothing from.
	it("emits only trailing-slash URLs", () => {
		expect(urls.filter((url) => !url.endsWith("/"))).toEqual([]);
	});

	// /nl-grensstreek renders `robots: noindex, nofollow`. Submitting it was a
	// self-contradiction — Search Console flags it as "Submitted URL marked
	// 'noindex'" — so the sitemap must not list it.
	it("omits the noindex nl-grensstreek hub", () => {
		expect(urls.some((url) => url.includes("/nl-grensstreek"))).toBe(false);
	});

	// The shop-category pages are indexable and carry the commercial-intent
	// queries ("supermarkt folder", "discounter folder"), but were never listed.
	it("includes the shop hub and every category page", () => {
		expect(urls).toContain(`${baseUrl}/winkels/`);
		for (const category of categories) {
			expect(urls).toContain(`${baseUrl}/winkels/${category.key}/`);
		}
	});

	it("lists every URL exactly once", () => {
		expect(urls.length).toBe(new Set(urls).size);
	});
});
