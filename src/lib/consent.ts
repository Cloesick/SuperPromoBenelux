export function isConsentAccepted(cookieHeader: string | null): boolean {
  if (!cookieHeader) return false;

  const hit = cookieHeader
    .split(";")
    .map((c) => c.trim())
    .find((c) => c.startsWith("sp_cookie_consent="));

  if (!hit) return false;
  const v = hit.split("=")[1];
  return v === "accepted";
}
