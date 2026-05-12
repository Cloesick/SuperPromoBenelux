import { VERTICALS, VERTICAL_CONFIGS, Vertical } from "@/lib/types";
import { getRetailersForVertical } from "@/lib/retailers";
import { FoldersClient } from "@/app/folders/FoldersClient";
import { getSiteBaseUrl } from "@/lib/site";
import { JsonLd, createBreadcrumbJsonLd } from "@/components/JsonLd";

interface PageProps {
	params: Promise<{ vertical: string }>;
}

export async function generateStaticParams() {
	return VERTICALS.filter((v) => v !== "general").map((v) => ({ vertical: v }));
}

export async function generateMetadata({ params }: PageProps) {
	const { vertical } = await params;
	const config = VERTICAL_CONFIGS[vertical as Vertical];
	if (!config) return {};
	return {
		title: `Alle ${config.name} folders`,
		description: `Bekijk alle actuele folders van ${config.description.toLowerCase()}.`,
		alternates: { canonical: `/${vertical}/folders` },
	};
}

export default async function VerticalFoldersPage({ params }: PageProps) {
	const { vertical } = await params;
	const config = VERTICAL_CONFIGS[vertical as Vertical];
	const retailers = getRetailersForVertical(vertical as Vertical);
	const baseUrl = getSiteBaseUrl();

	return (
		<div className="max-w-6xl mx-auto px-4 py-12">
			<JsonLd
				data={createBreadcrumbJsonLd([
					{ name: "Home", url: baseUrl },
					{ name: config.name, url: `${baseUrl}/${vertical}` },
					{ name: "Folders", url: `${baseUrl}/${vertical}/folders` },
				])}
			/>
			<nav className="text-sm text-gray-500 mb-6">
				<a href="/" className="hover:text-blue-700">Home</a>
				<span className="mx-2">&rsaquo;</span>
				<a href={`/${vertical}`} className="hover:text-blue-700">{config.name}</a>
				<span className="mx-2">&rsaquo;</span>
				<span className="text-gray-900">Folders</span>
			</nav>

			<h1 className="text-3xl font-bold text-gray-900 mb-2">
				{config.name} folders van deze week
			</h1>
			<p className="text-gray-600 mb-10">
				Bekijk de actuele folders van {config.description.toLowerCase()}. Elke week bijgewerkt.
			</p>

			<FoldersClient retailers={retailers} basePath={`/${vertical}`} />
		</div>
	);
}
