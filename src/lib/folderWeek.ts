// ---------------------------------------------------------------------------
// Which days a scraped folder covers.
//
// The scraper stamped every folder with this week's Monday–Sunday. Retailers
// run their own weeks: Colruyt Wednesday–Tuesday, Delhaize Thursday–Wednesday.
// Their folders were dated two or three days off, and on the site a folder
// went "verlopen" while it was still in the shops. retailers.ts already records
// each retailer's seo.folderDay, so the window starts on the most recent of
// that weekday and runs seven days.
//
// Pure and UTC throughout: `today` is passed in, and the old code mixed local
// getDay() with toISOString(), which shifted a day around midnight.
// ---------------------------------------------------------------------------

/** Dutch weekday → JS getUTCDay() number. */
export const WEEKDAY: Record<string, number> = {
	zondag: 0,
	maandag: 1,
	dinsdag: 2,
	woensdag: 3,
	donderdag: 4,
	vrijdag: 5,
	zaterdag: 6,
};

const DAY = 86_400_000;
const iso = (d: Date) => d.toISOString().slice(0, 10);

export interface FolderWindow {
	from: string;
	until: string;
}

/**
 * The seven-day window a folder captured on `today` belongs to.
 *
 * A named folder day starts the window on the most recent such day, today
 * included. Anything else ("wekelijks", "doorlopend", unset) keeps the ISO
 * Monday–Sunday week, since there is no better anchor.
 */
export function weekWindow(folderDay: string | undefined, today: Date = new Date()): FolderWindow {
	const midnight = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
	const key = (folderDay ?? "").toLowerCase().trim();
	const startDow = key in WEEKDAY ? WEEKDAY[key] : 1;
	const back = (midnight.getUTCDay() - startDow + 7) % 7;
	const from = new Date(midnight.getTime() - back * DAY);
	const until = new Date(from.getTime() + 6 * DAY);
	return { from: iso(from), until: iso(until) };
}
