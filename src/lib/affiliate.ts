/**
 * Affiliate link management.
 *
 * Supports multiple affiliate networks (Daisycon, TradeTracker, Awin, direct).
 * Configure per-retailer affiliate URLs via environment variables or the
 * config below.  When an env var is set it takes precedence over the
 * hard-coded fallback so you can rotate links without redeploying.
 */

export type AffiliateNetwork =
  | "daisycon"
  | "tradetracker"
  | "awin"
  | "tradedoubler"
  | "direct"
  | "none";

export interface AffiliateConfig {
  retailerSlug: string;
  network: AffiliateNetwork;
  baseUrl: string;
  trackingId?: string;
  envKey: string;
}

const affiliateConfigs: AffiliateConfig[] = [
  {
    retailerSlug: "albert-heijn",
    network: "none",
    baseUrl: "https://www.ah.be/bonus",
    envKey: "AFFILIATE_AH",
  },
  {
    retailerSlug: "lidl",
    network: "none",
    baseUrl: "https://www.lidl.be/nl/aanbiedingen",
    envKey: "AFFILIATE_LIDL",
  },
  {
    retailerSlug: "delhaize",
    network: "none",
    baseUrl: "https://www.delhaize.be/nl/promoties",
    envKey: "AFFILIATE_DELHAIZE",
  },
  {
    retailerSlug: "colruyt",
    network: "none",
    baseUrl: "https://www.colruyt.be/nl/promoties",
    envKey: "AFFILIATE_COLRUYT",
  },
  {
    retailerSlug: "aldi",
    network: "none",
    baseUrl: "https://www.aldi.be/nl/onze-folders.html",
    envKey: "AFFILIATE_ALDI",
  },
  {
    retailerSlug: "action",
    network: "none",
    baseUrl: "https://www.action.com/nl-be/folder/",
    envKey: "AFFILIATE_ACTION",
  },
];

/**
 * Returns the affiliate (or direct) link for a retailer.
 * Priority: env var → config baseUrl.
 */
export function getAffiliateUrl(retailerSlug: string): string {
  const config = affiliateConfigs.find((c) => c.retailerSlug === retailerSlug);
  if (!config) return "#";

  const envValue = process.env[config.envKey];
  if (envValue) return envValue;

  return config.baseUrl;
}

/**
 * Wraps any URL with the appropriate affiliate tracking if configured.
 * Falls back to the raw URL when no tracking is set up.
 */
export function wrapAffiliateLink(
  retailerSlug: string,
  rawUrl: string
): string {
  const config = affiliateConfigs.find((c) => c.retailerSlug === retailerSlug);
  if (!config || config.network === "none") return rawUrl;

  if (config.trackingId) {
    const separator = rawUrl.includes("?") ? "&" : "?";
    return `${rawUrl}${separator}ref=${config.trackingId}`;
  }

  return rawUrl;
}

/**
 * Returns all configured affiliate configs (useful for admin/debug).
 */
export function getAllAffiliateConfigs(): AffiliateConfig[] {
  return affiliateConfigs;
}
