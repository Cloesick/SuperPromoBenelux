export type RetailVertical = "pet" | "diy" | "supermarket" | "general";

export type SiteConfig = {
	name: string;
	regionLabel?: string;
	domain: string;
	vertical: RetailVertical;
	facebookGroupUrl?: string;
};

function env(name: string): string | undefined {
	return typeof process !== "undefined" ? process.env[name] : undefined;
}

export function getSiteConfig(): SiteConfig {
	const verticalRaw = (
		env("NEXT_PUBLIC_RETAIL_VERTICAL") ?? "supermarket"
	).toLowerCase();
	const vertical: RetailVertical =
		verticalRaw === "pet"
			? "pet"
			: verticalRaw === "diy"
				? "diy"
				: verticalRaw === "supermarket"
					? "supermarket"
					: "general";

	const name = env("NEXT_PUBLIC_SITE_NAME") ?? "SuperPromo";
	const regionLabel = env("NEXT_PUBLIC_SITE_REGION") ?? "België";
	const domain = env("NEXT_PUBLIC_SITE_DOMAIN") ?? "superpromobelgie.com";
	const facebookGroupUrl =
		env("NEXT_PUBLIC_FACEBOOK_GROUP_URL") ??
		"https://www.facebook.com/groups/superpromobelgie";

	return {
		name,
		regionLabel,
		domain,
		vertical,
		facebookGroupUrl,
	};
}

export function getSiteTitle(): string {
	const c = getSiteConfig();
	return c.regionLabel ? `${c.name} ${c.regionLabel}` : c.name;
}

export function getSiteBaseUrl(): string {
	const c = getSiteConfig();
	return `https://${c.domain}`;
}

export function getDefaultMetaDescription(): string {
	const c = getSiteConfig();
	if (c.vertical === "pet") {
		return "Bekijk dagelijks de nieuwste folders en promoties van dierenwinkels en dierenspeciaalzaken in België.";
	}
	if (c.vertical === "diy") {
		return "Bekijk dagelijks de nieuwste folders en promoties van doe-het-zelfzaken en andere winkels in België.";
	}
	if (c.vertical === "supermarket") {
		return "Bespaar elke dag op je boodschappen. Bekijk dagelijks de nieuwste folders van je favoriete winkels in België.";
	}
	return "Bekijk dagelijks de nieuwste folders en promoties van je favoriete winkels in België.";
}

export function getCategoryLabel(category: string): string {
	const labels: Record<string, string> = {
		dierenwinkel: "Dierenwinkels",
		tuin: "Tuin & dier",
		supermarkt: "Supermarkten",
		discounter: "Discounters",
		warenhuis: "Warenhuizen",
		electronica: "Elektronicazaken",
		"doe-het-zelf": "Doe-het-zelf",
		drogist: "Drogisterijen",
		mode: "Mode",
		"vrije-tijd": "Vrije tijd",
	};

	return labels[category] ?? category;
}
