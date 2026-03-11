import { AlbertHeijnScraper } from "./albert-heijn";
import { LidlScraper } from "./lidl";
import { DelhaizeScraper } from "./delhaize";
import { ColruytScraper } from "./colruyt";
import { AldiScraper } from "./aldi";
import { ActionScraper } from "./action";
import { BaseScraper } from "./base";

const scrapers: BaseScraper[] = [
  new AlbertHeijnScraper(),
  new LidlScraper(),
  new DelhaizeScraper(),
  new ColruytScraper(),
  new AldiScraper(),
  new ActionScraper(),
];

async function main() {
  const target = process.argv[2];

  const toRun = target
    ? scrapers.filter((s) => s.retailerSlug === target)
    : scrapers;

  if (toRun.length === 0) {
    console.error(`Unknown retailer: ${target}`);
    console.log(
      `Available: ${scrapers.map((s) => s.retailerSlug).join(", ")}`
    );
    process.exit(1);
  }

  console.log(`Running ${toRun.length} scraper(s)...\n`);

  const results: { name: string; success: boolean; error?: string }[] = [];

  for (const scraper of toRun) {
    try {
      await scraper.run();
      results.push({ name: scraper.retailerName, success: true });
    } catch (error) {
      results.push({
        name: scraper.retailerName,
        success: false,
        error: error instanceof Error ? error.message : String(error),
      });
    }
    console.log("");
  }

  console.log("=== Scrape Summary ===");
  for (const r of results) {
    const status = r.success ? "✓" : "✗";
    const detail = r.error ? ` (${r.error})` : "";
    console.log(`  ${status} ${r.name}${detail}`);
  }

  const failures = results.filter((r) => !r.success);
  if (failures.length > 0) {
    process.exit(1);
  }
}

main();
