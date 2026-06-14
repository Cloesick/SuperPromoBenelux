import { Metadata } from "next";
import { notFound } from "next/navigation";
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
	type LucideIcon,
} from "lucide-react";
import {
	categories,
	shopsByCategory,
	type ShopCategory,
} from "@/lib/catalog";
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

interface PageProps {
	params: Promise<{ category: string }>;
}

export function generateStaticParams() {
	return categories.map((c) => ({ category: c.key }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
	const { category } = await params;
	const meta = categories.find((c) => c.key === category);
	if (!meta) return {};
	const baseUrl = getSiteBaseUrl();
	const count = shopsByCategory(meta.key).length;
	return {
		title: `${meta.label} folders — ${count} winkels | SuperPromo België`,
		description: `${meta.blurb} Bekijk de folders van ${count} ${meta.label.toLowerCase()} in België en Nederland op één plek.`,
		alternates: { canonical: `/winkels/${meta.key}` },
		openGraph: {
			title: `${meta.label} folders | SuperPromo België`,
			description: meta.blurb,
			url: `${baseUrl}/winkels/${meta.key}`,
			type: "website",
		},
	};
}

export default async function CategoryPage({ params }: PageProps) {
	const { category } = await params;
	const meta = categories.find((c) => c.key === category);
	if (!meta) notFound();

	const shops = shopsByCategory(meta.key);
	const liveCount = shops.filter((s) => s.live).length;
	const Icon = ICONS[meta.key];
	const others = categories.filter((c) => c.key !== meta.key);

	return (
		<div className="mx-auto max-w-6xl px-4 py-12">
			<nav className="mb-6 text-sm text-gray-500">
				<Link href="/" className="hover:text-blue-700">
					Home
				</Link>
				<span className="mx-2">›</span>
				<Link href="/winkels" className="hover:text-blue-700">
					Winkels
				</Link>
				<span className="mx-2">›</span>
				<span className="text-gray-900">{meta.label}</span>
			</nav>

			<header className="mb-8 flex items-start gap-4">
				<div className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-blue-50 text-blue-700">
					<Icon className="h-7 w-7" suppressHydrationWarning />
				</div>
				<div>
					<h1 className="text-3xl font-bold text-gray-900">{meta.label} folders</h1>
					<p className="mt-2 max-w-2xl text-gray-600">{meta.blurb}</p>
					<p className="mt-1 text-sm text-gray-400">
						{shops.length} winkels
						{liveCount > 0 ? ` — ${liveCount} nu beschikbaar` : " — binnenkort beschikbaar"}
					</p>
				</div>
			</header>

			<div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
				{shops.map((shop) => (
					<ShopTile key={shop.slug} shop={shop} />
				))}
			</div>

			{/* Other categories */}
			<section className="mt-14 border-t border-gray-100 pt-8">
				<h2 className="mb-4 text-lg font-bold text-gray-900">Andere categorieën</h2>
				<div className="flex flex-wrap gap-2">
					{others.map((c) => {
						const OtherIcon = ICONS[c.key];
						return (
							<Link
								key={c.key}
								href={`/winkels/${c.key}`}
								className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 transition hover:border-blue-300 hover:bg-blue-50"
							>
								<OtherIcon className="h-4 w-4 text-gray-500" suppressHydrationWarning />
								{c.label}
							</Link>
						);
					})}
				</div>
			</section>
		</div>
	);
}
