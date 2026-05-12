import { Metadata } from "next";
import { getRetailersForVertical } from "@/lib/retailers";
import {
	JsonLd,
	createBreadcrumbJsonLd,
	createFAQJsonLd,
} from "@/components/JsonLd";
import { FoldersClient } from "@/components/FoldersClient";
import { getSiteBaseUrl } from "@/lib/site";

export const metadata: Metadata = {
	title: "Alle Folders",
	description:
		"Bekijk alle actuele reclamefolders van supermarkten in België. Albert Heijn, Lidl, Delhaize, Colruyt en meer.",
	alternates: {
		canonical: "/folders",
	},
};

export default function FoldersPage() {
	const baseUrl = getSiteBaseUrl();
	const faqItems = [
		{
			question: "Hoe vaak worden de folders bijgewerkt?",
			answer:
				"Elke supermarkt heeft een eigen folderdag. Albert Heijn en Lidl vernieuwen hun folder op maandag, Colruyt op woensdag, en Delhaize op donderdag. Wij updaten alle folders automatisch op de dag van verschijning.",
		},
		{
			question: "Zijn alle folders gratis te bekijken?",
			answer:
				"Ja, alle folders op SuperPromo België zijn 100% gratis te bekijken. Je hebt geen account of registratie nodig.",
		},
		{
			question: "Welke supermarkten staan op SuperPromo België?",
			answer:
				"Momenteel verzamelen we de folders van Albert Heijn, Lidl, Delhaize en Colruyt. We breiden regelmatig uit met nieuwe winkels en discounters zoals Action.",
		},
		{
			question: "Kan ik de folder ook op mijn smartphone bekijken?",
			answer:
				"Ja, onze website is volledig responsive. Je kunt alle folders comfortabel bekijken op je smartphone, tablet of computer. Gebruik de volledig scherm-knop voor de beste ervaring op mobiel.",
		},
	];

	return (
		<div className="max-w-6xl mx-auto px-4 py-12">
			<JsonLd
				data={createBreadcrumbJsonLd([
					{ name: "Home", url: baseUrl },
					{ name: "Folders", url: `${baseUrl}/folders` },
				])}
			/>
			<JsonLd data={createFAQJsonLd(faqItems)} />
			<nav className="text-sm text-gray-500 mb-6">
				<a href="/" className="hover:text-blue-700">
					Home
				</a>
				<span className="mx-2">›</span>
				<span className="text-gray-900">Folders</span>
			</nav>

			<h1 className="text-3xl font-bold text-gray-900 mb-2">
				Alle folders van deze week
			</h1>
			<p className="text-gray-600 mb-10">
				Bekijk de actuele reclamefolders van je favoriete winkels in België.
				Elke week bijgewerkt.
			</p>

			<FoldersClient retailers={getRetailersForVertical("general")} />

			{/* SEO content */}
			<section className="mt-8 mb-12">
				<h2 className="text-xl font-bold text-gray-900 mb-4">
					Reclamefolders online bekijken
				</h2>
				<div className="prose prose-gray max-w-none text-sm leading-relaxed text-gray-600 space-y-3">
					<p>
						Op SuperPromo België vind je elke week de nieuwste reclamefolders
						van de grootste supermarkten en discounters in België. Of je nu op
						zoek bent naar de Albert Heijn Bonusfolder, de Lidl
						weekaanbiedingen, de Delhaize promoties, de Colruyt Laagste Prijzen
						folder of de Action folder — hier vind je ze allemaal op één plek.
					</p>
					<p>
						Elke supermarkt heeft een vaste dag waarop de nieuwe folder
						verschijnt. Albert Heijn en Lidl starten hun folderweek op maandag,
						Colruyt op woensdag en Delhaize op donderdag. Door regelmatig langs
						te komen mis je geen enkele aanbieding.
					</p>
				</div>
			</section>

			{/* FAQ */}
			<section>
				<h2 className="text-xl font-bold text-gray-900 mb-6">
					Veelgestelde vragen over folders
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
