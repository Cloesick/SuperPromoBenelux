import Link from "next/link";
import Image from "next/image";
import { ShoppingBag, FileText } from "lucide-react";
import { Retailer } from "@/lib/types";
import type { FolderPreview } from "@/lib/folders";

interface RetailerCardProps {
	retailer: Retailer;
	folderCount?: number;
	/**
	 * This week's leaflet, when there is one.
	 *
	 * Without it the card is a logo and a generic sentence, which asks a visitor
	 * to click on faith — on a site whose entire product is the leaflet. The
	 * cover is the single most informative thing we can put here.
	 */
	preview?: FolderPreview;
}

/** "3 aug" — short enough for a card, unambiguous in a weekly context. */
function shortDate(iso?: string): string | null {
	if (!iso) return null;
	const d = new Date(iso);
	if (Number.isNaN(d.getTime())) return null;
	return d.toLocaleDateString("nl-BE", { day: "numeric", month: "short" });
}

export function RetailerCard({ retailer, folderCount, preview }: RetailerCardProps) {
	const isSvgLogo = retailer.logo.toLowerCase().endsWith(".webp");
	const cover = preview?.coverUrl;
	const from = shortDate(preview?.validFrom);
	const until = shortDate(preview?.validUntil);

	return (
		<Link
			href={`/folders/${retailer.slug}`}
			className="group flex h-full flex-col overflow-hidden rounded-xl border border-gray-200 bg-white transition-all duration-200 hover:border-blue-300 hover:shadow-lg"
		>
			<div className="h-2 w-full" style={{ backgroundColor: retailer.color }} />

			{cover && (
				// Covers arrive in wildly different shapes: a Colruyt spread is
				// 1800x1125 (landscape, ratio 0.63) while an Alvo page is 1800x2546
				// (portrait, 1.41). A tall 3:4 box suits neither — object-cover cropped
				// the landscape ones to a strip of their middle, and object-contain
				// left half the card empty.
				//
				// A shallow 4:3 box filled from the top works for both: landscape
				// covers fill it almost exactly, and portrait ones show their top
				// half — which is where a leaflet puts its branding and hero offer.
				<div className="relative aspect-[4/3] w-full overflow-hidden bg-gray-50">
					<Image
						src={cover}
						alt={`Voorpagina van de ${retailer.name} folder`}
						fill
						// Covers come from blob storage at full page width; the card shows
						// them at roughly a quarter of the viewport on desktop.
						sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
						className="object-cover object-top transition-transform duration-300 group-hover:scale-[1.03]"
						unoptimized
					/>
					{preview && preview.pageCount > 0 && (
						<span className="absolute right-2 top-2 inline-flex items-center gap-1 rounded-full bg-black/70 px-2 py-1 text-xs font-medium text-white backdrop-blur-sm">
							<FileText className="h-3 w-3" />
							{preview.pageCount}
						</span>
					)}
					{preview?.expired && (
						// Say so on the card rather than letting someone open a folder of
						// last week's prices expecting this week's.
						<span className="absolute left-2 top-2 rounded-full bg-amber-500 px-2 py-1 text-xs font-medium text-white">
							Verlopen
						</span>
					)}
				</div>
			)}

			<div className="flex flex-1 flex-col p-5">
				<div className="mb-3 flex items-center gap-3">
					<Image
						src={retailer.logo}
						alt={`${retailer.name} logo`}
						width={40}
						height={40}
						className="h-10 w-10 shrink-0 rounded-lg object-cover"
						{...(isSvgLogo ? { unoptimized: true } : {})}
					/>
					<div className="min-w-0">
						<h3 className="truncate font-bold text-gray-900 transition group-hover:text-blue-700">
							{retailer.name}
						</h3>
						{from && until ? (
							<p className="text-sm text-gray-500">
								{from} – {until}
							</p>
						) : (
							<p className="text-sm text-gray-500">{retailer.category}</p>
						)}
					</div>
				</div>

				{/* With a cover present the description is redundant — the leaflet says
				    more than the sentence does. Keep it only when there is no cover. */}
				{!cover && (
					<p className="mb-4 text-sm leading-relaxed text-gray-600">
						{retailer.description}
					</p>
				)}

				<div className="mt-auto flex items-center justify-between pt-2">
					<span className="inline-flex items-center gap-1.5 text-sm font-medium text-blue-700">
						<ShoppingBag className="h-4 w-4" />
						Bekijk folder
					</span>
					{folderCount !== undefined && folderCount > 0 && (
						<span className="rounded-full bg-blue-50 px-2 py-1 text-xs text-blue-700">
							{folderCount} {folderCount === 1 ? "folder" : "folders"}
						</span>
					)}
				</div>
			</div>
		</Link>
	);
}
