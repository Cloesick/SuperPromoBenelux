import type { Metadata } from "next";
import "./globals.css";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { JsonLd, createWebsiteJsonLd } from "@/components/JsonLd";
import { CookieConsent } from "@/components/CookieConsent";
import { ConsentBridge } from "@/components/ConsentBridge";
import { AnalyticsGate } from "@/components/AnalyticsGate";
import { ClickTracker } from "@/components/ClickTracker";
import { AdSenseGate } from "@/components/AdSenseGate";
import { getSiteBaseUrl } from "@/lib/site";

export const metadata: Metadata = {
	title: {
		default: "SuperPromo België - Alle folders en promoties",
		template: "%s | SuperPromo België",
	},
	description:
		"Bespaar elke dag op je boodschappen. Bekijk dagelijks de nieuwste folders van je favoriete winkels in België.",
	metadataBase: new URL(getSiteBaseUrl()),
	alternates: {
		canonical: "/",
	},
	openGraph: {
		type: "website",
		locale: "nl_BE",
		siteName: "SuperPromo België",
	},
	robots: {
		index: true,
		follow: true,
	},
	verification: {
		// Baked GSC token for superpromobelgie.com; env NEXT_PUBLIC_GSC_VERIFICATION overrides if set.
		google:
			process.env.NEXT_PUBLIC_GSC_VERIFICATION ||
			"M2fnP_ZLlG9tgEx2CHdU_DWbGFl8g5uj3gggRkbLUdI",
	},
};

export default function RootLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	return (
		<html lang="nl-BE" suppressHydrationWarning>
			<body className="min-h-screen flex flex-col" suppressHydrationWarning>
				<JsonLd data={createWebsiteJsonLd()} />
				<Header />
				<main className="flex-1">{children}</main>
				<Footer />
				<ConsentBridge />
				<CookieConsent />
				<AnalyticsGate />
				<ClickTracker />
				<AdSenseGate />
			</body>
		</html>
	);
}
