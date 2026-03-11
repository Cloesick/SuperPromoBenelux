import { BaseScraper, RetailerConfig } from "./base";

export class DelhaizeScraper extends BaseScraper {
  config: RetailerConfig = {
    slug: "delhaize",
    name: "Delhaize",
    folderTitle: "Delhaize folder van de week",
    folderUrls: [
      "https://www.delhaize.be/nl/folder",
      "https://www.delhaize.be/nl/promoties",
    ],
    dealUrls: [
      "https://www.delhaize.be/nl/promoties",
    ],
    cookieSelectors: [
      "#onetrust-accept-btn-handler",
      'button[class*="accept"]',
    ],
    priceSelectors: {
      card: '[class*="product-card"], [class*="promo-card"], [class*="promotion-item"], [class*="tile"]',
      name: '[class*="product-name"], [class*="title"], h3, h4',
      originalPrice: '[class*="old-price"], [class*="was-price"], del, s',
      promoPrice: '[class*="price"], [class*="new-price"], [class*="promo-price"]',
      discount: '[class*="discount"], [class*="savings"], [class*="badge"], [class*="reduction"]',
      image: 'img[src*="product"], img[class*="product"], picture img',
    },
  };
}
