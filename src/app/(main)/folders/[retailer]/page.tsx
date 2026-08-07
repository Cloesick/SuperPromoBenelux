import { Metadata } from "next";
import { notFound } from "next/navigation";
import { getRetailersForVertical, getRetailerBySlug } from "@/lib/retailers";
import { getCurrentFolder } from "@/lib/folders";
import { hasUsableEmbed, hasUsablePdf } from "@/lib/folderRenderability";
import { FolderViewer } from "@/components/FolderViewer";
import {
	JsonLd,
	createRetailerFolderJsonLd,
	createFAQJsonLd,
	createBreadcrumbJsonLd,
} from "@/components/JsonLd";
import { Facebook, ExternalLink } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { getSiteBaseUrl } from "@/lib/site";

export const dynamic = "force-dynamic";
export const revalidate = 0;

interface PageProps {
	params: Promise<{ retailer: string }>;
}

export async function generateStaticParams() {
	return getRetailersForVertical("general").map((r) => ({ retailer: r.slug }));
}

export async function generateMetadata({
	params,
}: PageProps): Promise<Metadata> {
	const { retailer: slug } = await params;
	const retailer = getRetailerBySlug(slug);
	if (!retailer) return {};

	const folder = getCurrentFolder(slug);
	const cover = folder?.pages?.[0]?.imageUrl;
	const renderable =
		hasUsableEmbed(folder?.embedUrl, slug) ||
		hasUsablePdf(folder?.pdfUrl) ||
		(folder?.pages?.length ?? 0) >= 2;

	// The validity range is what makes this page specific rather than an
	// evergreen "folder deze week" that reads identically all year.
	const validity =
		folder?.validFrom && folder?.validUntil
			? ` (${folder.validFrom} t/m ${folder.validUntil})`
			: "";
	const description = folder
		? `Bekijk de ${retailer.name} folder van deze week${validity} en ontdek alle promoties. ${retailer.description}`
		: retailer.description;

	return {
		title: `${retailer.name} folder deze week`,
		description,
		alternates: {
			canonical: `/folders/${slug}`,
		},
		// Keep the sitemap and the page itself telling the same story. The sitemap
		// already omits folders that render nothing; without this, those pages stay
		// indexable through internal links and Google gets exactly the thin content
		// the sitemap was filtered to avoid.
		...(renderable ? {} : { robots: { index: false, follow: true } }),
		openGraph: {
			title: `${retailer.name} folder deze week | SuperPromo België`,
			description,
			type: "article",
			locale: "nl_BE",
			...(folder?.scrapedAt ? { modifiedTime: folder.scrapedAt } : {}),
			...(cover ? { images: [{ url: cover, alt: `${retailer.name} folder` }] } : {}),
		},
		...(cover
			? {
					twitter: {
						card: "summary_large_image" as const,
						title: `${retailer.name} folder deze week`,
						description,
						images: [cover],
					},
				}
			: {}),
	};
}

