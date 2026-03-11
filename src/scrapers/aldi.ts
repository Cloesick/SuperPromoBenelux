import { BaseScraper, RetailerConfig } from "./base";

export class AldiScraper extends BaseScraper {
  config: RetailerConfig = {
    slug: "aldi",
    name: "ALDI",
    folderTitle: "ALDI folder van de week",
    folderUrls: [
      "https://www.aldi.be/nl/onze-folders/folder-van-deze-week.html",
      "https://www.aldi.be/nl/onze-folders.html",
    ],
    cookieSelectors: [
      "#onetrust-accept-btn-handler",
    ],
  };
}
