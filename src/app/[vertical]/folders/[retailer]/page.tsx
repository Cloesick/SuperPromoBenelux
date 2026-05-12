import { notFound } from "next/navigation";
import { VERTICALS, VERTICAL_CONFIGS, Vertical } from "@/lib/types";
import { getRetailerBySlugForVertical, getRetailersForVertical } from "@/lib/retailers";
import { getCurrentFolder } from "@/lib/folders";
import { FolderViewer } from "@/components/FolderViewer";
import { JsonLd, createBreadcrumbJsonLd } from "@/components/JsonLd";
import { getSiteBaseUrl } from "@/lib/site";
import Image from "next/image";
import Link from "next/link";
import { Metadata } from "next";

export const dynamic = "force-dynamic";
export const revalidate = 0;

interface PageProps {
	params: Promise<{ vertical: string; retailer: string }>;
}

export async function generateStaticParams() {
	const params: { vertical: string; retailer: string }[] = [];
	for (const v of VERTICALS.filter((x) => x !== "general")) {
		for (const r of getRetailersForVertical(v)) {
			params.push({ vertical: v, retailer: r.slug });
		}
	}
	return params;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
	const { vertical, retailer: slug } = await params;
	const retailer = getRetailerBySlugForVertical(slug, vertical as Vertical);
	if (!retailer) return {};
	const config = VERTICAL_CONFIGS[vertical as Vertical];
	return {
		title: `${retailer.name} folder deze week`,
		description: retailer.description,
		alternates: { canonical: `/${vertical}/folders/${slug}` },
		openGraph: {
			title: `${retailer.name} folder deze week | ${config.name}`,
			description: retailer.description,
		},
	};
}

export default async function VerticalRetailerPage({ params }: PageProps) {
	const { vertical, retailer: slug } = await params;
	const retailer = getRetailerBySlugForVertical(slug, vertical as Vertical);
	if (!retailer) notFound();

	const config = VERTICAL_CONFIGS[vertical as Vertical];
	const folder = getCurrentFolder(slug);
	const baseUrl = getSiteBaseUrl();
	const isSvgLogo = retailer!.logo.toLowerCase().endsWith(".svg");

	return (
		<div className="max-w-6xl mx-auto px-4 py-8">
			<JsonLd
				data={createBreadcrumbJsonLd([
					{ name: "Home", url: baseUrl },
					{ name: config.name, url: `${baseUrl}/${vertical}` },
					{ name: "Folders", url: `${baseUrl}/${vertical}/folders` },
					{ name: retailer!.name, url: `${baseUrl}/${vertical}/folders/${slug}` },
				])}
			/>

			<nav className="text-sm text-gray-500 mb-6">
				<a href="/" className="hover:text-blue-700">Home</a>
				<span className="mx-2">&rsaquo;</span>
				<a href={`/${vertical}`} className="hover:text-blue-700">{config.name}</a>
				<span className="mx-2">&rsaquo;</span>
				<Link href={`/${vertical}/folders`} className="hover:text-blue-700">Folders</Link>
				<span className="mx-2">&rsaquo;</span>
				<span className="text-gray-900">{retailer!.name}</span>
			</nav>

			<div className="flex items-center gap-4 mb-6">
				<Image
					src={retailer!.logo}
					alt={`${retailer!.name} logo`}
					width={56}
					height={56}
					className="w-14 h-14 rounded-lg object-cover"
					unoptimized={isSvgLogo}
				/>
				<div>
					<h1 className="text-2xl font-bold text-gray-900">
						{retailer!.name} folder
					</h1>
					<p className="text-gray-600 text-sm">{retailer!.description}</p>
				</div>
			</div>

			{folder ? (
				<FolderViewer folder={folder} retailer={retailer!} />
			) : (
				<div className="bg-gray-50 border border-gray-200 rounded-xl p-8 text-center">
					<p className="text-gray-600">
						Er is momenteel geen actieve folder beschikbaar voor {retailer!.name}.
					</p>
					<a
						href={retailer!.website}
						target="_blank"
						rel="noopener noreferrer"
						className="inline-block mt-4 text-blue-700 hover:underline"
					>
						Bezoek de website van {retailer!.name} &rarr;
					</a>
				</div>
			)}
		</div>
	);
}
