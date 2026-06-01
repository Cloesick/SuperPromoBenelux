import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { nlBorderRetailers } from "@/lib/retailers";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
	title: "Nederlandse grensstreek folders | SuperPromoBelgië",
	description:
		"Supermarkt folders geldig in de Nederlandse grensstreek, interessant voor Belgen vlakbij de grens.",
	robots: { index: false, follow: false },
	alternates: {
		canonical: "/nl-grensstreek",
	},
};

export default function NlBorderLandingPage() {
	return (
		<div className="max-w-6xl mx-auto px-4 py-12">
			<nav className="text-sm text-gray-500 mb-6">
				<Link href="/" className="hover:text-blue-700">
					Home
				</Link>
				<span className="mx-2">›</span>
				<span className="text-gray-900">NL grensstreek</span>
			</nav>

			<h1 className="text-3xl font-bold text-gray-900 mb-2">NL grensstreek</h1>
			<p className="text-gray-600 mb-4">
				Woon je vlakbij de Nederlandse grens? Bekijk hier de folders van Nederlandse supermarkten zoals Albert Heijn, Lidl en Aldi. 
				Deze aanbiedingen zijn relevant voor Belgische shoppers die in de grensstreek wonen en graag profiteren van Nederlandse promoties.
			</p>
			<p className="text-gray-600 mb-10">
				Alle folders worden wekelijks bijgewerkt zodat je altijd de nieuwste aanbiedingen ziet.
			</p>

			<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
				{nlBorderRetailers.map((retailer) => {
					const isSvgLogo = retailer.logo.toLowerCase().endsWith(".webp");

					return (
						<Link
							key={retailer.slug}
							href={`/nl-grensstreek/${retailer.slug}`}
							className="group block bg-white rounded-xl border border-gray-200 hover:border-blue-300 hover:shadow-lg transition-all duration-200 overflow-hidden"
						>
							<div
								className="h-2 w-full"
								style={{ backgroundColor: retailer.color }}
							/>
							<div className="p-6">
								<div className="flex items-center gap-3 mb-3">
									{isSvgLogo ? (
										<Image
											src={retailer.logo}
											alt={`${retailer.name} logo`}
											width={48}
											height={48}
											className="w-12 h-12 rounded-lg object-cover"
											unoptimized
										/>
									) : (
										<Image
											src={retailer.logo}
											alt={`${retailer.name} logo`}
											width={48}
											height={48}
											className="w-12 h-12 rounded-lg object-cover"
										/>
									)}
									<div>
										<h3 className="font-bold text-gray-900 group-hover:text-blue-700 transition">
											{retailer.name}
										</h3>
										<p className="text-sm text-gray-500">{retailer.category}</p>
									</div>
								</div>
								<p className="text-sm text-gray-600 leading-relaxed">
									{retailer.description}
								</p>
							</div>
						</Link>
					);
				})}
			</div>
		</div>
	);
}
