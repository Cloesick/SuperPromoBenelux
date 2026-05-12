import { notFound } from "next/navigation";
import { VERTICALS, VERTICAL_CONFIGS, Vertical } from "@/lib/types";
import { VerticalThemeProvider } from "@/components/VerticalThemeProvider";
import { VerticalHeader } from "@/components/VerticalHeader";
import { VerticalFooter } from "@/components/VerticalFooter";
import { CookieConsent } from "@/components/CookieConsent";
import { AnalyticsGate } from "@/components/AnalyticsGate";

interface LayoutProps {
	children: React.ReactNode;
	params: Promise<{ vertical: string }>;
}

export async function generateStaticParams() {
	return VERTICALS.filter((v) => v !== "general").map((v) => ({ vertical: v }));
}

export default async function VerticalLayout({
	children,
	params,
}: LayoutProps) {
	const { vertical } = await params;
	if (!VERTICALS.includes(vertical as Vertical) || vertical === "general") {
		notFound();
	}
	const config = VERTICAL_CONFIGS[vertical as Vertical];

	return (
		<VerticalThemeProvider config={config}>
			<VerticalHeader />
			<main className="flex-1">{children}</main>
			<VerticalFooter />
			<CookieConsent />
			<AnalyticsGate />
		</VerticalThemeProvider>
	);
}

export async function generateMetadata({
	params,
}: {
	params: Promise<{ vertical: string }>;
}) {
	const { vertical } = await params;
	const config = VERTICAL_CONFIGS[vertical as Vertical];
	if (!config) return {};
	return {
		title: {
			default: `${config.name} - Folders en promoties`,
			template: `%s | ${config.name}`,
		},
		description: `${config.tagline}. Bekijk de nieuwste folders en promoties.`,
	};
}
