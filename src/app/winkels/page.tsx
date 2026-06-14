import { Metadata } from "next";
import Link from "next/link";
import {
	ShoppingCart,
	Tag,
	Hammer,
	Sprout,
	PawPrint,
	Sparkles,
	Smartphone,
	Shirt,
	Store,
	Sofa,
	Gamepad2,
	Dumbbell,
	ChevronRight,
	type LucideIcon,
} from "lucide-react";
import {
	categories,
	shopsByCategory,
	catalogStats,
	type CatalogShop,
	type ShopCategory,
} from "@/lib/catalog";
import { getSiteBaseUrl } from "@/lib/site";

export const dynamic = "force-static";

const ICONS: Record<ShopCategory, LucideIcon> = {
	supermarkt: ShoppingCart,
	discounter: Tag,
	"doe-het-zelf": Hammer,
	tuin: Sprout,
	dierenwinkel: PawPrint,
	drogist: Sparkles,
	electronica: Smartphone,
	mode: Shirt,
	warenhuis: Store,
	wonen: Sofa,
	speelgoed: Gamepad2,
	sport: Dumbbell,
};

export function generateMetadata(): Metadata {
	const { total, categories: catCount } = catalogStats();
	const baseUrl = getSiteBaseUrl();
	return {
		title: "Alle winkelfolders | SuperPromo België",
		description: `Bekijk de folders en promoties van ${total}+ winkels in ${catCount} categorieën — supermarkten, doe-het-zelf, dierenwinkels, drogist, elektronica en meer, in België en Nederland.`,
		alternates: { canonical: "/winkels" },
		openGraph: {
			title: "Alle winkelfolders | SuperPromo België",
			description: `${total}+ winkels, ${catCount} categorieën. Folders van België en Nederland op één plek.`,
			url: `${baseUrl}/winkels`,
			type: "website",
		},
	};
}

function initials(name: string): string {
	const cleaned = name.replace(/[^A-Za-z0-9 &]/g, "").trim();
	const parts = cleaned.split(/[\s&]+/).filter(Boolean);
	if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
	return cleaned.slice(0, 2).toUpperCase();
}

function ShopTile({ shop }: { shop: CatalogShop }) {
	const tile = (
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
				{tile}
			</Link>
		);
	}
	return (
		<div className="rounded-xl border border-gray-100 bg-gray-50/60 p-3 opacity-75">{tile}</div>
	);
}

export default function WinkelsPage() {
	const { total, live, categories: catCount } = catalogStats();

	return (
		<div className="mx-auto max-w-6xl px-4 py-12">
			<nav className="mb-6 text-sm text-gray-500">
				<Link href="/" className="hover:text-blue-700">
					Home
				</Link>
				<span className="mx-2">›</span>
				<span className="text-gray-900">Winkels</span>
			</nav>

			<header className="mb-10">
				<h1 className="text-3xl font-bold text-gray-900 sm:text-4xl">
					Alle winkelfolders op één plek
				</h1>
				<p className="mt-3 max-w-2xl text-gray-600">
					Bekijk de wekelijkse folders en promoties van {total}+ winkels in{" "}
					{catCount} categorieën — supermarkten, doe-het-zelf, dierenwinkels,
					drogisterijen, elektronica en meer, voor België en Nederland.
				</p>
				<p className="mt-2 text-sm text-gray-400">
					{live} winkels nu beschikbaar — de rest volgt binnenkort.
				</p>
			</header>

			{/* Category quick-nav */}
			<div className="mb-10 flex flex-wrap gap-2">
				{categories.map((c) => {
					const Icon = ICONS[c.key];
					return (
						<a
							key={c.key}
							href={`#${c.key}`}
							className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 transition hover:border-blue-300 hover:bg-blue-50"
						>
							<Icon className="h-4 w-4 text-gray-500" suppressHydrationWarning />
							{c.label}
						</a>
					);
				})}
			</div>

			{/* Category sections */}
			<div className="space-y-12">
				{categories.map((c) => {
					const shops = shopsByCategory(c.key);
					if (shops.length === 0) return null;
					const Icon = ICONS[c.key];
					return (
						<section key={c.key} id={c.key} className="scroll-mt-24">
							<div className="mb-4 flex items-start gap-3">
								<div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-blue-50 text-blue-700">
									<Icon className="h-5 w-5" suppressHydrationWarning />
								</div>
								<div>
									<h2 className="text-xl font-bold text-gray-900">{c.label}</h2>
									<p className="text-sm text-gray-500">{c.blurb}</p>
								</div>
							</div>
							<div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
								{shops.map((shop) => (
									<ShopTile key={shop.slug} shop={shop} />
								))}
							</div>
						</section>
					);
				})}
			</div>
		</div>
	);
}
