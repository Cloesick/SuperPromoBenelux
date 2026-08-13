import { describe, expect, it, vi } from "vitest";
import { resolveCanonical, toSlug } from "./canonicalize";
import type { ExtractedProduct } from "../scrapers/productExtraction";

function product(over: Partial<ExtractedProduct> = {}): ExtractedProduct {
  return {
    brand: "Coca-Cola",
    name: "Coca-Cola Zero",
    variant: null,
    sizeText: "1,5 L",
    priceCents: 149,
    originalPriceCents: 199,
    promoLabel: null,
    confidence: 0.9,
    ...over,
  };
}

describe("toSlug", () => {
  it("builds a url-safe slug from brand, name and size", () => {
    expect(toSlug("Coca-Cola", "Coca-Cola Zero", "1,5 L")).toBe(
      "coca-cola-zero-1-5-l",
    );
  });

  it("does not repeat the brand when the name already contains it", () => {
    expect(toSlug("Jupiler", "Jupiler Pils", "33 cl")).toBe("jupiler-pils-33-cl");
  });

  it("survives a missing brand and size", () => {
    expect(toSlug(null, "Bloemkool", null)).toBe("bloemkool");
  });
});

describe("resolveCanonical", () => {
  it("reuses an existing canonical product without inserting", async () => {
    const find = vi.fn().mockResolvedValue({ id: "existing-id" });
    const insert = vi.fn();

    const result = await resolveCanonical(product(), { find, insert });

    expect(result).toEqual({ id: "existing-id", created: false });
    expect(insert).not.toHaveBeenCalled();
  });

  it("inserts a new canonical product on a miss", async () => {
    const find = vi.fn().mockResolvedValue(null);
    const insert = vi.fn().mockResolvedValue("new-id");

    const result = await resolveCanonical(product(), { find, insert });

    expect(result).toEqual({ id: "new-id", created: true });
    expect(insert).toHaveBeenCalledOnce();
  });

  it("looks up by the same key that two spellings of one product share", async () => {
    // This is the whole point of the catalog: Delhaize writes "1,5 L" and
    // Colruyt writes "1.5l" for the identical bottle.
    const find = vi.fn().mockResolvedValue(null);
    const insert = vi.fn().mockResolvedValue("id");

    await resolveCanonical(product({ name: "Coca Cola Zero", sizeText: "1.5l" }), {
      find,
      insert,
    });
    const firstKey = find.mock.calls[0][0];

    find.mockClear();
    await resolveCanonical(product({ name: "Coca-Cola Zero", sizeText: "1,5 L" }), {
      find,
      insert,
    });
    const secondKey = find.mock.calls[0][0];

    expect(firstKey).toBe(secondKey);
  });

  it("does not collide a six-pack with a single bottle of the same volume", async () => {
    const find = vi.fn().mockResolvedValue(null);
    const insert = vi.fn().mockResolvedValue("id");

    await resolveCanonical(
      product({ brand: "Jupiler", sizeText: "6 x 33 cl" }),
      { find, insert },
    );
    const packKey = find.mock.calls[0][0];

    find.mockClear();
    await resolveCanonical(product({ brand: "Jupiler", sizeText: "1980 ml" }), {
      find,
      insert,
    });
    const singleKey = find.mock.calls[0][0];

    expect(packKey).not.toBe(singleKey);
  });
});
