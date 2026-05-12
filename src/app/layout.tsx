import type { Metadata } from "next";
import "./globals.css";
import { JsonLd, createWebsiteJsonLd } from "@/components/JsonLd";
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
				{children}
			</body>
		</html>
	);
}
