import { BaseScraper, RetailerConfig } from "./base";

export class ColruytScraper extends BaseScraper {
  config: RetailerConfig = {
    slug: "colruyt",
    name: "Colruyt",
    folderTitle: "Colruyt folder van de week",
    folderUrls: [
      "https://www.colruyt.be/nl/folders",
      "https://www.colruyt.be/nl/promoties",
    ],
    dealUrls: [
      "https://www.colruyt.be/nl/promoties",
    ],
    cookieSelectors: [
      "#onetrust-accept-btn-handler",
      'button[class*="accept"]',
      'button[id*="accept"]',
    ],
    clickSelectors: [
      "button.btn--folder",
      ".folder-overview__card button",
    ],
    priceSelectors: {
      card: '[class*="product-card"], [class*="promo-card"], [class*="promotion"], [class*="tile"], [class*="article"]',
      name: '[class*="product-name"], [class*="title"], h3, h4',
      originalPrice: '[class*="old-price"], [class*="was-price"], del, s',
      promoPrice: '[class*="price"], [class*="new-price"], [class*="promo-price"]',
      discount: '[class*="discount"], [class*="savings"], [class*="badge"], [class*="reduction"]',
      image: 'img[src*="product"], img[class*="product"], picture img',
    },
  };
}
