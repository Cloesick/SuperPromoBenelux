import Link from "next/link";
import Image from "next/image";
import { ShoppingBag } from "lucide-react";
import { Retailer } from "@/lib/types";

interface RetailerCardProps {
  retailer: Retailer;
  folderCount?: number;
}

export function RetailerCard({ retailer, folderCount }: RetailerCardProps) {
  const isSvgLogo = retailer.logo.toLowerCase().endsWith(".svg");

  return (
    <Link
      href={`/folders/${retailer.slug}`}
      className="group block bg-white rounded-xl border border-gray-200 hover:border-blue-300 hover:shadow-lg transition-all duration-200 overflow-hidden"
    >
      <div
        className="h-2 w-full"
        style={{ backgroundColor: retailer.color }}
      />
      <div className="p-6">
        <div className="flex items-center gap-3 mb-3">
          {isSvgLogo ? (
            <img
              src={retailer.logo}
              alt={`${retailer.name} logo`}
              width={48}
              height={48}
              className="w-12 h-12 rounded-lg object-cover"
              loading="lazy"
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
        <p className="text-sm text-gray-600 leading-relaxed mb-4">
          {retailer.description}
        </p>
        <div className="flex items-center justify-between">
          <span className="inline-flex items-center gap-1.5 text-sm font-medium text-blue-700">
            <ShoppingBag className="w-4 h-4" />
            Bekijk folder
          </span>
          {folderCount !== undefined && folderCount > 0 && (
            <span className="text-xs bg-blue-50 text-blue-700 px-2 py-1 rounded-full">
              {folderCount} {folderCount === 1 ? "folder" : "folders"}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}
