import { Metadata } from "next";
import { notFound } from "next/navigation";
import { retailers, getRetailerBySlug } from "@/lib/retailers";
import { getCurrentFolder } from "@/lib/folders";
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

function getIsoWeek(date: Date): { week: number; year: number } {
	const d = new Date(date);
	d.setHours(0, 0, 0, 0);
	d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7));
	const week1 = new Date(d.getFullYear(), 0, 4);
	week1.setHours(0, 0, 0, 0);
	const week =
		1 +
		Math.round(
			((d.getTime() - week1.getTime()) / 86400000 - 3 + ((week1.getDay() + 6) % 7)) /
				7,
		);
	return { week, year: d.getFullYear() };
}

export const dynamic = "force-dynamic";
export const revalidate = 0;

interface PageProps {
	params: Promise<{ retailer: string }>;
}

export async function generateStaticParams() {
	return retailers.map((r) => ({ retailer: r.slug }));
}

export async function generateMetadata({
	params,
}: PageProps): Promise<Metadata> {
	const { retailer: slug } = await params;
	const retailer = getRetailerBySlug(slug);
	if (!retailer) return {};

	const currentFolder = getCurrentFolder(slug);
	const baseUrl = getSiteBaseUrl();

	const range = (() => {
		if (!currentFolder) return null;
		try {
			const from = new Date(currentFolder.validFrom);
			const until = new Date(currentFolder.validUntil);
			const fromStr = from.toLocaleDateString("nl-BE", {
				day: "numeric",
				month: "short",
				year: "numeric",
			});
			const untilStr = until.toLocaleDateString("nl-BE", {
				day: "numeric",
				month: "short",
				year: "numeric",
			});
			return { from, until, fromStr, untilStr };
		} catch {
			return null;
		}
	})();

	const weekInfo = (() => {
		if (!range) return null;
		try {
			return getIsoWeek(range.from);
		} catch {
			return null;
		}
	})();

	const description = (() => {
		if (!range || !weekInfo) return retailer.description;
		return `${retailer.name} folder week ${weekInfo.week} (${range.fromStr}–${range.untilStr}) — bekijk alle aanbiedingen gratis.`;
	})();

	const ogImage = (() => {
		if (!currentFolder) return new URL(retailer.logo, baseUrl).toString();
		const candidate =
			currentFolder.pages?.[0]?.imageUrl || currentFolder.thumbnailUrl || retailer.logo;
		try {
			return new URL(candidate, baseUrl).toString();
		} catch {
			return new URL(retailer.logo, baseUrl).toString();
		}
	})();

	return {
		title: `${retailer.name} folder deze week`,
		description,
		alternates: {
			canonical: `/folders/${slug}`,
		},
		openGraph: {
			title: `${retailer.name} folder deze week | SuperPromo België`,
			description,
			images: [
				{
					url: ogImage,
					alt: `${retailer.name} folder`,
				},
			],
		},
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
	const relatedRetailers = (() => {
		const others = retailers.filter((r) => r.slug !== slug);
		const sameCategory = others
			.filter((r) => r.category === retailer.category)
			.sort((a, b) => a.name.localeCompare(b.name, "nl"));
		const otherCategory = others
			.filter((r) => r.category !== retailer.category)
			.sort((a, b) => a.name.localeCompare(b.name, "nl"));
		return [...sameCategory, ...otherCategory].slice(0, 6);
	})();

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
				data={createRetailerFolderJsonLd(
					retailer.name,
					slug,
					currentFolder?.validFrom,
					currentFolder?.validUntil,
				)}
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

			{/* Actions */}
			<div className="flex flex-col sm:flex-row gap-4 mb-8">
				<a
					href={outboundUrl}
					target="_blank"
					rel="noopener noreferrer sponsored"
					className="inline-flex items-center justify-center gap-2 bg-gray-100 hover:bg-gray-200 text-gray-800 font-medium px-6 py-3 rounded-lg transition"
				>
					<ExternalLink className="w-4 h-4" suppressHydrationWarning />
					Bekijk promoties bij {retailer.name}
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

			<div className="mt-12">
				<h2 className="text-xl font-bold text-gray-900 mb-4">Bekijk ook</h2>
				<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
					{relatedRetailers.map((r) => (
						<Link
							key={r.slug}
							href={`/folders/${r.slug}`}
							className="flex items-center justify-between gap-3 bg-white border border-gray-200 rounded-lg px-4 py-3 hover:border-blue-300 hover:bg-blue-50 transition"
						>
							<span className="font-medium text-gray-900">{r.name}</span>
							<span className="text-xs text-gray-500">Folder: {r.seo.folderDay}</span>
						</Link>
					))}
				</div>
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
