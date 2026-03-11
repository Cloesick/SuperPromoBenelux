"use client";

import { useState } from "react";
import Image from "next/image";
import { ChevronLeft, ChevronRight, Calendar, FileText, Maximize2 } from "lucide-react";
import { Folder, Retailer } from "@/lib/types";

interface FolderViewerProps {
  folder: Folder;
  retailer: Retailer;
}

export function FolderViewer({ folder, retailer }: FolderViewerProps) {
  const [currentPage, setCurrentPage] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const validFrom = new Date(folder.validFrom).toLocaleDateString("nl-BE", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  const validUntil = new Date(folder.validUntil).toLocaleDateString("nl-BE", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const hasEmbed = !!folder.embedUrl;
  const hasPdf = !!folder.pdfUrl;
  const hasPages = folder.pages.length > 0;

  return (
    <div>
      {/* Folder info */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-3">
        <h2 className="text-lg font-semibold text-gray-900">{folder.title}</h2>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <Calendar className="w-4 h-4" />
            <span>
              {validFrom} - {validUntil}
            </span>
          </div>
          {hasPdf && (
            <a
              href={folder.pdfUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-blue-700 hover:text-blue-800 transition"
            >
              <FileText className="w-4 h-4" />
              PDF
            </a>
          )}
        </div>
      </div>

      {/* Primary: Embedded folder viewer (iframe) */}
      {hasEmbed ? (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className={`relative ${isFullscreen ? "fixed inset-0 z-50 bg-white" : ""}`}>
            {isFullscreen && (
              <button
                onClick={() => setIsFullscreen(false)}
                className="absolute top-4 right-4 z-10 bg-white/90 hover:bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm font-medium text-gray-700 shadow-lg transition"
              >
                Sluiten
              </button>
            )}
            <iframe
              src={folder.embedUrl}
              title={`${retailer.name} folder`}
              className={`w-full border-0 ${isFullscreen ? "h-full" : "h-[600px] sm:h-[750px] lg:h-[900px]"}`}
              allow="fullscreen"
              loading="lazy"
              sandbox="allow-scripts allow-same-origin allow-popups allow-forms allow-top-navigation"
            />
          </div>
          {!isFullscreen && (
            <div className="flex items-center justify-end px-6 py-3 border-t border-gray-100">
              <button
                onClick={() => setIsFullscreen(true)}
                className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-600 hover:text-blue-700 transition"
              >
                <Maximize2 className="w-4 h-4" />
                Volledig scherm
              </button>
            </div>
          )}
        </div>
      ) : hasPdf ? (
        /* Fallback: PDF viewer via iframe */
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <iframe
            src={folder.pdfUrl}
            title={`${retailer.name} folder PDF`}
            className="w-full h-[600px] sm:h-[750px] lg:h-[900px] border-0"
            loading="lazy"
          />
        </div>
      ) : hasPages ? (
        /* Fallback: Image page viewer */
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="relative aspect-3/4 bg-gray-50">
            <Image
              src={folder.pages[currentPage].imageUrl}
              alt={`${retailer.name} folder pagina ${currentPage + 1}`}
              fill
              className="object-contain"
              priority={currentPage === 0}
            />
          </div>

          {/* Navigation */}
          <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100">
            <button
              onClick={() => setCurrentPage((p) => Math.max(0, p - 1))}
              disabled={currentPage === 0}
              className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-700 hover:text-blue-700 disabled:text-gray-300 disabled:cursor-not-allowed transition"
            >
              <ChevronLeft className="w-5 h-5" />
              Vorige
            </button>
            <span className="text-sm text-gray-500">
              Pagina {currentPage + 1} van {folder.pages.length}
            </span>
            <button
              onClick={() =>
                setCurrentPage((p) => Math.min(folder.pages.length - 1, p + 1))
              }
              disabled={currentPage === folder.pages.length - 1}
              className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-700 hover:text-blue-700 disabled:text-gray-300 disabled:cursor-not-allowed transition"
            >
              Volgende
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        </div>
      ) : (
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-12 text-center">
          <p className="text-gray-500">
            De folderpagina&apos;s worden binnenkort geladen.
          </p>
        </div>
      )}

      {/* Page thumbnails (only for image mode) */}
      {!hasEmbed && !hasPdf && folder.pages.length > 1 && (
        <div className="mt-4 flex gap-2 overflow-x-auto pb-2">
          {folder.pages.map((page, i) => (
            <button
              key={page.pageNumber}
              onClick={() => setCurrentPage(i)}
              className={`shrink-0 w-16 h-22 rounded-md overflow-hidden border-2 transition ${
                i === currentPage
                  ? "border-blue-600 shadow-sm"
                  : "border-gray-200 hover:border-gray-300"
              }`}
            >
              <Image
                src={page.imageUrl}
                alt={`Pagina ${i + 1}`}
                width={64}
                height={88}
                className="object-cover w-full h-full"
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
