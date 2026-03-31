import { AlbertHeijnScraper } from "./albert-heijn";
import { LidlScraper } from "./lidl";
import { DelhaizeScraper } from "./delhaize";
import { ColruytScraper } from "./colruyt";
import { AldiScraper } from "./aldi";
import { ActionScraper } from "./action";
import { BaseScraper } from "./base";

export const scrapers: BaseScraper[] = [
	new AlbertHeijnScraper(),
	new LidlScraper(),
	new DelhaizeScraper(),
	new ColruytScraper(),
	new AldiScraper(),
	new ActionScraper(),
];
