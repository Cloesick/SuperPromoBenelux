import { getRetailersForVertical } from "@/lib/retailers";
import { VERTICALS, VERTICAL_CONFIGS } from "@/lib/types";
import { RetailerCard } from "@/components/RetailerCard";
import { Facebook, TrendingDown, Bell, Zap } from "lucide-react";
import Link from "next/link";

const retailers = getRetailersForVertical("general");

export default function HomePage() {
	return (
		<>
			{/* Hero */}
			<section className="bg-linear-to-br from-blue-700 via-blue-800 to-blue-900 text-white">
				<div className="max-w-6xl mx-auto px-4 py-20 text-center">
					<h1 className="text-4xl md:text-5xl font-extrabold mb-4 leading-tight">
						Alle folders en promoties
						<br />
						<span className="text-amber-400">van je favoriete winkels</span>
					</h1>
					<p className="text-lg md:text-xl text-blue-100 max-w-2xl mx-auto mb-8">
						Bespaar elke dag op je boodschappen. Bekijk de nieuwste
						reclamefolders van Albert Heijn, Lidl, Delhaize, Colruyt en meer.
					</p>
					<div className="flex flex-col sm:flex-row gap-4 justify-center">
						<Link
							href="/folders"
							className="inline-flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-400 text-gray-900 font-bold px-8 py-3 rounded-lg transition"
						>
							<Zap className="w-5 h-5" />
							Bekijk alle folders
						</Link>
						<a
							href="https://www.facebook.com/groups/superpromobelgie"
							target="_blank"
							rel="noopener noreferrer"
							className="inline-flex items-center justify-center gap-2 bg-white/10 hover:bg-white/20 text-white font-semibold px-8 py-3 rounded-lg border border-white/20 transition"
						>
							<Facebook className="w-5 h-5" />
							Facebook Groep
						</a>
					</div>
				</div>
			</section>

			{/* USPs */}
			<section className="max-w-6xl mx-auto px-4 -mt-8">
				<div className="grid grid-cols-1 md:grid-cols-3 gap-6">
					<div className="bg-white rounded-xl shadow-md p-6 flex gap-4 items-start">
						<div className="bg-blue-50 p-3 rounded-lg">
							<TrendingDown className="w-6 h-6 text-blue-700" />
						</div>
						<div>
							<h3 className="font-bold text-gray-900 mb-1">Laagste prijzen</h3>
							<p className="text-sm text-gray-600">
								Vergelijk promoties van alle grote supermarkten op één plek.
							</p>
						</div>
					</div>
					<div className="bg-white rounded-xl shadow-md p-6 flex gap-4 items-start">
						<div className="bg-blue-50 p-3 rounded-lg">
							<Bell className="w-6 h-6 text-blue-700" />
						</div>
						<div>
							<h3 className="font-bold text-gray-900 mb-1">Altijd actueel</h3>
							<p className="text-sm text-gray-600">
								Elke week automatisch de nieuwste folders, direct beschikbaar.
							</p>
						</div>
					</div>
					<div className="bg-white rounded-xl shadow-md p-6 flex gap-4 items-start">
						<div className="bg-blue-50 p-3 rounded-lg">
							<Facebook className="w-6 h-6 text-blue-700" />
						</div>
						<div>
							<h3 className="font-bold text-gray-900 mb-1">Community</h3>
							<p className="text-sm text-gray-600">
								Sluit je aan bij duizenden Belgische spaarders in onze
								Facebook-groep.
							</p>
						</div>
					</div>
				</div>
			</section>

			{/* Retailer cards */}
			<section className="max-w-6xl mx-auto px-4 py-16">
				<h2 className="text-2xl font-bold text-gray-900 mb-2">
					Populaire winkels
				</h2>
				<p className="text-gray-600 mb-8">
					Bekijk de actuele folders van de grootste supermarkten in België.
				</p>
				<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
					{retailers.map((retailer) => (
						<RetailerCard key={retailer.slug} retailer={retailer} />
					))}
				</div>
			</section>

			{/* Verticals */}
			<section className="max-w-6xl mx-auto px-4 py-12">
				<h2 className="text-2xl font-bold text-gray-900 mb-2">
					Meer categorieën
				</h2>
				<p className="text-gray-600 mb-8">Ontdek folders per categorie.</p>
				<div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-4">
					{VERTICALS.filter((v) => v !== "general").map((v) => {
						const cfg = VERTICAL_CONFIGS[v];
						return (
							<Link
								key={v}
								href={`/${v}`}
								className="block rounded-xl border border-gray-200 hover:border-blue-300 hover:shadow-md transition p-4 text-center"
							>
								<div
									className="w-10 h-10 rounded-full mx-auto mb-2"
									style={{ backgroundColor: cfg.color + "22" }}
								/>
								<div className="font-semibold text-sm text-gray-900">
									{cfg.name.replace("SuperPromo", "").trim() || "Supermarkten"}
								</div>
								<div className="text-xs text-gray-500 mt-1">
									{cfg.description}
								</div>
							</Link>
						);
					})}
				</div>
			</section>

			{/* CTA Facebook */}
			<section className="bg-blue-50 border-y border-blue-100">
				<div className="max-w-4xl mx-auto px-4 py-16 text-center">
					<h2 className="text-2xl font-bold text-gray-900 mb-3">
						Mis geen enkele promotie
					</h2>
					<p className="text-gray-600 mb-6 max-w-xl mx-auto">
						Word lid van onze Facebook-groep en ontvang dagelijks de beste
						aanbiedingen. Onze community selecteert de topdeals zodat jij niet
						de volledige folder hoeft door te bladeren.
					</p>
					<a
						href="https://www.facebook.com/groups/superpromobelgie"
						target="_blank"
						rel="noopener noreferrer"
						className="inline-flex items-center gap-2 bg-blue-700 hover:bg-blue-800 text-white font-semibold px-8 py-3 rounded-lg transition"
					>
						<Facebook className="w-5 h-5" />
						Word lid van de groep
					</a>
				</div>
			</section>

			{/* SEO text */}
			<section className="max-w-4xl mx-auto px-4 py-16">
				<h2 className="text-xl font-bold text-gray-900 mb-4">
					Over SuperPromo België
				</h2>
				<div className="prose prose-gray max-w-none text-sm leading-relaxed text-gray-600 space-y-3">
					<p>
						SuperPromo België verzamelt dagelijks de actuele folders,
						reclamefolders en magazines van verschillende winkels in België. Zo
						blijf je op de hoogte van alle kortingen en promoties van je
						favoriete supermarkt, warenhuis, elektronicazaak of
						doe-het-zelfwinkel.
					</p>
					<p>
						Bij ons kun je de nieuwste folders van Albert Heijn, Lidl, Delhaize
						en Colruyt digitaal bekijken. We updaten onze folders elke week
						zodat je altijd de meest recente promoties vindt.
					</p>
				</div>
			</section>
		</>
	);
}
