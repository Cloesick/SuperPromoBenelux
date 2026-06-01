import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacybeleid",
  description: "Privacybeleid van superpromobelgie.com - Hoe wij omgaan met uw gegevens.",
  alternates: {
    canonical: "/privacy",
  },
};

export default function PrivacyPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-12">
      <nav className="text-sm text-gray-500 mb-6">
        <Link href="/" className="hover:text-blue-700">
          Home
        </Link>
        <span className="mx-2">›</span>
        <span className="text-gray-900">Privacy</span>
      </nav>

      <h1 className="text-3xl font-bold text-gray-900 mb-4">Privacybeleid</h1>
      <p className="text-sm text-gray-500 mb-8">Laatst bijgewerkt: Juni 2026</p>

      <div className="prose prose-gray max-w-none space-y-6">
        <section>
          <h2 className="text-xl font-bold text-gray-900 mb-3">Welke gegevens verzamelen we?</h2>
          <p className="text-gray-600 leading-relaxed">
            superpromobelgie.com is een informatieve website die folders en promoties van Belgische
            supermarkten bundelt. We verzamelen geen persoonlijke gegevens zoals naam, adres of
            telefoonnummer, tenzij je deze vrijwillig met ons deelt via het contactformulier.
          </p>
          <p className="text-gray-600 leading-relaxed">
            We verzamelen wel automatisch technische gegevens zoals je IP-adres, browsertype en
            paginabezoeken via cookies en analysetools.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold text-gray-900 mb-3">Hoe gebruiken we uw gegevens?</h2>
          <p className="text-gray-600 leading-relaxed">
            De gegevens die we verzamelen gebruiken we uitsluitend om:
          </p>
          <ul className="space-y-2 ml-6 list-disc">
            <li className="text-gray-600">De website te verbeteren en gebruiksvriendelijker te maken</li>
            <li className="text-gray-600">Anonieme statistieken bij te houden over websitebezoek</li>
            <li className="text-gray-600">Relevante advertenties te tonen via Google AdSense</li>
          </ul>
          <p className="text-gray-600 leading-relaxed mt-3">
            <strong>We verkopen uw persoonlijke gegevens nooit aan derden.</strong>
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold text-gray-900 mb-3">Cookies</h2>
          <p className="text-gray-600 leading-relaxed">
            We gebruiken cookies om de website goed te laten werken en om anonieme statistieken te
            verzamelen.
          </p>
          <ul className="space-y-2 ml-6 list-disc">
            <li className="text-gray-600">
              <strong>Noodzakelijke cookies:</strong> Deze zijn nodig voor de basisfunctionaliteit van
              de website (bijvoorbeeld het onthouden van je cookievoorkeur).
            </li>
            <li className="text-gray-600">
              <strong>Analytische cookies:</strong> Deze worden alleen geplaatst nadat je hiervoor
              toestemming geeft via de cookiebanner. Ze helpen ons begrijpen hoe bezoekers de website
              gebruiken.
            </li>
            <li className="text-gray-600">
              <strong>Advertentiecookies:</strong> Deze worden gebruikt door Google AdSense om
              relevante advertenties te tonen.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-bold text-gray-900 mb-3">Google AdSense</h2>
          <p className="text-gray-600 leading-relaxed">
            Deze website gebruikt Google AdSense om advertenties te tonen. Google gebruikt cookies om
            advertenties weer te geven op basis van eerdere bezoeken aan onze website of andere
            websites. Je kunt gepersonaliseerde advertenties uitschakelen door de{" "}
            <a
              href="https://www.google.com/settings/ads"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-700 hover:underline"
            >
              advertentie-instellingen van Google
            </a>{" "}
            te bezoeken.
          </p>
          <p className="text-gray-600 leading-relaxed mt-3">
            Meer informatie over hoe Google gegevens gebruikt vind je in het{" "}
            <a
              href="https://policies.google.com/technologies/partner-sites"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-700 hover:underline"
            >
              privacybeleid van Google
            </a>
            .
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold text-gray-900 mb-3">Contact</h2>
          <p className="text-gray-600 leading-relaxed">
            Heb je vragen over dit privacybeleid? Neem dan contact met ons op via de{" "}
            <Link href="/contact" className="text-blue-700 hover:underline">
              contactpagina
            </Link>{" "}
            of stuur een e-mail naar [EMAIL].
          </p>
        </section>
      </div>
    </div>
  );
}
