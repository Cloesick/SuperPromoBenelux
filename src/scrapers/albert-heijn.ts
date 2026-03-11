import { BaseScraper, RetailerConfig } from "./base";

export class AlbertHeijnScraper extends BaseScraper {
  config: RetailerConfig = {
    slug: "albert-heijn",
    name: "Albert Heijn",
    folderTitle: "Albert Heijn Bonusfolder",
    folderUrls: [
      "https://www.ah.be/bonus/folder",
      "https://www.ah.be/bonus",
    ],
    dealUrls: [
      "https://www.ah.be/bonus",
    ],
    cookieSelectors: [
      "#accept-cookies",
      'button[data-testid="cookie-dialog-accept"]',
    ],
    priceSelectors: {
      card: '[class*="product-card"], [class*="bonus-card"], [class*="promotion"], [data-testhook*="product"]',
      name: '[class*="title"], [class*="name"], h3, h4',
      originalPrice: '[class*="was-price"], [class*="old-price"], [class*="original"], del, s',
      promoPrice: '[class*="price-now"], [class*="new-price"], [class*="promo-price"], [class*="bonus-price"]',
      discount: '[class*="discount"], [class*="savings"], [class*="badge"]',
      image: 'img[src*="product"], img[class*="product"]',
    },
  };
}
