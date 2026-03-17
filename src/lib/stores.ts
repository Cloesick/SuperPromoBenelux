import { LatLng, haversineDistanceKm } from "./geo";

export type Store = {
  id: string;
  retailerSlug: string;
  name: string;
  address?: string;
  city: string;
  postalCode?: string;
  location: LatLng;
};

export const stores: Store[] = [
  {
    id: "ah-antwerpen",
    retailerSlug: "albert-heijn",
    name: "Albert Heijn Antwerpen",
    city: "Antwerpen",
    postalCode: "2000",
    location: { lat: 51.2194, lng: 4.4025 },
  },
  {
    id: "lidl-brussel",
    retailerSlug: "lidl",
    name: "Lidl Brussel",
    city: "Brussel",
    postalCode: "1000",
    location: { lat: 50.8503, lng: 4.3517 },
  },
  {
    id: "delhaize-gent",
    retailerSlug: "delhaize",
    name: "Delhaize Gent",
    city: "Gent",
    postalCode: "9000",
    location: { lat: 51.0543, lng: 3.7174 },
  },
  {
    id: "colruyt-luik",
    retailerSlug: "colruyt",
    name: "Colruyt Luik",
    city: "Luik",
    postalCode: "4000",
    location: { lat: 50.6326, lng: 5.5797 },
  },
  {
    id: "aldi-leuven",
    retailerSlug: "aldi",
    name: "ALDI Leuven",
    city: "Leuven",
    postalCode: "3000",
    location: { lat: 50.8798, lng: 4.7005 },
  },
  {
    id: "action-hasselt",
    retailerSlug: "action",
    name: "Action Hasselt",
    city: "Hasselt",
    postalCode: "3500",
    location: { lat: 50.9307, lng: 5.3325 },
  },
];

export function getNearestStoreDistanceKm(retailerSlug: string, user: LatLng): number | null {
  const candidates = stores.filter((s) => s.retailerSlug === retailerSlug);
  if (candidates.length === 0) return null;

  let best = Infinity;
  for (const s of candidates) {
    const d = haversineDistanceKm(user, s.location);
    if (d < best) best = d;
  }

  return Number.isFinite(best) ? best : null;
}

export function getNearestStores(user: LatLng, limit: number): Array<Store & { distanceKm: number }> {
  const withDistance = stores
    .map((s) => ({ ...s, distanceKm: haversineDistanceKm(user, s.location) }))
    .sort((a, b) => a.distanceKm - b.distanceKm);

  return withDistance.slice(0, Math.max(0, limit));
}
