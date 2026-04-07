"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { AdSlot } from "@/components/AdSlot";

const CONSENT_KEY = "sp_cookie_consent";

function hasConsent(): boolean {
	if (typeof window === "undefined") return false;
	return window.localStorage.getItem(CONSENT_KEY) === "accepted";
}

function parseSlots(v: string | undefined): string[] {
	if (!v) return [];
	return v
		.split(",")
		.map((s) => s.trim())
		.filter(Boolean);
}

type AdPlacementPosition = "top" | "mid" | "bottom";

function shouldExcludePath(pathname: string): boolean {
	const raw = process.env.NEXT_PUBLIC_ADSENSE_EXCLUDE_PATH_PREFIXES;
	if (!raw) return false;

	const prefixes = raw
		.split(",")
		.map((s) => s.trim())
		.filter(Boolean);

	return prefixes.some((p) => pathname === p || pathname.startsWith(p));
}

function getReservedMinHeight(position: AdPlacementPosition): number {
	if (position === "top") return 120;
	if (position === "mid") return 280;
	return 280;
}

function pickSlotIds(pathname: string, position: AdPlacementPosition): string[] {
	if (pathname === "/") {
		return parseSlots(
			(position === "top"
				? process.env.NEXT_PUBLIC_ADSENSE_SLOTS_HOME_TOP
				: position === "mid"
					? process.env.NEXT_PUBLIC_ADSENSE_SLOTS_HOME_MID
					: process.env.NEXT_PUBLIC_ADSENSE_SLOTS_HOME_BOTTOM) ??
				process.env.NEXT_PUBLIC_ADSENSE_SLOTS_HOME ??
				process.env.NEXT_PUBLIC_ADSENSE_SLOT_HOME,
		);
	}

	if (pathname === "/folders") {
		return parseSlots(
			(position === "top"
				? process.env.NEXT_PUBLIC_ADSENSE_SLOTS_FOLDERS_TOP
				: position === "mid"
					? process.env.NEXT_PUBLIC_ADSENSE_SLOTS_FOLDERS_MID
					: process.env.NEXT_PUBLIC_ADSENSE_SLOTS_FOLDERS_BOTTOM) ??
				process.env.NEXT_PUBLIC_ADSENSE_SLOTS_FOLDERS ??
				process.env.NEXT_PUBLIC_ADSENSE_SLOT_FOLDERS,
		);
	}

	if (pathname.startsWith("/folders/")) {
		return parseSlots(
			(position === "top"
				? process.env.NEXT_PUBLIC_ADSENSE_SLOTS_FOLDER_DETAIL_TOP
				: position === "mid"
					? process.env.NEXT_PUBLIC_ADSENSE_SLOTS_FOLDER_DETAIL_MID
					: process.env.NEXT_PUBLIC_ADSENSE_SLOTS_FOLDER_DETAIL_BOTTOM) ??
				process.env.NEXT_PUBLIC_ADSENSE_SLOTS_FOLDER_DETAIL ??
				process.env.NEXT_PUBLIC_ADSENSE_SLOT_FOLDER_DETAIL,
		);
	}

	if (pathname === "/nl-grensstreek") {
		return parseSlots(
			(position === "top"
				? process.env.NEXT_PUBLIC_ADSENSE_SLOTS_NL_BORDER_TOP
				: position === "mid"
					? process.env.NEXT_PUBLIC_ADSENSE_SLOTS_NL_BORDER_MID
					: process.env.NEXT_PUBLIC_ADSENSE_SLOTS_NL_BORDER_BOTTOM) ??
				process.env.NEXT_PUBLIC_ADSENSE_SLOTS_NL_BORDER ??
				process.env.NEXT_PUBLIC_ADSENSE_SLOT_NL_BORDER,
		);
	}

	if (pathname.startsWith("/nl-grensstreek/")) {
		return parseSlots(
			(position === "top"
				? process.env.NEXT_PUBLIC_ADSENSE_SLOTS_NL_BORDER_DETAIL_TOP
				: position === "mid"
					? process.env.NEXT_PUBLIC_ADSENSE_SLOTS_NL_BORDER_DETAIL_MID
					: process.env.NEXT_PUBLIC_ADSENSE_SLOTS_NL_BORDER_DETAIL_BOTTOM) ??
				process.env.NEXT_PUBLIC_ADSENSE_SLOTS_NL_BORDER_DETAIL ??
				process.env.NEXT_PUBLIC_ADSENSE_SLOT_NL_BORDER_DETAIL,
		);
	}

	return parseSlots(
		(position === "top"
			? process.env.NEXT_PUBLIC_ADSENSE_SLOTS_DEFAULT_TOP
			: position === "mid"
				? process.env.NEXT_PUBLIC_ADSENSE_SLOTS_DEFAULT_MID
				: process.env.NEXT_PUBLIC_ADSENSE_SLOTS_DEFAULT_BOTTOM) ??
			process.env.NEXT_PUBLIC_ADSENSE_SLOTS_DEFAULT ??
			process.env.NEXT_PUBLIC_ADSENSE_SLOT_DEFAULT,
	);
}

export function AdPlacements({ position }: { position: AdPlacementPosition }) {
	const pathname = usePathname() ?? "/";
	const [enabled, setEnabled] = useState(false);

	useEffect(() => {
		const update = () => setEnabled(hasConsent());
		update();

		window.addEventListener("storage", update);
		window.addEventListener("sp_consent_changed", update);
		return () => {
			window.removeEventListener("storage", update);
			window.removeEventListener("sp_consent_changed", update);
		};
	}, []);

	const client = process.env.NEXT_PUBLIC_ADSENSE_CLIENT;

	const slotIds = useMemo(() => pickSlotIds(pathname, position), [pathname, position]);

	if (!enabled) return null;
	if (!client) return null;
	if (pathname.startsWith("/admin")) return null;
	if (shouldExcludePath(pathname)) return null;
	if (slotIds.length === 0) return null;

	return (
		<div className="max-w-6xl mx-auto px-4 py-6">
			{slotIds.map((slotId) => (
				<div
					key={`${pathname}:${position}:${slotId}`}
					className="mb-6 last:mb-0"
					style={{ minHeight: getReservedMinHeight(position) }}
				>
					<AdSlot client={client} slotId={slotId} />
				</div>
			))}
		</div>
	);
}
