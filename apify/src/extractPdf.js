// PDF → deals extraction. Faithful JS port of the site's proven
// src/scrapers/extractDealsFromText.ts (pdfjs text extraction + parser), so the
// Apify actor produces the same Deal shape for Publitas-based retailers
// (Albert Heijn, Delhaize, Lidl, Action).

import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';

/** Fetch a PDF and extract deals from its text. Returns [] on any failure. */
export async function extractDealsFromPdf(pdfUrl, { retailerSlug, validFrom, validUntil }) {
  try {
    const res = await fetch(pdfUrl, { headers: { 'User-Agent': UA } });
    if (!res.ok) return [];
    const data = new Uint8Array(await res.arrayBuffer());
    const doc = await pdfjsLib.getDocument({ data, useSystemFonts: true }).promise;

    const pages = [];
    for (let i = 1; i <= Math.min(doc.numPages, 16); i++) {
      const page = await doc.getPage(i);
      const content = await page.getTextContent();
      pages.push(content.items.map((it) => ('str' in it ? it.str ?? '' : '')).join(' '));
    }
    const text = pages.join('\n');
    await doc.destroy();

    // Sanity: a product catalog has several euro prices.
    const priceCount = (text.match(/€\s*\d+[.,]\d{2}/g) || []).length;
    if (priceCount < 2) return [];

    return parseTextToDeals(text, { retailerSlug, validFrom, validUntil });
  } catch {
    return [];
  }
}

function parseTextToDeals(rawText, { retailerSlug, validFrom, validUntil }) {
  const lines = rawText
    .split(/\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 2);

  const blocks = extractProductBlocks(lines);
  const deals = [];
  for (const block of blocks) {
    if (!block.product || block.product.length < 3) continue;
    if (!block.promoPrice && !block.originalPrice && !block.discount) continue;
    deals.push({
      product: block.product,
      originalPrice: block.originalPrice,
      promoPrice: block.promoPrice,
      discount: block.discount,
      validFrom,
      validUntil,
      retailerSlug,
      source: 'Apify',
    });
  }
  // de-dupe
  const seen = new Set();
  return deals.filter((d) => {
    const k = `${d.product}|${d.promoPrice}|${d.discount}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

function extractProductBlocks(lines) {
  const blocks = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Pattern 1: euro price on the line
    const priceMatch = line.match(/€\s*(\d+[.,]\d{2})\s*/g);
    if (priceMatch && priceMatch.length > 0) {
      const prices = priceMatch.map((p) =>
        parseFloat(p.replace('€', '').replace(',', '.').trim()),
      );
      let productName = line.replace(/€\s*\d+[.,]\d{2}/g, '').replace(/\d+[.,]\d{2}/g, '').trim();
      if (productName.length < 3 && i > 0) productName = lines[i - 1];
      productName = cleanProductName(productName);
      if (productName.length >= 3) {
        const block = { product: productName };
        if (prices.length >= 2) {
          block.originalPrice = Math.max(...prices);
          block.promoPrice = Math.min(...prices);
        } else if (prices.length === 1) {
          block.promoPrice = prices[0];
        }
        const discountMatch = line.match(/(-?\d+\s*%|[123]\s*\+\s*[123]|gratis|korting|réduction)/i);
        if (discountMatch) block.discount = discountMatch[0].trim();
        else if (i + 1 < lines.length) {
          const next = lines[i + 1].match(/(-?\d+\s*%|[123]\s*\+\s*[123]|gratis|korting|réduction)/i);
          if (next) block.discount = next[0].trim();
        }
        blocks.push(block);
      }
      continue;
    }

    // Pattern 2: discount text without euro price
    const discountOnly = line.match(
      /(-\d+\s*%|\d+\s*\+\s*\d+\s*gratis|[234]e?\s*(halve\s*prijs|gratis)|koop\s*\d+\s*betaal)/i,
    );
    if (discountOnly) {
      let productName = cleanProductName(i > 0 ? lines[i - 1] : '');
      if (productName.length >= 3) blocks.push({ product: productName, discount: discountOnly[0].trim() });
      continue;
    }

    // Pattern 3: naked prices (no euro sign), two on a line = product card
    const naked = line.match(/\b(\d{1,3}[.,]\d{2})\b/g);
    if (naked && naked.length >= 2) {
      const prices = naked.map((p) => parseFloat(p.replace(',', '.')));
      let productName = line.replace(/\b\d{1,3}[.,]\d{2}\b/g, '').trim();
      if (productName.length < 3 && i > 0) productName = lines[i - 1];
      productName = cleanProductName(productName);
      if (productName.length >= 3 && prices.length >= 2) {
        blocks.push({ product: productName, originalPrice: Math.max(...prices), promoPrice: Math.min(...prices) });
      }
    }
  }
  return blocks;
}

function cleanProductName(name) {
  return (name || '')
    .replace(/€\s*\d+[.,]\d{2}/g, '')
    .replace(/\b\d{1,3}[.,]\d{2}\b/g, '')
    .replace(/^(per\s*(stuk|kg|liter|l)|vanaf|nu|nieuw|actie|promo|van)\s*/i, '')
    .replace(/^[^a-zA-Z0-9À-ÿ]+/, '')
    .replace(/[^a-zA-Z0-9À-ÿ]+$/, '')
    .trim();
}
