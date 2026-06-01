import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Contact",
  description: "Neem contact op met SuperPromo België.",
  alternates: {
    canonical: "/contact",
  },
};

export default function ContactPage() {
  const email = process.env.NEXT_PUBLIC_CONTACT_EMAIL;

  return (
    <div className="max-w-3xl mx-auto px-4 py-12">
      <nav className="text-sm text-gray-500 mb-6">
        <Link href="/" className="hover:text-blue-700">
          Home
        </Link>
        <span className="mx-2">›</span>
        <span className="text-gray-900">Contact</span>
      </nav>

      <h1 className="text-3xl font-bold text-gray-900 mb-8">Contact</h1>

      <div className="prose prose-gray max-w-none space-y-6">
        <section>
          <h2 className="text-xl font-bold text-gray-900 mb-3">Facebook-groep</h2>
          <p className="text-gray-600 leading-relaxed">
            Je kunt ons bereiken via onze Facebook-groep:
          </p>
          <p>
            <a
              href="https://www.facebook.com/groups/superpromobelgie"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-700 hover:underline"
            >
              SuperPromo België Facebook-groep
            </a>
          </p>
        </section>

        {email ? (
          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-3">E-mail</h2>
            <p className="text-gray-600 leading-relaxed">
              Je kunt ons ook mailen via{" "}
              <a href={`mailto:${email}`} className="text-blue-700 hover:underline">
                {email}
              </a>
              .
            </p>
          </section>
        ) : null}
      </div>
    </div>
  );
}
