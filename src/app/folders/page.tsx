import { Metadata } from "next";
import { retailers } from "@/lib/retailers";
import { RetailerCard } from "@/components/RetailerCard";

export const metadata: Metadata = {
  title: "Alle Folders",
  description:
    "Bekijk alle actuele reclamefolders van supermarkten in België. Albert Heijn, Lidl, Delhaize, Colruyt en meer.",
};

export default function FoldersPage() {
  const supermarkten = retailers.filter((r) => r.category === "supermarkt");

  return (
    <div className="max-w-6xl mx-auto px-4 py-12">
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
        Bekijk de actuele reclamefolders van je favoriete winkels in België. Elke week bijgewerkt.
      </p>

      <div>
        <h2 className="text-xl font-bold text-gray-900 mb-4">Supermarkten</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
          {supermarkten.map((retailer) => (
            <RetailerCard key={retailer.slug} retailer={retailer} />
          ))}
        </div>
      </div>
    </div>
  );
}
