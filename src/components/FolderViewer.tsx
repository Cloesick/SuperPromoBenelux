"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { ChevronLeft, ChevronRight, Calendar, FileText, Maximize2 } from "lucide-react";
import { Folder, Retailer } from "@/lib/types";

interface FolderViewerProps {
  folder: Folder;
  retailer: Retailer;
}

export function FolderViewer({ folder, retailer }: FolderViewerProps) {
  const hasEmbed = !!folder.embedUrl;
  const hasPdf = !!folder.pdfUrl;
  const hasPages = folder.pages.length > 0;
  const [isIOS, setIsIOS] = useState(false);

  const [trackingEnabled, setTrackingEnabled] = useState(false);
  const sentRef = useRef<Set<string>>(new Set());

  const [currentPage, setCurrentPage] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [mode, setMode] = useState<"embed" | "pdf" | "pages">(() => {
    if (hasEmbed) return "embed";
    if (hasPages) return "pages";
    return "pdf";
  });

  useEffect(() => {
    const hasConsent = () => {
      if (typeof document === "undefined") return false;
      return document.cookie
        .split(";")
        .map((c) => c.trim())
        .some((c) => c === "sp_cookie_consent=accepted" || c.startsWith("sp_cookie_consent=accepted"));
    };

    const update = () => setTrackingEnabled(hasConsent());
    update();

    window.addEventListener("sp_consent_changed", update);
    window.addEventListener("storage", update);
    return () => {
      window.removeEventListener("sp_consent_changed", update);
      window.removeEventListener("storage", update);
    };
  }, []);

  useEffect(() => {
    if (!trackingEnabled) return;
    if (typeof window === "undefined") return;

    const send = (event: string, key: string) => {
      if (sentRef.current.has(key)) return;
      sentRef.current.add(key);

      void fetch("/api/engagement", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          event,
          retailer: retailer.slug,
          path: window.location.pathname,
        }),
        keepalive: true,
      }).catch(() => {
        return;
      });
    };

    send("folder_view", "folder_view");

    const t = window.setTimeout(() => {
      send("folder_engaged_15s", "folder_engaged_15s");
    }, 15000);

    const onScroll = () => {
      const doc = document.documentElement;
      const max = doc.scrollHeight - window.innerHeight;
      if (max <= 0) return;
      const pct = (window.scrollY / max) * 100;
      if (pct >= 50) send("folder_scroll_50", "folder_scroll_50");
      if (pct >= 90) send("folder_scroll_90", "folder_scroll_90");
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();

    return () => {
      window.clearTimeout(t);
      window.removeEventListener("scroll", onScroll);
    };
  }, [trackingEnabled, retailer.slug]);

  useEffect(() => {
    if (!trackingEnabled) return;
    if (mode !== "pages") return;
    if (typeof window === "undefined") return;

    const key = `folder_page_turn:${currentPage}`;
    if (sentRef.current.has(key)) return;
    sentRef.current.add(key);

    void fetch("/api/engagement", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        event: "folder_page_turn",
        retailer: retailer.slug,
        path: window.location.pathname,
      }),
      keepalive: true,
    }).catch(() => {
      return;
    });
  }, [trackingEnabled, mode, currentPage, retailer.slug]);

  useEffect(() => {
    const ua = navigator.userAgent;
    const detectedIOS = /iP(hone|od|ad)/.test(ua);
    setIsIOS(detectedIOS);

    if (detectedIOS && hasPdf) setMode("pdf");
  }, [hasPdf]);

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

      {(hasEmbed || hasPdf || hasPages) && (
        <div className="flex flex-wrap items-center gap-2 mb-4">
          {hasEmbed && (
            <button
              type="button"
              onClick={() => setMode("embed")}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition ${
                mode === "embed"
                  ? "bg-blue-700 text-white border-blue-700"
                  : "bg-white text-gray-700 border-gray-200 hover:border-gray-300"
              }`}
            >
              Online
            </button>
          )}
          {hasPdf && (
            <button
              type="button"
              onClick={() => setMode("pdf")}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition ${
                mode === "pdf"
                  ? "bg-blue-700 text-white border-blue-700"
                  : "bg-white text-gray-700 border-gray-200 hover:border-gray-300"
              }`}
            >
              PDF
            </button>
          )}
          {hasPages && (
            <button
              type="button"
              onClick={() => setMode("pages")}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition ${
                mode === "pages"
                  ? "bg-blue-700 text-white border-blue-700"
                  : "bg-white text-gray-700 border-gray-200 hover:border-gray-300"
              }`}
            >
              Pagina&apos;s
            </button>
          )}

          <div className="flex-1" />

          {mode === "embed" && hasEmbed && (
            <a
              href={folder.embedUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm font-medium text-gray-600 hover:text-blue-700 transition"
            >
              Open in nieuw tabblad
            </a>
          )}
          {mode === "pdf" && hasPdf && (
            <a
              href={folder.pdfUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm font-medium text-gray-600 hover:text-blue-700 transition"
            >
              Open PDF
            </a>
          )}
        </div>
      )}

      {/* Primary: Embedded folder viewer (iframe) */}
      {mode === "embed" && hasEmbed ? (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className={`relative ${isFullscreen ? "fixed inset-0 z-50 bg-white" : ""}`}>
            {isIOS && !hasPdf && !hasPages && !isFullscreen && (
              <div className="sm:hidden px-6 py-4 border-b border-gray-100 bg-gray-50">
                <p className="text-sm text-gray-600 mb-3">
                  Op iPhone wordt de online folder soms geblokkeerd in deze pagina.
                </p>
                <a
                  href={folder.embedUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-sm font-medium text-blue-700 hover:text-blue-800 transition"
                >
                  Open in nieuw tabblad
                </a>
              </div>
            )}
            {isFullscreen && (
              <button
                onClick={() => setIsFullscreen(false)}
                className="absolute top-[calc(env(safe-area-inset-top)+1rem)] right-[calc(env(safe-area-inset-right)+1rem)] z-10 bg-white/90 hover:bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm font-medium text-gray-700 shadow-lg transition"
              >
                Sluiten
              </button>
            )}
            <iframe
              src={folder.embedUrl}
              title={`${retailer.name} folder`}
              className={`w-full border-0 ${
                isFullscreen
                  ? "h-full"
                  : "h-[70dvh] sm:h-[750px] lg:h-[900px]"
              }`}
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
      ) : mode === "pdf" && hasPdf ? (
        /* Fallback: PDF viewer */
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="sm:hidden p-6 text-center">
            <p className="text-sm text-gray-600 mb-3">
              Op sommige mobiele browsers wordt een PDF niet altijd correct in de pagina getoond.
            </p>
            <a
              href={folder.pdfUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-blue-700 hover:text-blue-800 transition"
            >
              <FileText className="w-4 h-4" />
              Open PDF
            </a>
          </div>

          <iframe
            src={folder.pdfUrl}
            title={`${retailer.name} folder PDF`}
            className="hidden sm:block w-full h-[750px] lg:h-[900px] border-0"
            loading="lazy"
          />
        </div>
      ) : mode === "pages" && hasPages ? (
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
      {mode === "pages" && !hasEmbed && !hasPdf && folder.pages.length > 1 && (
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
