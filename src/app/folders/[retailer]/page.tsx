import { Metadata } from "next";
import { notFound } from "next/navigation";
import { retailers, getRetailerBySlug } from "@/lib/retailers";
import { getCurrentFolder } from "@/lib/folders";
import { getAffiliateUrl } from "@/lib/affiliate";
import { FolderViewer } from "@/components/FolderViewer";
import { JsonLd, createRetailerFolderJsonLd, createFAQJsonLd } from "@/components/JsonLd";
import { Facebook, ExternalLink } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

interface PageProps {
  params: Promise<{ retailer: string }>;
}

export async function generateStaticParams() {
  return retailers.map((r) => ({ retailer: r.slug }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { retailer: slug } = await params;
  const retailer = getRetailerBySlug(slug);
  if (!retailer) return {};

  return {
    title: `${retailer.name} folder deze week`,
    description: retailer.description,
    openGraph: {
      title: `${retailer.name} folder deze week | SuperPromo België`,
      description: retailer.description,
    },
  };
}

export default async function RetailerPage({ params }: PageProps) {
  const { retailer: slug } = await params;
  const retailer = getRetailerBySlug(slug);

  if (!retailer) {
    notFound();
  }

  const currentFolder = getCurrentFolder(slug);
  const affiliateUrl = getAffiliateUrl(slug);

  const faqItems = [
    {
      question: `Waar kan ik de ${retailer.name} folder van deze week vinden?`,
      answer: `Op SuperPromo België kun je altijd de actuele ${retailer.name} folder bekijken. We updaten de folders elke week zodat je altijd de nieuwste promoties vindt.`,
    },
    {
      question: `Wanneer verschijnt de nieuwe ${retailer.name} folder?`,
      answer: `De nieuwe ${retailer.name} folder verschijnt doorgaans aan het begin van de week. Wij plaatsen de folder zo snel mogelijk online zodra deze beschikbaar is.`,
    },
    {
      question: `Zijn de promoties geldig in heel België?`,
      answer: `Ja, alle ${retailer.name} promoties die we tonen zijn geldig in de Belgische winkels. Sommige promoties kunnen regionaal variëren.`,
    },
  ];

  return (
    <div className="max-w-6xl mx-auto px-4 py-12">
      <JsonLd
        data={createRetailerFolderJsonLd(
          retailer.name,
          slug,
          currentFolder?.validFrom,
          currentFolder?.validUntil
        )}
      />
      <JsonLd data={createFAQJsonLd(faqItems)} />
      {/* Breadcrumb */}
      <nav className="text-sm text-gray-500 mb-6">
        <Link href="/" className="hover:text-blue-700">
          Home
        </Link>
        <span className="mx-2">›</span>
        <Link href="/folders" className="hover:text-blue-700">
          Folders
        </Link>
        <span className="mx-2">›</span>
        <span className="text-gray-900">{retailer.name}</span>
      </nav>

      {/* Retailer header */}
      <div className="flex items-center gap-4 mb-8">
        <Image
          src={retailer.logo}
          alt={`${retailer.name} logo`}
          width={56}
          height={56}
          className="w-14 h-14 rounded-xl object-cover"
        />
        <div>
          <h1 className="text-3xl font-bold text-gray-900">
            {retailer.name} folder deze week
          </h1>
          <p className="text-gray-600">{retailer.description}</p>
        </div>
      </div>

      {/* Folder viewer */}
      {currentFolder ? (
        <FolderViewer folder={currentFolder} retailer={retailer} />
      ) : (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-8 text-center mb-8">
          <p className="text-amber-800 font-medium mb-2">
            Er is momenteel geen folder beschikbaar voor {retailer.name}.
          </p>
          <p className="text-amber-700 text-sm">
            Folders worden wekelijks bijgewerkt. Kom later terug of bekijk onze Facebook-groep voor
            de laatste updates.
          </p>
        </div>
      )}

      {/* Actions */}
      <div className="flex flex-col sm:flex-row gap-4 mt-8">
        <a
          href={affiliateUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center justify-center gap-2 bg-gray-100 hover:bg-gray-200 text-gray-800 font-medium px-6 py-3 rounded-lg transition"
        >
          <ExternalLink className="w-4 h-4" />
          Bezoek {retailer.name}
        </a>
        <a
          href="https://www.facebook.com/groups/superpromobelgie"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center justify-center gap-2 bg-blue-700 hover:bg-blue-800 text-white font-medium px-6 py-3 rounded-lg transition"
        >
          <Facebook className="w-4 h-4" />
          Bekijk de beste deals in onze groep
        </a>
      </div>

      {/* FAQ / SEO content */}
      <section className="mt-16">
        <h2 className="text-xl font-bold text-gray-900 mb-6">
          Veelgestelde vragen over {retailer.name}
        </h2>
        <div className="space-y-4">
          {faqItems.map((item, i) => (
            <details key={i} className="bg-white border border-gray-200 rounded-lg">
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
