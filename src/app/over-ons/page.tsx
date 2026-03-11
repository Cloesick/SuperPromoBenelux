import { Metadata } from "next";
import Link from "next/link";
import { JsonLd, createBreadcrumbJsonLd } from "@/components/JsonLd";

export const metadata: Metadata = {
  title: "Over Ons",
  description:
    "Leer meer over SuperPromo België. Onze missie is jou voorzien van de beste kortingen en deals in België.",
  alternates: {
    canonical: "/over-ons",
  },
};

export default function OverOnsPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-12">
      <JsonLd
        data={createBreadcrumbJsonLd([
          { name: "Home", url: "https://www.superpromobelgie.be" },
          { name: "Over Ons", url: "https://www.superpromobelgie.be/over-ons" },
        ])}
      />
      <nav className="text-sm text-gray-500 mb-6">
        <Link href="/" className="hover:text-blue-700">
          Home
        </Link>
        <span className="mx-2">›</span>
        <span className="text-gray-900">Over Ons</span>
      </nav>

      <h1 className="text-3xl font-bold text-gray-900 mb-8">Over SuperPromo België</h1>

      <div className="prose prose-gray max-w-none space-y-6">
        <section>
          <h2 className="text-xl font-bold text-gray-900 mb-3">Onze Missie</h2>
          <p className="text-gray-600 leading-relaxed">
            Onze missie is simpel: jou voorzien van de beste kortingen en deals die beschikbaar zijn
            op de Belgische markt. Wij geloven dat iedereen de kans moet hebben om te besparen op
            aankopen, en wij zijn hier om dat mogelijk te maken.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold text-gray-900 mb-3">Wat Wij Doen</h2>
          <p className="text-gray-600 leading-relaxed">
            Bij SuperPromo België verzamelen we dagelijks de nieuwste reclamefolders, promoties en
            aanbiedingen van een breed scala aan winkels en merken. Van supermarkten tot
            elektronicazaken — wij bundelen alles op één plek.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold text-gray-900 mb-3">Waarom SuperPromo?</h2>
          <ul className="space-y-3">
            <li className="flex gap-3 text-gray-600">
              <span className="text-blue-700 font-bold">•</span>
              <span>
                <strong>Altijd actueel:</strong> Folders worden elke week automatisch bijgewerkt.
              </span>
            </li>
            <li className="flex gap-3 text-gray-600">
              <span className="text-blue-700 font-bold">•</span>
              <span>
                <strong>Breed assortiment:</strong> Supermarkten, warenhuizen, elektronica en meer.
              </span>
            </li>
            <li className="flex gap-3 text-gray-600">
              <span className="text-blue-700 font-bold">•</span>
              <span>
                <strong>Gebruiksvriendelijk:</strong> Eenvoudig navigeren en snel de beste deals
                vinden.
              </span>
            </li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-bold text-gray-900 mb-3">Contact</h2>
          <p className="text-gray-600 leading-relaxed">
            Heb je vragen, suggesties of feedback? We horen graag van je! Neem contact met ons op
            via{" "}
            <Link href="/contact" className="text-blue-700 hover:underline">
              ons contactformulier
            </Link>
            .
          </p>
        </section>
      </div>
    </div>
  );
}
