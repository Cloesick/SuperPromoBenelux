"use client";

import { useEffect } from "react";

interface AdBannerProps {
	adSlot: string;
	adFormat?: string;
	fullWidthResponsive?: boolean;
}

export function AdBanner({
	adSlot,
	adFormat = "auto",
	fullWidthResponsive = true,
}: AdBannerProps) {
	useEffect(() => {
		try {
			const w = window as typeof window & { adsbygoogle?: unknown[] };
			(w.adsbygoogle = w.adsbygoogle || []).push({});
		} catch (err) {
			console.error("AdSense error:", err);
		}
	}, []);

	return (
		<div className="my-8 flex justify-center">
			<ins
				className="adsbygoogle"
				style={{ display: "block" }}
				data-ad-client="ca-pub-XXXXXXXXXX"
				data-ad-slot={adSlot}
				data-ad-format={adFormat}
				data-full-width-responsive={fullWidthResponsive.toString()}
			/>
		</div>
	);
}
