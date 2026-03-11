import { Metadata } from "next";
import Link from "next/link";
import { retailers } from "@/lib/retailers";
import { JsonLd, createBreadcrumbJsonLd, createFAQJsonLd } from "@/components/JsonLd";

export const metadata: Metadata = {
  title: "Veelgestelde vragen over supermarkten in België",
  description:
    "Antwoorden op de meest gestelde vragen over Belgische supermarkten: folders, openingsuren, klantenkaarten, prijsvergelijking en meer.",
  alternates: {
    canonical: "/veelgestelde-vragen",
  },
};

const generalFaq = [
  {
    question: "Wat is de goedkoopste supermarkt in België?",
    answer:
      "Colruyt biedt de Laagste Prijzen Garantie: als je hetzelfde product elders goedkoper vindt, past Colruyt de prijs direct aan. Lidl scoort ook sterk op prijs dankzij een beperkt maar scherp geprijsd assortiment. Albert Heijn en Delhaize zijn iets duurder maar bieden regelmatig sterke promoties (Bonus bij AH, 1+1 gratis bij Delhaize). De goedkoopste optie hangt af van je boodschappenmandje — vergelijk de folders elke week op SuperPromo België.",
  },
  {
    question: "Wanneer verschijnen de nieuwe reclamefolders?",
    answer:
      "Elke supermarkt heeft een vaste folderdag: Albert Heijn en Lidl vernieuwen op maandag, Colruyt op woensdag, en Delhaize op donderdag. Op SuperPromo België worden alle folders automatisch bijgewerkt op de dag van verschijning.",
  },
  {
    question: "Hoe kan ik besparen op boodschappen in België?",
    answer:
      "De beste manieren om te besparen: (1) Vergelijk wekelijks de folders van meerdere supermarkten, (2) Gebruik klantenkaarten en apps voor extra korting (AH Bonuskaart, Lidl Plus, Delhaize SuperPlus, Colruyt Xtra), (3) Koop huismerken in plaats van A-merken, (4) Let op 1+1 gratis en 2e halve prijs acties, (5) Plan je boodschappen rond de aanbiedingen in de folder.",
  },
  {
    question: "Welke supermarkten hebben een klantenkaart of spaarprogramma?",
    answer:
      "Alle grote Belgische supermarkten hebben een loyaliteitsprogramma: Albert Heijn heeft de Bonuskaart (gratis) en AH Premium (betaald), Lidl heeft de Lidl Plus-app met digitale kortingsbonnen, Delhaize biedt de SuperPlus-kaart met spaarpunten, en Colruyt heeft de Xtra-kaart. Al deze programma's zijn gratis aan te vragen.",
  },
  {
    question: "Welke supermarkt heeft het grootste assortiment in België?",
    answer:
      "Delhaize heeft het grootste assortiment van alle Belgische supermarkten, met een sterk aanbod in vers, bio en lokale producten. Albert Heijn volgt met een breed assortiment inclusief veel kant-en-klare maaltijden. Lidl en Colruyt hebben een beperkter maar doelgericht assortiment met focus op de meest gevraagde producten.",
  },
  {
    question: "Zijn supermarkten open op zondag in België?",
    answer:
      "Dit verschilt per keten en vestiging. Veel AD Delhaize-winkels zijn op zondag geopend (meestal 9:00–13:00). Sommige Albert Heijn vestigingen zijn ook open op zondag. Lidl en Colruyt zijn in de regel gesloten op zondag. Controleer altijd de openingsuren van je lokale winkel.",
  },
  {
    question: "Wat is het verschil tussen Colruyt en Colruyt Laagste Prijzen?",
    answer:
      "Colruyt Laagste Prijzen is de officiële naam van de supermarktketen die voorheen gewoon 'Colruyt' heette. De naam benadrukt hun kernbelofte: de laagste prijs op elk product. Colruyt Group is het moederbedrijf dat ook OKay, Bio-Planet, Cru en Dreamland omvat.",
  },
  {
    question: "Heeft Lidl een app?",
    answer:
      "Ja, Lidl biedt de Lidl Plus-app aan. Hiermee krijg je toegang tot digitale kortingsbonnen, kraskaarten met extra korting, je digitale kassabon en persoonlijke aanbiedingen. De app is gratis beschikbaar voor iOS en Android.",
  },
  {
    question: "Wat is de Albert Heijn Bonusfolder?",
    answer:
      "De AH Bonusfolder is de wekelijkse reclamefolder van Albert Heijn met alle Bonus-aanbiedingen. Deze verschijnt elke maandag en is geldig tot en met zondag. Bonus-producten zijn herkenbaar aan het gele Bonus-logo en bieden kortingen tot 50%. Je hebt een gratis Bonuskaart nodig om van de korting te profiteren.",
  },
  {
    question: "Hoe werkt de Laagste Prijzen Garantie van Colruyt?",
    answer:
      "Colruyt vergelijkt continu de prijzen van al hun producten met die van andere supermarkten in België (Albert Heijn, Lidl, Delhaize, Aldi, etc.). Als een concurrent goedkoper is, past Colruyt de prijs onmiddellijk aan naar de laagste prijs. Dit geldt voor het volledige assortiment en je hoeft er zelf niets voor te doen.",
  },
  {
    question: "Wat is het verschil tussen Delhaize en AD Delhaize?",
    answer:
      "Delhaize-winkels zijn eigen filialen van de keten. AD Delhaize-winkels zijn zelfstandige ondernemers die onder de Delhaize-vlag werken. Het assortiment en de promoties zijn grotendeels hetzelfde, maar AD Delhaize-winkels kunnen afwijken in openingsuren (vaak ook op zondag open) en hebben soms lokale producten.",
  },
  {
    question: "Welke supermarkt levert aan huis in België?",
    answer:
      "Delhaize en Colruyt bieden thuislevering aan via hun online bestelplatformen. Albert Heijn heeft een beperkte online service in België. Lidl biedt geen thuislevering van boodschappen aan maar verkoopt wel non-food artikelen online. Collect&Go (Colruyt Group) is de populairste ophaalservice.",
  },
];

