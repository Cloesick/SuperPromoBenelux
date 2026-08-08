import { describe, expect, it } from "vitest";
import { looksLikeBotChallenge } from "./botChallenge";

// ---------------------------------------------------------------------------
// Boots' folder page 1 is an Imperva block page. The original checks were all
// Dutch, so it passed as a leaflet, was OCR'd, and produced the retailer's only
// stored deal: EUR 45.60 down from EUR 193.74, both sliced out of the IP
// addresses the block page prints.
//
// The opposite failure matters just as much: a false positive aborts the scrape
// and drops the retailer's folder entirely, so the negative cases below are
// real retail copy that must never trip the detector.
// ---------------------------------------------------------------------------

const IMPERVA_BLOCK = `Access to this site is not possible
What happened?
This request was blocked by our security service
Your IP: 193.74.248.194
Proxy IP: 45.60.13.206 (ID 10567-100)
Incident ID: 0061000101234567890-123456789012345678`;

describe("looksLikeBotChallenge", () => {
	it("detects the Imperva block page that reached the price database", () => {
		expect(looksLikeBotChallenge(IMPERVA_BLOCK)).toBe(true);
	});

	it("still detects the Dutch Colruyt challenge", () => {
		expect(
			looksLikeBotChallenge("Sorry voor de onderbreking, we denken dat je een bot bent"),
		).toBe(true);
		expect(looksLikeBotChallenge("Je krijgt onmiddellijk weer toegang")).toBe(true);
	});

	it("detects a challenge from the URL even when the body is empty", () => {
		// Imperva serves its block from this path; a leaflet URL never contains it.
		expect(
			looksLikeBotChallenge("", "https://www.boots.com/_Incapsula_Resource?CWUDNSAI=23"),
		).toBe(true);
		expect(looksLikeBotChallenge("", "https://x.test/cdn-cgi/challenge")).toBe(true);
	});

	it("is case-insensitive", () => {
		expect(looksLikeBotChallenge("ACCESS DENIED")).toBe(true);
		expect(looksLikeBotChallenge("Attention Required!")).toBe(true);
	});

	it("does not fire on ordinary retail copy", () => {
		// Each of these contains a word that a looser matcher would catch.
		expect(
			looksLikeBotChallenge(
				"Deze actie is niet geldig. Toegang tot de winkel is vrij.",
			),
		).toBe(false);
		expect(
			looksLikeBotChallenge("Retourneren & Ruilen: 365 dagen om van idee te veranderen"),
		).toBe(false);
		expect(
			looksLikeBotChallenge("Onze cookies verbeteren je winkelervaring"),
		).toBe(false);
		expect(looksLikeBotChallenge("Folder van deze week - ALDI")).toBe(false);
	});

	it("does not fire on a normal leaflet URL", () => {
		expect(
			looksLikeBotChallenge("Nectarines 2,50", "https://folder.aldi.be/2632-nl-mag/"),
		).toBe(false);
	});

	it("tolerates missing input", () => {
		expect(looksLikeBotChallenge("")).toBe(false);
		expect(looksLikeBotChallenge(undefined as unknown as string)).toBe(false);
	});
});
