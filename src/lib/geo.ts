export type LatLng = {
  lat: number;
  lng: number;
};

export function toRadians(deg: number): number {
  return (deg * Math.PI) / 180;
}

export function haversineDistanceKm(a: LatLng, b: LatLng): number {
  const R = 6371;
  const dLat = toRadians(b.lat - a.lat);
  const dLng = toRadians(b.lng - a.lng);

  const lat1 = toRadians(a.lat);
  const lat2 = toRadians(b.lat);

  const sinDLat = Math.sin(dLat / 2);
  const sinDLng = Math.sin(dLng / 2);

  const x = sinDLat * sinDLat + Math.cos(lat1) * Math.cos(lat2) * (sinDLng * sinDLng);
  const c = 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
  return R * c;
}