export default function VeelgesteldeVragenPage() {
  const retailerNames = retailers.map((r) => r.name).join(", ");

  return (
    <div className="max-w-4xl mx-auto px-4 py-12">
      <JsonLd
        data={createBreadcrumbJsonLd([
          { name: "Home", url: "https://www.superpromobelgie.be" },
          { name: "Veelgestelde vragen", url: "https://www.superpromobelgie.be/veelgestelde-vragen" },
        ])}
      />
      <JsonLd data={createFAQJsonLd(generalFaq)} />

      <nav className="text-sm text-gray-500 mb-6">
        <Link href="/" className="hover:text-blue-700">
          Home
        </Link>
        <span className="mx-2">›</span>
        <span className="text-gray-900">Veelgestelde vragen</span>
      </nav>

      <h1 className="text-3xl font-bold text-gray-900 mb-4">
        Veelgestelde vragen over supermarkten in België
      </h1>
      <p className="text-gray-600 mb-10 max-w-2xl">
        Alles wat je wilt weten over {retailerNames} en boodschappen doen in België.
        Van folderdagen en openingsuren tot klantenkaarten en prijsvergelijkingen.
      </p>

      {/* Prijzen & Besparen */}
      <section className="mb-12">
        <h2 className="text-xl font-bold text-gray-900 mb-4">
          Prijzen & besparen
        </h2>
        <div className="space-y-3">
          {generalFaq.filter((_, i) => [0, 2, 9].includes(i)).map((item, i) => (
            <details key={i} className="bg-white border border-gray-200 rounded-lg">
              <summary className="px-6 py-4 cursor-pointer font-medium text-gray-900 hover:text-blue-700">
                {item.question}
              </summary>
              <p className="px-6 pb-4 text-gray-600 text-sm leading-relaxed">{item.answer}</p>
            </details>
          ))}
        </div>
      </section>

      {/* Folders & Promoties */}
      <section className="mb-12">
        <h2 className="text-xl font-bold text-gray-900 mb-4">
          Folders & promoties
        </h2>
        <div className="space-y-3">
          {generalFaq.filter((_, i) => [1, 8].includes(i)).map((item, i) => (
            <details key={i} className="bg-white border border-gray-200 rounded-lg">
              <summary className="px-6 py-4 cursor-pointer font-medium text-gray-900 hover:text-blue-700">
                {item.question}
              </summary>
              <p className="px-6 pb-4 text-gray-600 text-sm leading-relaxed">{item.answer}</p>
            </details>
          ))}
        </div>
      </section>

      {/* Klantenkaarten & Apps */}
      <section className="mb-12">
        <h2 className="text-xl font-bold text-gray-900 mb-4">
          Klantenkaarten & apps
        </h2>
        <div className="space-y-3">
          {generalFaq.filter((_, i) => [3, 7].includes(i)).map((item, i) => (
            <details key={i} className="bg-white border border-gray-200 rounded-lg">
              <summary className="px-6 py-4 cursor-pointer font-medium text-gray-900 hover:text-blue-700">
                {item.question}
              </summary>
              <p className="px-6 pb-4 text-gray-600 text-sm leading-relaxed">{item.answer}</p>
            </details>
          ))}
        </div>
      </section>

      {/* Assortiment & Services */}
      <section className="mb-12">
        <h2 className="text-xl font-bold text-gray-900 mb-4">
          Assortiment & services
        </h2>
        <div className="space-y-3">
          {generalFaq.filter((_, i) => [4, 5, 6, 10, 11].includes(i)).map((item, i) => (
            <details key={i} className="bg-white border border-gray-200 rounded-lg">
              <summary className="px-6 py-4 cursor-pointer font-medium text-gray-900 hover:text-blue-700">
                {item.question}
              </summary>
              <p className="px-6 pb-4 text-gray-600 text-sm leading-relaxed">{item.answer}</p>
            </details>
          ))}
        </div>
      </section>

      {/* Per-retailer links */}
      <section className="mb-12">
        <h2 className="text-xl font-bold text-gray-900 mb-4">
          Meer over specifieke supermarkten
        </h2>
        <p className="text-gray-600 text-sm mb-4">
          Bekijk de folder en lees meer informatie per supermarkt:
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {retailers.map((r) => (
            <Link
              key={r.slug}
              href={`/folders/${r.slug}`}
              className="flex items-center gap-3 bg-white border border-gray-200 rounded-lg px-4 py-3 hover:border-blue-300 hover:bg-blue-50 transition"
            >
              <span className="font-medium text-gray-900">{r.name}</span>
              <span className="text-xs text-gray-500">Folder elke {r.seo.folderDay}</span>
            </Link>
          ))}
        </div>
      </section>

      {/* SEO content */}
      <section>
        <h2 className="text-xl font-bold text-gray-900 mb-4">
          Supermarkten vergelijken in België
        </h2>
        <div className="prose prose-gray max-w-none text-sm leading-relaxed text-gray-600 space-y-3">
          <p>
            België heeft een gevarieerd supermarktlandschap met ketens die elk hun eigen sterke punten
            hebben. Colruyt is onbetwist de goedkoopste dankzij hun Laagste Prijzen Garantie. Lidl
            biedt een compact assortiment tegen scherpe prijzen met wekelijks wisselende thema-acties.
            Delhaize scoort op kwaliteit en assortimentsbreedte, terwijl Albert Heijn sterk is in
            Bonus-aanbiedingen en een groeiend netwerk heeft in België.
          </p>
          <p>
            Door elke week de reclamefolders te vergelijken op SuperPromo België, kun je strategisch
            boodschappen doen en flink besparen. Combineer de laagste vaste prijzen bij Colruyt met
            de sterkste promoties bij de andere ketens voor maximale besparing.
          </p>
        </div>
      </section>
    </div>
  );
}
