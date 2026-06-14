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
import { categories, shopsByCategory, catalogStats, type ShopCategory } from "@/lib/catalog";
import { ShopTile } from "@/components/ShopTile";
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
					Bekijk de wekelijkse folders en promoties van {total}+ winkels in {catCount}{" "}
					categorieën — supermarkten, doe-het-zelf, dierenwinkels, drogisterijen,
					elektronica en meer, voor België en Nederland.
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
						<Link
							key={c.key}
							href={`/winkels/${c.key}`}
							className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 transition hover:border-blue-300 hover:bg-blue-50"
						>
							<Icon className="h-4 w-4 text-gray-500" suppressHydrationWarning />
							{c.label}
						</Link>
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
							<Link
								href={`/winkels/${c.key}`}
								className="group mb-4 flex items-start gap-3"
							>
								<div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-blue-50 text-blue-700">
									<Icon className="h-5 w-5" suppressHydrationWarning />
								</div>
								<div>
									<h2 className="flex items-center gap-1 text-xl font-bold text-gray-900 group-hover:text-blue-700">
										{c.label}
										<ChevronRight
											className="h-5 w-5 text-gray-300 transition group-hover:translate-x-0.5 group-hover:text-blue-700"
											suppressHydrationWarning
										/>
									</h2>
									<p className="text-sm text-gray-500">{c.blurb}</p>
								</div>
							</Link>
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
