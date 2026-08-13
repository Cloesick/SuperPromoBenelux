import { describe, expect, it } from "vitest";
import { isPublishableProduct, MIN_CONFIDENCE } from "./extractionGuard";
import type { ExtractedProduct } from "../scrapers/productExtraction";

function product(over: Partial<ExtractedProduct> = {}): ExtractedProduct {
  return {
    brand: "Coca-Cola",
    name: "Coca-Cola Zero",
    variant: null,
    sizeText: "1,5 L",
    priceCents: 149,
    originalPriceCents: 199,
    promoLabel: "-25%",
    confidence: 0.95,
    ...over,
  };
}

// ---------------------------------------------------------------------------
// A model error looks plausible in a way OCR noise never did: correct shape,
// sensible-looking number, entirely invented. These checks are the last gate
// before a wrong price reaches a page a shopper is trusting.
// ---------------------------------------------------------------------------

describe("isPublishableProduct", () => {
  it("accepts a well-formed product", () => {
    expect(isPublishableProduct(product())).toBe(true);
  });

  it("rejects a product with no price", () => {
    expect(isPublishableProduct(product({ priceCents: null }))).toBe(false);
  });

  it("rejects a price outside the plausible band", () => {
    // dealValidation caps at MIN_PRICE 0.01 and MAX_PRICE 50_000 euro, so the
    // out-of-band case has to clear €50k rather than merely look large.
    expect(isPublishableProduct(product({ priceCents: 0 }))).toBe(false);
    expect(isPublishableProduct(product({ priceCents: 6_000_000 }))).toBe(false);
  });

  it("rejects a promo price at or above its own original price", () => {
    // Reading the two prices the wrong way round is a common layout error.
    expect(
      isPublishableProduct(product({ priceCents: 299, originalPriceCents: 199 })),
    ).toBe(false);
  });

  it("rejects low confidence", () => {
    expect(isPublishableProduct(product({ confidence: 0.4 }))).toBe(false);
  });

  it("rejects a name that is leaflet furniture rather than a product", () => {
    // "flessen" is exactly what the current Colruyt extraction produces.
    expect(isPublishableProduct(product({ name: "flessen" }))).toBe(false);
  });

  it("exposes the confidence floor for callers that queue rather than drop", () => {
    expect(MIN_CONFIDENCE).toBe(0.7);
  });
});