export default async function RetailerPage({ params }: PageProps) {
	const { retailer: slug } = await params;
	const retailer = getRetailerBySlug(slug);
	const baseUrl = getSiteBaseUrl();

	if (!retailer) {
		notFound();
	}

	const currentFolder = getCurrentFolder(slug);
	const outboundUrl = `/out/${slug}`;

	const isSvgLogo = retailer.logo.toLowerCase().endsWith(".webp");

	const { seo } = retailer;
	const faqItems = [
		{
			question: `Wanneer verschijnt de nieuwe ${retailer.name} folder?`,
			answer: seo.folderDayDetail,
		},
		{
			question: `Hoeveel ${retailer.name} winkels zijn er in België?`,
			answer: `${retailer.name} heeft ${seo.storeCount}.`,
		},
		{
			question: `Wat zijn de openingsuren van ${retailer.name}?`,
			answer: seo.openingHours,
		},
		{
			question: `Is ${retailer.name} goedkoop?`,
			answer: seo.pricePositioning,
		},
		{
			question: `Heeft ${retailer.name} een klantenkaart of loyaliteitsprogramma?`,
			answer: seo.loyalty,
		},
		...(seo.appName
			? [
					{
						question: `Heeft ${retailer.name} een app?`,
						answer: `Ja, ${retailer.name} biedt de ${seo.appName} aan. Hiermee kun je de folder digitaal bekijken, boodschappenlijstjes maken en extra kortingen ontvangen.`,
					},
				]
			: []),
		...(seo.priceGuarantee
			? [
					{
						question: `Wat is de laagste prijzen garantie van ${retailer.name}?`,
						answer: seo.priceGuarantee,
					},
				]
			: []),
		{
			question: `Waar kan ik de ${retailer.name} folder online bekijken?`,
			answer: `Op SuperPromo België kun je altijd de actuele ${retailer.name} folder gratis bekijken. We updaten de folder elke ${seo.folderDay} zodat je altijd de nieuwste promoties vindt.`,
		},
	];

	return (
		<div className="max-w-6xl mx-auto px-4 py-12">
			<JsonLd
				data={createRetailerFolderJsonLd(retailer.name, slug, {
					validFrom: currentFolder?.validFrom,
					validUntil: currentFolder?.validUntil,
					scrapedAt: currentFolder?.scrapedAt,
					coverImageUrl: currentFolder?.pages?.[0]?.imageUrl,
					pageCount: currentFolder?.pages?.length,
					retailerWebsite: retailer.website,
				})}
			/>
			<JsonLd data={createFAQJsonLd(faqItems)} />
			<JsonLd
				data={createBreadcrumbJsonLd([
					{ name: "Home", url: baseUrl },
					{ name: "Folders", url: `${baseUrl}/folders` },
					{
						name: `${retailer.name} folder`,
						url: `${baseUrl}/folders/${slug}`,
					},
				])}
			/>
			{/* Breadcrumb */}
			<nav className="text-sm text-gray-500 mb-6">
				<Link href="/" className="hover:text-blue-700">
					Home
				</Link>
				<span className="mx-2">›</span>
				<Link href="/folders" className="hover:text-blue-700">
					Folders
				</Link>
				<span className="mx-2">›</span>
				<span className="text-gray-900">{retailer.name}</span>
			</nav>

			{/* Retailer header */}
			<div className="flex items-center gap-4 mb-8">
				{isSvgLogo ? (
					<Image
						src={retailer.logo}
						alt={`${retailer.name} logo`}
						width={56}
						height={56}
						className="w-14 h-14 rounded-xl object-cover"
						unoptimized
						suppressHydrationWarning
					/>
				) : (
					<Image
						src={retailer.logo}
						alt={`${retailer.name} logo`}
						width={56}
						height={56}
						className="w-14 h-14 rounded-xl object-cover"
						suppressHydrationWarning
					/>
				)}
				<div>
					<h1 className="text-3xl font-bold text-gray-900">
						{retailer.name} folder deze week
					</h1>
					<p className="text-gray-600">{retailer.description}</p>
				</div>
			</div>

			{/* Folder viewer */}
			{currentFolder ? (
				<FolderViewer folder={currentFolder} retailer={retailer} />
			) : (
				<div className="bg-amber-50 border border-amber-200 rounded-xl p-8 text-center mb-8">
					<p className="text-amber-800 font-medium mb-2">
						Er is momenteel geen folder beschikbaar voor {retailer.name}.
					</p>
					<p className="text-amber-700 text-sm">
						Folders worden wekelijks bijgewerkt. Kom later terug of bekijk onze
						Facebook-groep voor de laatste updates.
					</p>
				</div>
			)}

			{/* Actions */}
			<div className="flex flex-col sm:flex-row gap-4 mt-8">
				<a
					href={outboundUrl}
					target="_blank"
					rel="noopener noreferrer sponsored"
					className="inline-flex items-center justify-center gap-2 bg-gray-100 hover:bg-gray-200 text-gray-800 font-medium px-6 py-3 rounded-lg transition"
				>
					<ExternalLink className="w-4 h-4" suppressHydrationWarning />
					Bezoek {retailer.name}
				</a>
				<a
					href="https://www.facebook.com/groups/superpromobelgie"
					target="_blank"
					rel="noopener noreferrer"
					className="inline-flex items-center justify-center gap-2 bg-blue-700 hover:bg-blue-800 text-white font-medium px-6 py-3 rounded-lg transition"
				>
					<Facebook className="w-4 h-4" suppressHydrationWarning />
					Bekijk de beste deals in onze groep
				</a>
			</div>

			{/* FAQ / SEO content */}
			<section className="mt-16">
				<h2 className="text-xl font-bold text-gray-900 mb-6">
					Veelgestelde vragen over {retailer.name}
				</h2>
				<div className="space-y-4">
					{faqItems.map((item, i) => (
						<details
							key={i}
							className="bg-white border border-gray-200 rounded-lg"
						>
							<summary className="px-6 py-4 cursor-pointer font-medium text-gray-900 hover:text-blue-700">
								{item.question}
							</summary>
							<p className="px-6 pb-4 text-gray-600 text-sm">{item.answer}</p>
						</details>
					))}
				</div>
			</section>
		</div>
	);
}
