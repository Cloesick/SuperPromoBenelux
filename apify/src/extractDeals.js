// Price/deal extraction from folder page text.
// Ported from src/scrapers/extractDealsFromText.ts so Apify output matches the
// site's existing Deal shape: { product, originalPrice?, promoPrice?, discount? }.

const PRICE_RE = /(\d+)[.,](\d{2})/; // 1,99 / 1.99
const DISCOUNT_RE = /(-?\d{1,2}\s*%|\d\s*\+\s*\d|gratis|tweede\s+halve\s+prijs)/i;

function toNumber(match) {
  if (!match) return undefined;
  return parseFloat(`${match[1]}.${match[2]}`);
}

/**
 * Extract structured deals from raw page text.
 * Conservative: only emits a deal when a product-like line sits next to a price.
 */
export function extractDeals(rawText, { retailerSlug, validFrom, validUntil }) {
  const lines = rawText
    .split(/\n+/)
    .map((l) => l.replace(/\s+/g, ' ').trim())
    .filter((l) => l.length > 2);

  // Sanity: a real promo page has several euro prices.
  const priceCount = (rawText.match(/€?\s*\d+[.,]\d{2}/g) || []).length;
  if (priceCount < 3) return [];

  const deals = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const priceMatch = line.match(PRICE_RE);
    if (!priceMatch) continue;

    // Product name: this line minus price tokens, or the preceding line.
    let product = line
      .replace(/€/g, '')
      .replace(/-?\d+[.,]\d{2}/g, '')
      .replace(DISCOUNT_RE, '')
      .trim();
    if (product.length < 3 && i > 0) product = lines[i - 1].slice(0, 80);
    if (product.length < 3) continue;

    const allPrices = [...line.matchAll(/(\d+)[.,](\d{2})/g)].map((m) => toNumber(m));
    const promoPrice = allPrices.length ? Math.min(...allPrices) : undefined;
    const originalPrice =
      allPrices.length > 1 ? Math.max(...allPrices) : undefined;
    const discount = (line.match(DISCOUNT_RE) || [])[0];

    deals.push({
      product: product.slice(0, 120),
      retailerSlug,
      originalPrice: originalPrice !== promoPrice ? originalPrice : undefined,
      promoPrice,
      discount: discount ? discount.replace(/\s+/g, '') : undefined,
      validFrom,
      validUntil,
      source: 'Apify',
    });
  }

  // De-dupe identical product+price rows.
  const seen = new Set();
  return deals.filter((d) => {
    const key = `${d.product}|${d.promoPrice}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
