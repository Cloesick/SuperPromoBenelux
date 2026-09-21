// ---------------------------------------------------------------------------
// Retailers whose folder belongs to the harvest (harvest-all.mjs), so the
// scraper leaves them alone.
//
// Nine retailers had both a scraper and a harvest entry, and both jobs wrote
// the same data/folders file; whichever ran last won. Where the harvest works,
// the scraper's version was the worse one every time. On 2026-09-21 it cut AH
// from 32 pages to 18, Etos from 69 to 31 and Gamma from 52 to 9, and for
// MediaMarkt it framed a legal guarantee notice PDF as the week's folder. The
// harvester reads the leaflet platform itself and checks the folder's own
// dates (folderDates.mjs).
//
// Only listed here when the harvest is the working source. action and aveve
// are harvested too, but the harvest finds no PDF for them, so the scraper
// stays their source. mediamarkt is here even though the harvest currently
// skips it (its only Publitas folder is December's): no folder is honest,
// and the scraper's is not a folder.
//
// Read by scripts/scrape-targets.mts, which drops these from every group.
// ---------------------------------------------------------------------------

export const HARVEST_OWNED_SLUGS = [
	'albert-heijn',
	'brico',
	'colruyt',
	'etos',
	'gamma',
	'lidl',
	'mediamarkt',
];
