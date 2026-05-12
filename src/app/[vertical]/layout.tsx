import { notFound } from "next/navigation";
import { VERTICALS, VERTICAL_CONFIGS, Vertical } from "@/lib/types";

interface LayoutProps {
	children: React.ReactNode;
	params: Promise<{ vertical: string }>;
}

export async function generateStaticParams() {
	return VERTICALS.filter((v) => v !== "general").map((v) => ({ vertical: v }));
}

export default async function VerticalLayout({ children, params }: LayoutProps) {
	const { vertical } = await params;
	if (!VERTICALS.includes(vertical as Vertical) || vertical === "general") {
		notFound();
	}
	return <>{children}</>;
}

export async function generateMetadata({ params }: { params: Promise<{ vertical: string }> }) {
	const { vertical } = await params;
	const config = VERTICAL_CONFIGS[vertical as Vertical];
	if (!config) return {};
	return {
		title: {
			default: `${config.name} - Folders en promoties`,
			template: `%s | ${config.name}`,
		},
		description: config.description,
	};
}
