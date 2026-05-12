import { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getRetailerBySlug } from "@/lib/retailers";
import { getCurrentFolder } from "@/lib/folders";
import { AdPlacements } from "@/components/AdPlacements";
import Image from "next/image";
import Link from "next/link";

interface PageProps {
	params: Promise<{ retailer: string; page: string }>;
}

export async function generateMetadata({
	params,
}: PageProps): Promise<Metadata> {
	const { retailer: slug, page } = await params;
	const retailer = getRetailerBySlug(slug);
	if (!retailer) return {};

	return {
		title: `${retailer.name} folder pagina ${page}`,
		description: retailer.description,
		alternates: {
			canonical: `/folders/${slug}/p/${page}`,
		},
		openGraph: {
			title: `${retailer.name} folder pagina ${page} | SuperPromo België`,
			description: retailer.description,
		},
	};
}

export default async function RetailerFolderPage({ params }: PageProps) {
	const { retailer: slug, page } = await params;
	const retailer = getRetailerBySlug(slug);
	if (!retailer) notFound();

	const pageNumber = Number.parseInt(page, 10);
	if (!Number.isFinite(pageNumber) || pageNumber < 1) notFound();

	const currentFolder = await getCurrentFolder(slug);
	if (!currentFolder) notFound();
	if (currentFolder.pages.length === 0) {
		redirect(`/folders/${slug}`);
	}

	if (pageNumber > currentFolder.pages.length) notFound();

	const idx = pageNumber - 1;
	const img = currentFolder.pages[idx];

	const prevHref =
		idx === 0 ? `/folders/${slug}` : `/folders/${slug}/p/${pageNumber - 1}`;
	const nextHref =
		idx >= currentFolder.pages.length - 1
			? null
			: `/folders/${slug}/p/${pageNumber + 1}`;

	return (
		<div className="max-w-6xl mx-auto px-4 py-12">
			<nav className="text-sm text-gray-500 mb-6">
				<Link href="/" className="hover:text-blue-700">
					Home
				</Link>
				<span className="mx-2">›</span>
				<Link href="/folders" className="hover:text-blue-700">
					Folders
				</Link>
				<span className="mx-2">›</span>
				<Link href={`/folders/${slug}`} className="hover:text-blue-700">
					{retailer.name}
				</Link>
				<span className="mx-2">›</span>
				<span className="text-gray-900">Pagina {pageNumber}</span>
			</nav>

			<h1 className="text-3xl font-bold text-gray-900 mb-2">
				{retailer.name} folder pagina {pageNumber}
			</h1>
			<p className="text-gray-600 mb-8">{retailer.description}</p>

			<AdPlacements position="mid" />

			<div className="mt-8 bg-white border border-gray-200 rounded-xl overflow-hidden">
				<div className="relative aspect-3/4 bg-gray-50">
					<Image
						src={img.imageUrl}
						alt={`${retailer.name} folder pagina ${pageNumber}`}
						fill
						className="object-contain"
						priority
						unoptimized
						suppressHydrationWarning
					/>
				</div>

				<div className="flex items-center justify-between px-6 py-4 border-t border-gray-100">
					<Link
						href={prevHref}
						className="text-sm font-medium text-gray-700 hover:text-blue-700 transition"
					>
						Vorige
					</Link>
					<span className="text-sm text-gray-500">
						Pagina {pageNumber} van {currentFolder.pages.length}
					</span>
					{nextHref ? (
						<Link
							href={nextHref}
							className="text-sm font-medium text-gray-700 hover:text-blue-700 transition"
						>
							Volgende
						</Link>
					) : (
						<span className="text-sm font-medium text-gray-300">Volgende</span>
					)}
				</div>
			</div>

			<AdPlacements position="bottom" />
		</div>
	);
}
