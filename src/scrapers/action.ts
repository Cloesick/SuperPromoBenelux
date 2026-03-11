import { BaseScraper, RetailerConfig } from "./base";

export class ActionScraper extends BaseScraper {
  config: RetailerConfig = {
    slug: "action",
    name: "Action",
    folderTitle: "Action folder van de week",
    folderUrls: [
      "https://www.action.com/nl-be/folder/",
      "https://www.action.com/nl-be/weekactie/",
    ],
    cookieSelectors: [
      "#onetrust-accept-btn-handler",
      "button#onetrust-accept-btn-handler",
    ],
  };
}
