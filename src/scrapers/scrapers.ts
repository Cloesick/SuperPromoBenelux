import { BaseScraper } from "./base";
import { Vertical } from "../lib/types";
import { getRetailerSlugsForVertical } from "../lib/retailers";

// ── Shared retailers ─────────────────────────────────────────────────────
import { AlbertHeijnScraper } from "./albert-heijn";
import { LidlScraper } from "./lidl";
import { DelhaizeScraper } from "./delhaize";
import { ColruytScraper } from "./colruyt";
import { AldiScraper } from "./aldi";
import { ActionScraper } from "./action";

// ── Pet ──────────────────────────────────────────────────────────────────
import { MaxiZooScraper } from "./maxi-zoo";
import { TomCoScraper } from "./tom-co";
import { ZooplusScraper } from "./zooplus";
import { AveveScraper } from "./aveve";
import { MedpetsScraper } from "./medpets";

// ── Electro ──────────────────────────────────────────────────────────────
import { MediaMarktScraper } from "./mediamarkt";
import { CoolblueScraper } from "./coolblue";
import { VandenBorreScraper } from "./vanden-borre";
import { KrefelScraper } from "./krefel";
import { BolScraper } from "./bol";

// ── Fashion ──────────────────────────────────────────────────────────────
import { HmScraper } from "./hm";
import { ZalandoScraper } from "./zalando";

// ── Home & Garden ────────────────────────────────────────────────────────
import { IkeaScraper } from "./ikea";
import { GammaScraper } from "./gamma";

// ── Beauty ───────────────────────────────────────────────────────────────
import { KruidvatScraper } from "./kruidvat";
import { IciParisXlScraper } from "./ici-paris-xl";
import { DouglasScraper } from "./douglas";
import { DiScraper } from "./di";
import { EtosScraper } from "./etos";
import { BootsScraper } from "./boots";
import { MullerScraper } from "./muller";
import { RossmannScraper } from "./rossmann";
import { TreacScraper } from "./treac";
import { RitualsScraper } from "./rituals";
import { YvesRocherScraper } from "./yves-rocher";
import { TheBodyShopScraper } from "./the-body-shop";

// ---------------------------------------------------------------------------
// All scrapers (one instance each)
// ---------------------------------------------------------------------------

export const allScrapers: BaseScraper[] = [
	// Shared
	new AlbertHeijnScraper(),
	new LidlScraper(),
	new DelhaizeScraper(),
	new ColruytScraper(),
	new AldiScraper(),
	new ActionScraper(),
	// Pet
	new MaxiZooScraper(),
	new TomCoScraper(),
	new ZooplusScraper(),
	new AveveScraper(),
	new MedpetsScraper(),
	// Electro
	new MediaMarktScraper(),
	new CoolblueScraper(),
	new VandenBorreScraper(),
	new KrefelScraper(),
	new BolScraper(),
	// Fashion
	new HmScraper(),
	new ZalandoScraper(),
	// Home & Garden
	new IkeaScraper(),
	new GammaScraper(),
	// Beauty
	new KruidvatScraper(),
	new IciParisXlScraper(),
	new DouglasScraper(),
	new DiScraper(),
	new EtosScraper(),
	new BootsScraper(),
	new MullerScraper(),
	new RossmannScraper(),
	new TreacScraper(),
	new RitualsScraper(),
	new YvesRocherScraper(),
	new TheBodyShopScraper(),
];

export function getScrapersForVertical(vertical: Vertical): BaseScraper[] {
	const slugs = new Set(getRetailerSlugsForVertical(vertical));
	return allScrapers.filter((s) => slugs.has(s.retailerSlug));
}

export const scrapers: BaseScraper[] = allScrapers;
