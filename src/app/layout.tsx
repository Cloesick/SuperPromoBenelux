import type { Metadata } from "next";
import "./globals.css";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { JsonLd, createWebsiteJsonLd } from "@/components/JsonLd";
import { CookieConsent } from "@/components/CookieConsent";

export const metadata: Metadata = {
  title: {
    default: "SuperPromo België - Alle folders en promoties",
    template: "%s | SuperPromo België",
  },
  description:
    "Bespaar elke dag op je boodschappen. Bekijk dagelijks de nieuwste folders van je favoriete winkels in België.",
  metadataBase: new URL("https://www.superpromobelgie.be"),
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
    <html lang="nl-BE">
      <body className="min-h-screen flex flex-col">
        <JsonLd data={createWebsiteJsonLd()} />
        <Header />
        <main className="flex-1">{children}</main>
        <Footer />
        <CookieConsent />
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
