export type SizeUnit = "ml" | "g" | "piece";

export interface ParsedSize {
  value: number;
  unit: SizeUnit;
  multipack: number;
}

/* Factors reduce every written unit to one base per dimension: volume to
 * millilitres, weight to grams. Comparing "1,5 L" against "150 cl" is only
 * possible once both are integers in the same unit. */
const UNIT_FACTORS: Record<string, { unit: SizeUnit; factor: number }> = {
  l: { unit: "ml", factor: 1000 },
  liter: { unit: "ml", factor: 1000 },
  cl: { unit: "ml", factor: 10 },
  ml: { unit: "ml", factor: 1 },
  kg: { unit: "g", factor: 1000 },
  g: { unit: "g", factor: 1 },
  gr: { unit: "g", factor: 1 },
  stuks: { unit: "piece", factor: 1 },
  stuk: { unit: "piece", factor: 1 },
  st: { unit: "piece", factor: 1 },
};

/* Longest first so "cl" is tried before "l" and "stuks" before "st" — a shorter
 * unit would otherwise match the prefix of a longer one and mis-scale the size. */
const UNIT_PATTERN = Object.keys(UNIT_FACTORS)
  .sort((a, b) => b.length - a.length)
  .join("|");

/* Combining diacritical marks. Written as an escape rather than literal marks
 * so the pattern survives any file encoding. */
const COMBINING_MARKS = /[̀-ͯ]/g;

export function parseSize(raw: string | null | undefined): ParsedSize | null {
  if (!raw) return null;

  const text = raw.toLowerCase().replace(/,/g, ".").trim();

  const multi = new RegExp(
    `(\\d+)\\s*[x×]\\s*(\\d+(?:\\.\\d+)?)\\s*(${UNIT_PATTERN})\\b`,
  ).exec(text);
  if (multi) {
    const count = Number(multi[1]);
    const each = Number(multi[2]);
    const spec = UNIT_FACTORS[multi[3]];
    return {
      value: Math.round(count * each * spec.factor),
      unit: spec.unit,
      multipack: count,
    };
  }

  const single = new RegExp(`(\\d+(?:\\.\\d+)?)\\s*(${UNIT_PATTERN})\\b`).exec(
    text,
  );
  if (single) {
    const spec = UNIT_FACTORS[single[2]];
    return {
      value: Math.round(Number(single[1]) * spec.factor),
      unit: spec.unit,
      multipack: 1,
    };
  }

  return null;
}

export function normalizeBrand(raw: string | null | undefined): string {
  if (!raw) return "";
  return raw
    .normalize("NFD")
    .replace(COMBINING_MARKS, "") // Liégeois -> Liegeois
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

/**
 * The lookup key for the deterministic matching tier. Multipack is part of the
 * key because a six-pack and a single bottle of the same total volume are
 * different products on a shelf, and pricing them against each other is wrong.
 */
export function canonicalKey(
  brand: string | null | undefined,
  size: ParsedSize | null,
): string {
  const b = normalizeBrand(brand) || "nobrand";
  if (!size) return `${b}|nosize|1`;
  return `${b}|${size.value}${size.unit}|${size.multipack}`;
}
