// ---------------------------------------------------------------------------
// When is a harvested folder actually valid?
//
// Publitas manifests carry no validity dates, so buildScrapedData stamped every
// folder "today → today + 10". Whatever an account served therefore looked
// current. On 2026-09-21 that published Lidl's *2025* week-38 folder (Lidl
// reuses its dd-mm URL slugs every year) and MediaMarkt's December "W50 EOY"
// folder as this week's, both with fresh dates.
//
// Retailers do state validity, in the title or the URL, in a handful of ways:
//
//   "Jumbo actiefolder - week 39 - 23 september t/m 29 september"
//   "Xenos week 39-40 2026 (ma 21-9 t/m zo 4-10)"
//   "Folder 13 - du 08 septembre au 1er octobre"
//   https://folder-nl.lidl.be/nl-folder-21-09-26-09
//   "AH - Bonus-week-39-2026", "WH_0926_NL_KW38", "SPAR folder wk20263738"
//   "2639_NL"  (Hubo: yyww)
//
// inferValidity reads those, explicit day ranges before week numbers. A folder
// whose own dates are over, or that starts weeks from now, is not this week's
// folder, and the harvester skips it rather than publishing it as current.
// Pure: `today` is passed in, nothing is fetched.
// ---------------------------------------------------------------------------

const DAY = 86400000;

const MONTHS = {
	jan: 1, januari: 1, janvier: 1,
	feb: 2, februari: 2, fevrier: 2, 'février': 2,
	mrt: 3, maart: 3, mars: 3,
	apr: 4, april: 4, avril: 4,
	mei: 5, mai: 5,
	jun: 6, juni: 6, juin: 6,
	jul: 7, juli: 7, juillet: 7,
	aug: 8, augustus: 8, 'août': 8, aout: 8,
	sep: 9, sept: 9, september: 9, septembre: 9,
	okt: 10, oktober: 10, oct: 10, octobre: 10,
	nov: 11, november: 11, novembre: 11,
	dec: 12, december: 12, 'décembre': 12, decembre: 12,
};

const iso = (d) => d.toISOString().slice(0, 10);
const utc = (y, m, d) => new Date(Date.UTC(y, m - 1, d));

/** Monday of ISO week `week` in `year`. */
export function isoWeekMonday(year, week) {
	const jan4 = utc(year, 1, 4);
	const dow = (jan4.getUTCDay() + 6) % 7; // Monday = 0
	return new Date(jan4.getTime() - dow * DAY + (week - 1) * 7 * DAY);
}

/**
 * A day and month with no year belongs to whichever year puts it nearest
 * today, so a December harvest reading "t/m 4-1" lands in January next year.
 */
function nearestYear(day, month, today) {
	const y = today.getUTCFullYear();
	return [y - 1, y, y + 1]
		.map((yr) => utc(yr, month, day))
		.sort((a, b) => Math.abs(a - today) - Math.abs(b - today))[0];
}

function range(from, until, basis) {
	if (!(from <= until) || until - from > 70 * DAY) return null;
	return { from: iso(from), until: iso(until), basis };
}

function fromDayMonthRange(d1, m1, d2, m2, today, basis) {
	if (!(m1 >= 1 && m1 <= 12 && m2 >= 1 && m2 <= 12 && d1 >= 1 && d1 <= 31 && d2 >= 1 && d2 <= 31)) return null;
	const until = nearestYear(d2, m2, today);
	let from = utc(until.getUTCFullYear(), m1, d1);
	if (from > until) from = utc(until.getUTCFullYear() - 1, m1, d1);
	return range(from, until, basis);
}

/** Every match of a global regex, overlapping ones included. */
function* overlappingMatches(re, text) {
	re.lastIndex = 0;
	let m;
	while ((m = re.exec(text))) {
		yield m;
		re.lastIndex = m.index + 1;
	}
}

