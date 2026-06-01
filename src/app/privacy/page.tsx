import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy",
  description: "Privacybeleid van SuperPromo België.",
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

      <h1 className="text-3xl font-bold text-gray-900 mb-8">Privacybeleid</h1>

      <div className="prose prose-gray max-w-none space-y-6">
        <section>
          <h2 className="text-xl font-bold text-gray-900 mb-3">Wie zijn wij?</h2>
          <p className="text-gray-600 leading-relaxed">
            SuperPromo België is een informatieve website die folders en promoties bundelt. Dit
            privacybeleid legt uit welke gegevens we verwerken en waarom.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold text-gray-900 mb-3">Cookies</h2>
          <p className="text-gray-600 leading-relaxed">
            We gebruiken cookies om de website goed te laten werken en (optioneel) om anonieme
            statistieken te verzamelen.
          </p>
          <ul className="space-y-2">
            <li className="text-gray-600">
              <strong>Noodzakelijke cookies:</strong> nodig voor basisfunctionaliteit (bijvoorbeeld je
              cookievoorkeur).
            </li>
            <li className="text-gray-600">
              <strong>Analytische cookies:</strong> worden alleen geplaatst nadat je hiervoor
              toestemming geeft via de cookiebanner.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-bold text-gray-900 mb-3">Affiliate links</h2>
          <p className="text-gray-600 leading-relaxed">
            Sommige links op deze website zijn affiliate links. Als je via zo&apos;n link een aankoop
            doet, kunnen wij een kleine commissie ontvangen zonder extra kosten voor jou.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold text-gray-900 mb-3">Contact</h2>
          <p className="text-gray-600 leading-relaxed">
            Wil je contact opnemen? Ga naar de{" "}
            <Link href="/contact" className="text-blue-700 hover:underline">
              contactpagina
            </Link>
            .
          </p>
        </section>
      </div>
    </div>
  );
}
