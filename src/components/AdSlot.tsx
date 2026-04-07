"use client";

import { useEffect, useRef, type CSSProperties } from "react";

type AdSlotProps = {
	client: string | undefined;
	slotId: string | undefined;
	className?: string;
	style?: CSSProperties;
};

declare global {
	interface Window {
		adsbygoogle?: unknown[];
	}
}

export function AdSlot({ client, slotId, className, style }: AdSlotProps) {
	const pushedRef = useRef(false);

	useEffect(() => {
		if (pushedRef.current) return;
		if (!client || !slotId) return;

		try {
			window.adsbygoogle = window.adsbygoogle ?? [];
			window.adsbygoogle.push({});
			pushedRef.current = true;
		} catch {
			return;
		}
	}, [client, slotId]);

	if (!client || !slotId) return null;

	return (
		<ins
			className={"adsbygoogle " + (className ?? "")}
			style={{ display: "block", ...style }}
			data-ad-client={client}
			data-ad-slot={slotId}
			data-ad-format="auto"
			data-full-width-responsive="true"
		/>
	);
}
