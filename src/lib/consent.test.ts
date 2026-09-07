import { afterEach, describe, expect, it, vi } from "vitest";
import {
	consentFromTcData,
	isConsentAccepted,
	isDecisiveTcfEvent,
	subscribeToCmpConsent,
	type TcData,
} from "./consent";

// ---------------------------------------------------------------------------
// A mistake here is expensive in both directions: too strict and Google's CMP
// never switches the ad and analytics gates on, so the site earns nothing; too
// loose and we run trackers on people who refused them. These cover the
// decisions themselves, not the DOM plumbing around them.
// ---------------------------------------------------------------------------

describe("isConsentAccepted", () => {
	it("accepts only the exact accepted value", () => {
		expect(isConsentAccepted("sp_cookie_consent=accepted")).toBe(true);
		expect(isConsentAccepted("sp_cookie_consent=declined")).toBe(false);
	});

	it("finds the cookie among others", () => {
		expect(
			isConsentAccepted("foo=bar; sp_cookie_consent=accepted; baz=qux"),
		).toBe(true);
	});

	it("treats a missing header or cookie as no consent", () => {
		expect(isConsentAccepted(null)).toBe(false);
		expect(isConsentAccepted("other=1")).toBe(false);
	});
});

describe("consentFromTcData", () => {
	it("treats 'GDPR does not apply' as permission, not refusal", () => {
		// Outside the EEA the CMP sends no purpose list at all. Reading that as a
		// decline would switch analytics off for every non-EEA visitor.
		expect(consentFromTcData({ gdprApplies: false })).toBe(true);
	});

	it("grants when device-storage purpose 1 is consented", () => {
		expect(
			consentFromTcData({
				gdprApplies: true,
				purpose: { consents: { 1: true } },
			}),
		).toBe(true);
	});

	it("refuses when purpose 1 is refused or absent", () => {
		expect(
			consentFromTcData({
				gdprApplies: true,
				purpose: { consents: { 1: false } },
			}),
		).toBe(false);
		expect(
			consentFromTcData({
				gdprApplies: true,
				purpose: { consents: { 2: true } },
			}),
		).toBe(false);
		expect(consentFromTcData({ gdprApplies: true })).toBe(false);
	});

	it("refuses when there is no tcData at all", () => {
		expect(consentFromTcData(null)).toBe(false);
		expect(consentFromTcData(undefined)).toBe(false);
	});
});

describe("isDecisiveTcfEvent", () => {
	it("acts on a loaded string and on a completed user action", () => {
		expect(isDecisiveTcfEvent({ eventStatus: "tcloaded" })).toBe(true);
		expect(isDecisiveTcfEvent({ eventStatus: "useractioncomplete" })).toBe(
			true,
		);
	});

	it("ignores the dialog merely being shown", () => {
		// cmpuishown carries the *previous* state while the user is still
		// deciding; banking it would record a choice nobody made.
		expect(isDecisiveTcfEvent({ eventStatus: "cmpuishown" })).toBe(false);
	});
});

type TcfHandler = (tcData: TcData, success: boolean) => void;

describe("subscribeToCmpConsent", () => {
	afterEach(() => {
		delete (globalThis as { window?: unknown }).window;
	});

	function stubWindowWithCmp(api: unknown) {
		(globalThis as { window?: unknown }).window = { __tcfapi: api };
	}

	it("is an inert no-op when no CMP is on the page", () => {
		(globalThis as { window?: unknown }).window = {};

		const onDecision = vi.fn();
		const unsubscribe = subscribeToCmpConsent(onDecision);

		expect(() => unsubscribe()).not.toThrow();
		expect(onDecision).not.toHaveBeenCalled();
	});

	it("reports only decisive events to the caller", () => {
		let handler: TcfHandler | undefined;
		stubWindowWithCmp((cmd: string, _v: number, cb: TcfHandler) => {
			if (cmd === "addEventListener") handler = cb;
		});

		const onDecision = vi.fn();
		subscribeToCmpConsent(onDecision);

		handler?.({ eventStatus: "cmpuishown", gdprApplies: true }, true);
		expect(onDecision).not.toHaveBeenCalled();

		handler?.(
			{
				eventStatus: "useractioncomplete",
				gdprApplies: true,
				purpose: { consents: { 1: true } },
			},
			true,
		);
		expect(onDecision).toHaveBeenCalledWith(true);
	});

	it("ignores callbacks the CMP reports as failed", () => {
		let handler: TcfHandler | undefined;
		stubWindowWithCmp((cmd: string, _v: number, cb: TcfHandler) => {
			if (cmd === "addEventListener") handler = cb;
		});

		const onDecision = vi.fn();
		subscribeToCmpConsent(onDecision);

		handler?.({ eventStatus: "tcloaded" }, false);
		expect(onDecision).not.toHaveBeenCalled();
	});

	it("unsubscribes with the listener id the CMP handed back", () => {
		const calls: Array<{ cmd: string; listenerId?: number }> = [];
		let handler: TcfHandler | undefined;
		stubWindowWithCmp(
			(cmd: string, _v: number, cb: TcfHandler, listenerId?: number) => {
				calls.push({ cmd, listenerId });
				if (cmd === "addEventListener") handler = cb;
			},
		);

		const unsubscribe = subscribeToCmpConsent(vi.fn());
		handler?.({ eventStatus: "tcloaded", listenerId: 7 }, true);
		unsubscribe();

		expect(calls).toContainEqual({ cmd: "removeEventListener", listenerId: 7 });
	});
});
