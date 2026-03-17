"use client";

import { useCallback, useEffect, useMemo, useState, type ChangeEvent } from "react";
import { MapPin } from "lucide-react";
import type { LatLng } from "@/lib/geo";

const LOCATION_KEY = "sp_user_location";

type StoredLocation = {
  mode: "geo" | "city";
  label: string;
  location: LatLng;
};

function loadStoredLocation(): StoredLocation | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(LOCATION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredLocation;
    if (typeof parsed?.location?.lat !== "number" || typeof parsed?.location?.lng !== "number") {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function saveStoredLocation(v: StoredLocation | null) {
  if (typeof window === "undefined") return;
  if (!v) {
    window.localStorage.removeItem(LOCATION_KEY);
    return;
  }
  window.localStorage.setItem(LOCATION_KEY, JSON.stringify(v));
}

const CITY_PRESETS: Array<{ label: string; value: string; location: LatLng }> = [
  { label: "Antwerpen", value: "antwerpen", location: { lat: 51.2194, lng: 4.4025 } },
  { label: "Brussel", value: "brussel", location: { lat: 50.8503, lng: 4.3517 } },
  { label: "Gent", value: "gent", location: { lat: 51.0543, lng: 3.7174 } },
  { label: "Leuven", value: "leuven", location: { lat: 50.8798, lng: 4.7005 } },
  { label: "Hasselt", value: "hasselt", location: { lat: 50.9307, lng: 5.3325 } },
  { label: "Luik", value: "luik", location: { lat: 50.6326, lng: 5.5797 } },
];

export function NearMeFilter({
  onChange,
}: {
  onChange: (value: { label: string; location: LatLng } | null) => void;
}) {
  const [selectedCity, setSelectedCity] = useState<string>("");
  const [status, setStatus] = useState<string>("");
  const [activeLabel, setActiveLabel] = useState<string>("");

  useEffect(() => {
    const stored = loadStoredLocation();
    if (!stored) return;
    setActiveLabel(stored.label);
    onChange({ label: stored.label, location: stored.location });
    if (stored.mode === "city") {
      const preset = CITY_PRESETS.find((c) => c.label === stored.label);
      if (preset) setSelectedCity(preset.value);
    }
  }, [onChange]);

  const cityOptions = useMemo(() => CITY_PRESETS, []);

  const useMyLocation = useCallback(() => {
    setStatus("");
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setStatus("Geolocatie is niet beschikbaar in deze browser.");
      return;
    }

    setStatus("Locatie ophalen...");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        const label = "Mijn locatie";
        setActiveLabel(label);
        saveStoredLocation({ mode: "geo", label, location: loc });
        onChange({ label, location: loc });
        setStatus("");
      },
      () => {
        setStatus("Locatie ophalen mislukt. Kies een stad als alternatief.");
      },
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 1000 * 60 * 30 }
    );
  }, [onChange]);

  const applyCity = useCallback(
    (value: string) => {
      setSelectedCity(value);
      const preset = CITY_PRESETS.find((c) => c.value === value);
      if (!preset) {
        setActiveLabel("");
        saveStoredLocation(null);
        onChange(null);
        return;
      }

      setActiveLabel(preset.label);
      saveStoredLocation({ mode: "city", label: preset.label, location: preset.location });
      onChange({ label: preset.label, location: preset.location });
      setStatus("");
    },
    [onChange]
  );

  const clear = useCallback(() => {
    setSelectedCity("");
    setActiveLabel("");
    setStatus("");
    saveStoredLocation(null);
    onChange(null);
  }, [onChange]);

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4 mb-8">
      <div className="flex flex-col md:flex-row md:items-center gap-3 md:gap-4">
        <div className="flex items-center gap-2 text-sm font-medium text-gray-900">
          <MapPin className="w-4 h-4 text-blue-700" />
          {activeLabel ? `Dichtbij: ${activeLabel}` : "Dichtbij"}
        </div>

        <div className="flex flex-col sm:flex-row gap-3 flex-1">
          <button
            type="button"
            onClick={useMyLocation}
            className="bg-blue-700 hover:bg-blue-800 text-white font-medium px-4 py-2 rounded-lg transition text-sm"
          >
            Gebruik mijn locatie
          </button>

          <select
            value={selectedCity}
            onChange={(e: ChangeEvent<HTMLSelectElement>) => applyCity(e.target.value)}
            className="flex-1 bg-white border border-gray-300 text-gray-900 px-3 py-2 rounded-lg text-sm"
            aria-label="Kies een stad"
          >
            <option value="">Kies een stad…</option>
            {cityOptions.map((c: { label: string; value: string }) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={clear}
            className="bg-gray-100 hover:bg-gray-200 text-gray-800 font-medium px-4 py-2 rounded-lg transition text-sm"
          >
            Reset
          </button>
        </div>
      </div>

      {status ? <p className="text-sm text-gray-600 mt-3">{status}</p> : null}
    </div>
  );
}
