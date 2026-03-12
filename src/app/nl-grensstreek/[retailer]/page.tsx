import { Metadata } from "next";
import { notFound } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { getNlBorderRetailerBySlug, nlBorderRetailers } from "@/lib/retailers";
import { getCurrentFolder } from "@/lib/folders";
import { FolderViewer } from "@/components/FolderViewer";

interface PageProps {
  params: Promise<{ retailer: string }>;
}

export async function generateStaticParams() {
  return nlBorderRetailers.map((r) => ({ retailer: r.slug }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { retailer: slug } = await params;
  const retailer = getNlBorderRetailerBySlug(slug);
  if (!retailer) return {};

  return {
    title: `${retailer.name} folder (NL grensstreek)`,
    description: retailer.description,
    robots: { index: false, follow: false },
    alternates: {
      canonical: `/nl-grensstreek/${slug}`,
    },
    openGraph: {
      title: `${retailer.name} folder | NL grensstreek | SuperPromo België`,
      description: retailer.description,
    },
  };
}

export default async function NlBorderRetailerPage({ params }: PageProps) {
  const { retailer: slug } = await params;
  const retailer = getNlBorderRetailerBySlug(slug);

  if (!retailer) {
    notFound();
  }

  const currentFolder = getCurrentFolder(slug);
  const outboundUrl = `/out/${slug}`;

  const isSvgLogo = retailer.logo.toLowerCase().endsWith(".svg");

  return (
    <div className="max-w-6xl mx-auto px-4 py-12">
      <nav className="text-sm text-gray-500 mb-6">
        <Link href="/" className="hover:text-blue-700">
          Home
        </Link>
        <span className="mx-2">›</span>
        <Link href="/nl-grensstreek" className="hover:text-blue-700">
          NL grensstreek
        </Link>
        <span className="mx-2">›</span>
        <span className="text-gray-900">{retailer.name}</span>
      </nav>

      <div className="flex items-center gap-4 mb-8">
        {isSvgLogo ? (
          <img
            src={retailer.logo}
            alt={`${retailer.name} logo`}
            width={56}
            height={56}
            className="w-14 h-14 rounded-xl object-cover"
            loading="lazy"
          />
        ) : (
          <Image
            src={retailer.logo}
            alt={`${retailer.name} logo`}
            width={56}
            height={56}
            className="w-14 h-14 rounded-xl object-cover"
          />
        )}
        <div>
          <h1 className="text-3xl font-bold text-gray-900">{retailer.name}</h1>
          <p className="text-gray-600">{retailer.description}</p>
        </div>
      </div>

      {currentFolder ? (
        <FolderViewer folder={currentFolder} retailer={retailer} />
      ) : (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-8 text-center mb-8">
          <p className="text-amber-800 font-medium mb-2">
            Er is momenteel geen folder beschikbaar voor {retailer.name}.
          </p>
          <p className="text-amber-700 text-sm">
            Dit is een MVP-sectie. Zodra er data beschikbaar is, tonen we hier automatisch de actuele
            folder.
          </p>
        </div>
      )}

      <div className="flex flex-col sm:flex-row gap-4 mt-8">
        <a
          href={outboundUrl}
          target="_blank"
          rel="noopener noreferrer sponsored"
          className="inline-flex items-center justify-center gap-2 bg-gray-100 hover:bg-gray-200 text-gray-800 font-medium px-6 py-3 rounded-lg transition"
        >
          <ExternalLink className="w-4 h-4" />
          Bezoek {retailer.name}
        </a>
      </div>
    </div>
  );
}
