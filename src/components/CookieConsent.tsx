"use client";

import { useState, useEffect, useCallback } from "react";
import { X } from "lucide-react";

const CONSENT_KEY = "sp_cookie_consent";

type ConsentValue = "accepted" | "declined" | null;

function getStoredConsent(): ConsentValue {
  if (typeof window === "undefined") return null;
  const value = localStorage.getItem(CONSENT_KEY);
  if (value === "accepted" || value === "declined") return value;
  return null;
}

function loadClarity(projectId: string) {
  if (typeof window === "undefined") return;
  if ((window as any).clarity) return;

  (function (c: any, l: any, a: any, r: any, i: any) {
    c[a] =
      c[a] ||
      function () {
        (c[a].q = c[a].q || []).push(arguments);
      };
    const t = l.createElement(r) as HTMLScriptElement;
    t.async = true;
    t.src = "https://www.clarity.ms/tag/" + i;
    const y = l.getElementsByTagName(r)[0] as HTMLElement;
    y.parentNode!.insertBefore(t, y);
  })(window, document, "clarity", "script", projectId);
}

function captureAttributionFromUrlIfPresent() {
  if (typeof window === "undefined") return;
  const qs = window.location.search;
  if (!qs || !qs.includes("utm_")) return;

  fetch(`/api/attribution${qs}`, { credentials: "include" }).catch(() => {});
}

function setConsentCookie(value: Exclude<ConsentValue, null>) {
  if (typeof window === "undefined") return;
  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `sp_cookie_consent=${value}; Path=/; Max-Age=${60 * 60 * 24 * 365}; SameSite=Lax${secure}`;
  window.dispatchEvent(new Event("sp_consent_changed"));
}

export function CookieConsent() {
  const [visible, setVisible] = useState(false);
  const [consent, setConsent] = useState<ConsentValue>(null);

  useEffect(() => {
    const stored = getStoredConsent();
    setConsent(stored);

    if (stored === null) {
      setVisible(true);
    }

    if (stored === "accepted") {
      setConsentCookie("accepted");
      const clarityId = process.env.NEXT_PUBLIC_CLARITY_ID;
      if (clarityId) loadClarity(clarityId);

      captureAttributionFromUrlIfPresent();
    }

    if (stored === "declined") {
      setConsentCookie("declined");
    }
  }, []);

  const handleAccept = useCallback(() => {
    localStorage.setItem(CONSENT_KEY, "accepted");
    setConsent("accepted");
    setVisible(false);

    setConsentCookie("accepted");

    const clarityId = process.env.NEXT_PUBLIC_CLARITY_ID;
    if (clarityId) loadClarity(clarityId);

    captureAttributionFromUrlIfPresent();
  }, []);

  const handleDecline = useCallback(() => {
    localStorage.setItem(CONSENT_KEY, "declined");
    setConsent("declined");
    setVisible(false);

    setConsentCookie("declined");
  }, []);

  if (!visible) return null;

  return (
    <div
      role="dialog"
      aria-label="Cookie-instellingen"
      className="fixed bottom-0 inset-x-0 z-100 p-4 sm:p-6"
    >
      <div className="max-w-2xl mx-auto bg-white border border-gray-200 rounded-2xl shadow-2xl p-6">
        <div className="flex items-start justify-between gap-4 mb-3">
          <h2 className="font-bold text-gray-900">Cookie-instellingen</h2>
          <button
            onClick={handleDecline}
            className="text-gray-400 hover:text-gray-600 transition"
            aria-label="Sluiten"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <p className="text-sm text-gray-600 mb-4 leading-relaxed">
          Wij gebruiken analytische cookies om te begrijpen hoe bezoekers onze website gebruiken.
          Dit helpt ons de website te verbeteren. Analyses (zoals heatmaps en sessie-opnames) worden
          alleen ingeschakeld als je hiermee akkoord gaat.
        </p>

        <div className="flex flex-col sm:flex-row gap-3">
          <button
            onClick={handleAccept}
            className="flex-1 bg-blue-700 hover:bg-blue-800 text-white font-medium px-5 py-2.5 rounded-lg transition text-sm"
          >
            Alle cookies accepteren
          </button>
          <button
            onClick={handleDecline}
            className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-800 font-medium px-5 py-2.5 rounded-lg transition text-sm"
          >
            Alleen noodzakelijke
          </button>
        </div>

        <p className="text-xs text-gray-400 mt-3">
          Je kunt je keuze op elk moment wijzigen. Lees ons{" "}
          <a href="/privacy" className="underline hover:text-gray-600">
            privacybeleid
          </a>{" "}
          voor meer informatie.
        </p>
      </div>
    </div>
  );
}
