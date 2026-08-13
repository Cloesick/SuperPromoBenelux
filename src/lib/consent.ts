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

/* --- Client side: Google's CMP (IAB TCF v2.2) -----------------------------
 *
 * Google's certified CMP is the source of truth for consent in the EEA, the UK
 * and Switzerland. It publishes its decision on the IAB TCF `__tcfapi` channel
 * rather than in our own storage, so ConsentBridge mirrors that decision back
 * into `sp_cookie_consent`. Everything that already listens on that key — the
 * analytics and pixel gates in the browser, and the three API routes that read
 * the cookie server-side — then keeps working untouched.
 */

export const CONSENT_KEY = "sp_cookie_consent";

export type ConsentValue = "accepted" | "declined";

/* TCF purpose 1, "Store and/or access information on a device". Everything we
 * gate behind consent (analytics tags, the Meta pixel, the attribution cookie)
 * is device storage, so purpose 1 is the one signal that governs all of it. */
const PURPOSE_DEVICE_STORAGE = 1;

export type TcData = {
  gdprApplies?: boolean;
  eventStatus?: string;
  listenerId?: number;
  purpose?: { consents?: Record<string, boolean> };
};

type TcfApi = (
  command: string,
  version: number,
  callback: (tcData: TcData, success: boolean) => void,
  listenerId?: number,
) => void;

export function getTcfApi(): TcfApi | null {
  if (typeof window === "undefined") return null;
  const api = (window as unknown as { __tcfapi?: TcfApi }).__tcfapi;
  return typeof api === "function" ? api : null;
}

/** True once a TCF consent management platform has put itself on the page. */
export function isCmpPresent(): boolean {
  return getTcfApi() !== null;
}

export function consentFromTcData(tcData: TcData | null | undefined): boolean {
  if (!tcData) return false;

  /* Outside the EEA/UK/CH the CMP reports that GDPR does not apply and sends no
   * purpose list at all. That is permission by absence of the requirement, not
   * a refusal, so it must not be read as "declined". */
  if (tcData.gdprApplies === false) return true;

  return tcData.purpose?.consents?.[PURPOSE_DEVICE_STORAGE] === true;
}

/** Should this tcData event be acted on, or is the user still mid-decision? */
export function isDecisiveTcfEvent(tcData: TcData | null | undefined): boolean {
  if (!tcData) return false;
  /* `cmpuishown` fires while the dialog is still open and carries whatever the
   * previous state was — acting on it would bank a decision the user has not
   * made yet. */
  return (
    tcData.eventStatus === "tcloaded" ||
    tcData.eventStatus === "useractioncomplete"
  );
}

/**
 * Subscribe to the CMP's consent decision. Returns an unsubscribe function; it
 * is a no-op when no CMP is present.
 */
export function subscribeToCmpConsent(
  onDecision: (granted: boolean) => void,
): () => void {
  const api = getTcfApi();
  if (!api) return () => {};

  let listenerId: number | undefined;

  const handler = (tcData: TcData, success: boolean) => {
    if (!success) return;
    if (tcData?.listenerId !== undefined) listenerId = tcData.listenerId;
    if (!isDecisiveTcfEvent(tcData)) return;
    onDecision(consentFromTcData(tcData));
  };

  api("addEventListener", 2, handler);

  return () => {
    if (listenerId === undefined) return;
    api("removeEventListener", 2, () => {}, listenerId);
  };
}

/**
 * Write a consent decision everywhere the app reads it from: localStorage (the
 * browser gates), the cookie (the server routes), and the in-page event that
 * tells already-mounted gates to re-check.
 */
export function persistConsentChoice(value: ConsentValue) {
  if (typeof window === "undefined") return;

  window.localStorage.setItem(CONSENT_KEY, value);

  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${CONSENT_KEY}=${value}; Path=/; Max-Age=${60 * 60 * 24 * 365}; SameSite=Lax${secure}`;

  window.dispatchEvent(new Event("sp_consent_changed"));
}