function explicitRange(text, today) {
	// "21-9 t/m 4-10", "21/09 - 26/09", "21.9 tot 4.10"
	// Every match is tried, overlapping ones too: "week 39 - 23 september"
	// first offers an impossible day 39, and the real range follows it.
	// (?<!\d) keeps a retry from starting mid-number, reading "39" as "9".
	const numeric = /(?<!\d)(\d{1,2})[-/.](\d{1,2})\s*(?:t\/?m|t\.e\.m\.?|tot|au|–|-)\s*(?:[a-z]{2,3}\.?\s+)?(\d{1,2})[-/.](\d{1,2})(?![-/.]?\d)/gi;
	for (const m of overlappingMatches(numeric, text)) {
		const r = fromDayMonthRange(+m[1], +m[2], +m[3], +m[4], today, 'title range');
		if (r) return r;
	}

	// "23 september t/m 29 september", "du 08 septembre au 1er octobre"
	const month = Object.keys(MONTHS).sort((a, b) => b.length - a.length).join('|');
	const named = new RegExp(`(?<!\\d)(\\d{1,2})(?:er)?\\s+(${month})?\\s*(?:t\\/?m|tot|au|–|-)\\s*(\\d{1,2})(?:er)?\\s+(${month})(?![a-zé])`, 'gi');
	for (const m of overlappingMatches(named, text)) {
		const m2 = MONTHS[m[4].toLowerCase()];
		const m1 = m[2] ? MONTHS[m[2].toLowerCase()] : m2;
		const r = fromDayMonthRange(+m[1], m1, +m[3], m2, today, 'title range');
		if (r) return r;
	}
	return null;
}

function urlRange(url, today) {
	// Lidl: /nl-folder-21-09-26-09
	const m = (url || '').match(/(\d{2})-(\d{2})-(\d{2})-(\d{2})(?:[/?#]|$)/);
	return m ? fromDayMonthRange(+m[1], +m[2], +m[3], +m[4], today, 'url range') : null;
}

function weekRange(text, today) {
	let year;
	let w1;
	let w2;
	let m = text.match(/\bwk(20\d\d)(\d{2})(\d{2})?\b/i); // "wk20263738"
	if (m) [year, w1, w2] = [+m[1], +m[2], m[3] ? +m[3] : undefined];
	if (!m) {
		m = text.match(/^(2\d)([0-5]\d)_[a-z]{2}$/i); // Hubo "2639_NL"
		if (m) [year, w1] = [2000 + +m[1], +m[2]];
	}
	if (!m) {
		// (?<![a-z]) not \b: in "WH_0926_NL_KW38" the underscore is a word
		// character, so \bkw never matches.
		m = text.match(/(?<![a-z])(?:week|wk|kw|w)[\s_-]*(\d{1,2})(?:\s*[-–]\s*(\d{1,2}))?(?:[\s_-]+(20\d\d))?(?!\d)/i);
		if (m) [w1, w2, year] = [+m[1], m[2] ? +m[2] : undefined, m[3] ? +m[3] : undefined];
	}
	if (!m || !(w1 >= 1 && w1 <= 53)) return null;
	if (w2 !== undefined && !(w2 >= w1 && w2 - w1 <= 4)) w2 = undefined;

	// No year: the one that puts the week nearest today.
	const years = year ? [year] : [today.getUTCFullYear() - 1, today.getUTCFullYear(), today.getUTCFullYear() + 1];
	const from = years
		.map((y) => isoWeekMonday(y, w1))
		.sort((a, b) => Math.abs(a - today) - Math.abs(b - today))[0];
	const until = new Date(from.getTime() + ((w2 ?? w1) - w1) * 7 * DAY + 6 * DAY);
	const out = range(from, until, 'week number');
	return out && { ...out, yearStated: year !== undefined };
}

const strip = (w) => w && { from: w.from, until: w.until, basis: w.basis };

/**
 * Validity stated by the folder itself, or null when it states none.
 * @param {string} title
 * @param {string} url
 * @param {Date} today
 * @returns {{from: string, until: string, basis: string} | null}
 */
export function inferValidity(title, url, today = new Date()) {
	const t = String(title || '');
	const week = weekRange(t, today);
	// A week with its year stated outranks a yearless URL: Lidl reuses its
	// dd-mm slugs every year, and only the title says which year it is.
	if (week?.yearStated) return explicitRange(t, today) || strip(week);
	return explicitRange(t, today) || urlRange(url, today) || strip(week);
}

/**
 * Why a folder is not a current or upcoming one, or null when it may be.
 * Over is over; more than three weeks out is not "this week or next".
 */
export function rejectReason(validity, today = new Date()) {
	if (!validity) return null;
	const day = iso(today);
	if (validity.until < day) return `ended ${validity.until} (${validity.basis})`;
	const horizon = iso(new Date(today.getTime() + 21 * DAY));
	if (validity.from > horizon) return `starts ${validity.from} (${validity.basis})`;
	return null;
}
