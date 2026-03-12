import type { UtmAttribution } from "@/lib/eventsDb";

export function parseAttributionCookie(raw: string | undefined): UtmAttribution | null {
  if (!raw) return null;

  try {
    const decoded = decodeURIComponent(raw);
    const parsed = JSON.parse(decoded) as Record<string, unknown>;

    const out: UtmAttribution = {};
    for (const k of ["utm_source", "utm_medium", "utm_campaign", "utm_content"] as const) {
      const v = parsed[k];
      if (typeof v === "string" && v.length > 0) {
        out[k] = v;
      }
    }

    return Object.keys(out).length > 0 ? out : null;
  } catch {
    return null;
  }
}
