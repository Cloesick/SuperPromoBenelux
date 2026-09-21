// ---------------------------------------------------------------------------
// How fresh is a folder, in words a shopper uses?
//
// Cards used to say nothing until a folder had expired, then "Verlopen". The
// useful facts come before that: is it new, how long is it still good, does
// next week's already exist. Competitors put exactly this on every card
// ("Verloopt over 3 dagen", "Start over 2 dagen"); now that folder dates are
// reliable, so can we.
//
// Pure and UTC: folder dates are calendar days ("2026-09-21"), and `today` is
// passed in so tests don't drift.
// ---------------------------------------------------------------------------

export type FolderStatusTone = "new" | "active" | "ending" | "upcoming" | "expired";

export interface FolderStatus {
	label: string;
	tone: FolderStatusTone;
}

const DAY = 86_400_000;

function dayNumber(iso: string): number | null {
	const t = Date.parse(`${iso.slice(0, 10)}T00:00:00Z`);
	return Number.isNaN(t) ? null : Math.floor(t / DAY);
}

function todayNumber(today: Date): number {
	return Math.floor(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()) / DAY);
}

export function folderStatus(
	validFrom: string | undefined,
	validUntil: string | undefined,
	today: Date = new Date(),
): FolderStatus | null {
	if (!validFrom || !validUntil) return null;
	const from = dayNumber(validFrom);
	const until = dayNumber(validUntil);
	if (from === null || until === null) return null;
	const now = todayNumber(today);

	if (now > until) return { label: "Verlopen", tone: "expired" };
	if (now < from) {
		const n = from - now;
		return { label: n === 1 ? "Start morgen" : `Start over ${n} dagen`, tone: "upcoming" };
	}
	const left = until - now;
	if (left === 0) return { label: "Verloopt vandaag", tone: "ending" };
	if (left === 1) return { label: "Verloopt morgen", tone: "ending" };
	if (now === from) return { label: "Nieuw vandaag", tone: "new" };
	return { label: `Nog ${left + 1} dagen geldig`, tone: "active" };
}

/** Tailwind classes per tone, shared by every place that shows a status. */
export const STATUS_CLASSES: Record<FolderStatusTone, string> = {
	new: "bg-emerald-600 text-white",
	active: "bg-blue-700 text-white",
	ending: "bg-amber-500 text-white",
	upcoming: "bg-violet-600 text-white",
	expired: "bg-gray-500 text-white",
};

/** "21/09" from "2026-09-21". */
const dm = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;

/**
 * What a folder is called on the site: "Lidl folder 21/09 – 26/09".
 *
 * Titles come from wherever the folder was harvested and read like
 * "Lidl BE NL - nl folder 21-09-26-09", "2639_NL" or "HORNBACH NL -
 * WH_0926_NL_KW38". The retailer and dates are what a shopper tells folders
 * apart by, and those are reliable now.
 */
export function folderDisplayTitle(
	retailerName: string,
	folder: { title?: string; validFrom?: string; validUntil?: string },
): string {
	if (!folder.validFrom || !folder.validUntil) return folder.title || `${retailerName} folder`;
	return `${retailerName} folder ${dm(folder.validFrom)} – ${dm(folder.validUntil)}`;
}
