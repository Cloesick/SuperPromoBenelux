import { BaseScraper, RetailerConfig } from "./base";

export class LidlScraper extends BaseScraper {
  config: RetailerConfig = {
    slug: "lidl",
    name: "Lidl",
    folderTitle: "Lidl folder van de week",
    folderUrls: [
      "https://www.lidl.be/c/nl-BE/folders-magazines/s10008101",
      "https://www.lidl.be/nl/aanbiedingen",
    ],
    dealUrls: [
      "https://www.lidl.be/nl/aanbiedingen",
    ],
    cookieSelectors: [
      "#onetrust-accept-btn-handler",
      'button[class*="cookie-alert--accept"]',
    ],
    folderLinkPatterns: [
      /folder-nl\.lidl\.be\//,
    ],
    priceSelectors: {
      card: '[class*="product"], [class*="ACampaignGrid"] > div, [class*="offer-card"], [class*="ATheHeroStage"]',
      name: '[class*="product-name"], [class*="title"], h3, h4, [class*="keyfact"]',
      originalPrice: '[class*="strikethrough"], [class*="old-price"], del, s',
      promoPrice: '[class*="price"], [class*="m-price"]',
      discount: '[class*="discount"], [class*="badge"], [class*="saving"]',
      image: 'img[src*="product"], img[class*="product"], picture img',
    },
  };
}
