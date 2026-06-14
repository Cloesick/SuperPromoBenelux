import Link from "next/link";
import { ChevronRight } from "lucide-react";
import type { CatalogShop } from "@/lib/catalog";

function initials(name: string): string {
	const cleaned = name.replace(/[^A-Za-z0-9 &]/g, "").trim();
	const parts = cleaned.split(/[\s&]+/).filter(Boolean);
	if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
	return cleaned.slice(0, 2).toUpperCase();
}

export function ShopTile({ shop }: { shop: CatalogShop }) {
	const inner = (
		<div className="flex items-center gap-3">
			<div
				className="grid h-11 w-11 shrink-0 place-items-center rounded-lg text-sm font-bold text-white shadow-sm"
				style={{ backgroundColor: shop.color }}
			>
				{initials(shop.name)}
			</div>
			<div className="min-w-0">
				<div className="flex items-center gap-1.5">
					<span className="truncate font-semibold text-gray-900">{shop.name}</span>
					<span className="text-xs" aria-hidden>
						{shop.countries.includes("be") ? "🇧🇪" : ""}
						{shop.countries.includes("nl") ? "🇳🇱" : ""}
					</span>
				</div>
				{shop.live ? (
					<span className="text-xs font-medium text-blue-700">Folder bekijken</span>
				) : (
					<span className="text-xs text-gray-400">Binnenkort</span>
				)}
			</div>
			{shop.live && (
				<ChevronRight className="ml-auto h-4 w-4 shrink-0 text-gray-300" suppressHydrationWarning />
			)}
		</div>
	);

	if (shop.live) {
		return (
			<Link
				href={`/folders/${shop.slug}`}
				className="block rounded-xl border border-gray-200 bg-white p-3 transition hover:border-blue-300 hover:bg-blue-50/40 hover:shadow-sm"
			>
				{inner}
			</Link>
		);
	}
	return (
		<div className="rounded-xl border border-gray-100 bg-gray-50/60 p-3 opacity-75">{inner}</div>
	);
}
