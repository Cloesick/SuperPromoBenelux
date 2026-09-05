// ---------------------------------------------------------------------------
// Is this retailer's stored data actually usable today?
//
// The existing guards protect a good file from being overwritten by a bad run,
// which is the right instinct and has fired correctly. What nothing did was ask
// the opposite question — "has this file been good for a while now?" — so a
// retailer could sit on an expired folder for a month and every run would still
// print a green tick.
//
// That is not hypothetical. On 2026-09-05 all 47 stored folders were expired,
// the freshest by 7 days and 22 of them by nearly a month, and the summary line
// for each was `✓`. Lidl in particular had been scraping an HTTP 404 since early
// August: the page returned nav links, the price selectors matched nothing, zero
// priced deals came out, and the harvest guard discarded the run as "thinner"
// every single time. Silent, and indistinguishable from a quiet promo week.
//
// The two signals that would have caught it are both cheap and neither existed:
//
//   EXPIRED  the stored folder's validUntil is in the past
//   BLIND    deals exist but none of them carry a price
//
// BLIND is the important one. A scraper whose selectors stop matching still
// returns HTTP 200 and still produces rows, so only the *priced* count separates
// "the promo is quiet this week" from "we have been broken since August".
//
// Pure and filesystem-free by design: run.ts passes in what it already read, and
// the same function audits every stored file without touching the network.
// ---------------------------------------------------------------------------

import { Deal } from "../lib/types";

export type StalenessLevel = "ok" | "expiring" | "expired" | "blind" | "empty";

export interface StalenessInput {
	slug: string;
	/** The stored folder's validUntil, ISO yyyy-mm-dd. */
	validUntil?: string | null;
	deals: Pick<Deal, "promoPrice" | "originalPrice">[];
	folderCount: number;
}

export interface StalenessVerdict {
	slug: string;
	level: StalenessLevel;
	/** Positive once validUntil has passed. */
	daysExpired: number | null;
	dealCount: number;
	pricedCount: number;
	reason: string;
}

/** A deal only counts as priced if a promo price actually made it through. */
export function isPriced(d: Pick<Deal, "promoPrice" | "originalPrice">): boolean {
	return typeof d.promoPrice === "number" && Number.isFinite(d.promoPrice);
}

function daysBetween(from: Date, to: Date): number {
	return Math.floor((to.getTime() - from.getTime()) / 86_400_000);
}

/**
 * `today` is injected rather than read from the clock so the tests do not drift
 * and so a backfill can ask "was this stale on the 12th?".
 */
export function assessStaleness(
	input: StalenessInput,
	today: Date = new Date(),
): StalenessVerdict {
	const dealCount = input.deals.length;
	const pricedCount = input.deals.filter(isPriced).length;

	let daysExpired: number | null = null;
	if (input.validUntil) {
		const until = new Date(`${input.validUntil}T23:59:59Z`);
		if (!Number.isNaN(until.getTime())) daysExpired = daysBetween(until, today);
	}

	const base = {
		slug: input.slug,
		daysExpired,
		dealCount,
		pricedCount,
	};

	if (input.folderCount === 0 && dealCount === 0)
		return { ...base, level: "empty", reason: "no folder and no deals stored" };

	if (daysExpired !== null && daysExpired > 0)
		return {
			...base,
			level: "expired",
			reason: `folder expired ${daysExpired}d ago (validUntil ${input.validUntil})`,
		};

	// Priced-deal collapse is the silent one, so it outranks a merely thin week.
	if (dealCount > 0 && pricedCount === 0)
		return {
			...base,
			level: "blind",
			reason: `${dealCount} deal(s) but none priced — selectors likely stopped matching`,
		};

	if (daysExpired !== null && daysExpired >= -1)
		return {
			...base,
			level: "expiring",
			reason: `folder expires within a day (validUntil ${input.validUntil})`,
		};

	return { ...base, level: "ok", reason: `${pricedCount} priced deal(s)` };
}

const ORDER: Record<StalenessLevel, number> = {
	empty: 0,
	blind: 1,
	expired: 2,
	expiring: 3,
	ok: 4,
};

const ICON: Record<StalenessLevel, string> = {
	empty: "∅",
	blind: "◐",
	expired: "✗",
	expiring: "!",
	ok: "✓",
};

/** Worst first: a run's tail is where a human actually looks. */
export function formatStalenessReport(verdicts: StalenessVerdict[]): string {
	if (verdicts.length === 0) return "No retailers assessed.";

	const sorted = [...verdicts].sort(
		(a, b) => ORDER[a.level] - ORDER[b.level] || a.slug.localeCompare(b.slug),
	);
	const width = Math.max(...sorted.map((v) => v.slug.length));

	const lines = sorted.map(
		(v) => `  ${ICON[v.level]} ${v.slug.padEnd(width)}  ${v.reason}`,
	);

	const counts = sorted.reduce<Record<string, number>>((acc, v) => {
		acc[v.level] = (acc[v.level] || 0) + 1;
		return acc;
	}, {});

	const unhealthy = sorted.filter((v) => v.level !== "ok").length;
	const headline =
		unhealthy === 0
			? `All ${sorted.length} retailer(s) current.`
			: `${unhealthy} of ${sorted.length} retailer(s) need attention: ` +
				(["empty", "blind", "expired", "expiring"] as StalenessLevel[])
					.filter((l) => counts[l])
					.map((l) => `${counts[l]} ${l}`)
					.join(", ");

	return [headline, ...lines].join("\n");
}

/** True when a run should be treated as a failure by CI or a scheduler. */
export function hasCriticalStaleness(verdicts: StalenessVerdict[]): boolean {
	return verdicts.some(
		(v) => v.level === "blind" || v.level === "expired" || v.level === "empty",
	);
}
