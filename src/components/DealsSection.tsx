"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import type { Deal, Retailer } from "@/lib/types";

type Props = {
	retailer: Retailer;
	deals: Deal[];
	fallbackPages?: { pageNumber: number; imageUrl: string }[];
};

export function DealsSection({ retailer, deals, fallbackPages }: Props) {
	const [trackingEnabled, setTrackingEnabled] = useState(false);
	const sentRef = useRef<Set<string>>(new Set());

	useEffect(() => {
		const hasConsent = () => {
			if (typeof document === "undefined") return false;
			return document.cookie
				.split(";")
				.map((c) => c.trim())
				.some(
					(c) =>
						c === "sp_cookie_consent=accepted" ||
						c.startsWith("sp_cookie_consent=accepted"),
				);
		};

		const update = () => setTrackingEnabled(hasConsent());
		update();

		window.addEventListener("sp_consent_changed", update);
		window.addEventListener("storage", update);
		return () => {
			window.removeEventListener("sp_consent_changed", update);
			window.removeEventListener("storage", update);
		};
	}, []);

	const trackDealClick = (deal: Deal) => {
		if (!trackingEnabled) return;
		if (typeof window === "undefined") return;

		const destinationUrl = deal.affiliateUrl;
		const key = `deal_click:${deal.id}:${destinationUrl ?? ""}`;
		if (sentRef.current.has(key)) return;
		sentRef.current.add(key);

		void fetch("/api/engagement", {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
			},
			body: JSON.stringify({
				event: "deal_click",
				retailer: retailer.slug,
				path: window.location.pathname,
				destinationUrl,
			}),
			keepalive: true,
		}).catch(() => {
			return;
		});
	};

	return (
		<section className="mt-8">
			<h2 className="text-xl font-bold text-gray-900 mb-4">Producten</h2>
			{deals.length > 0 ? (
				<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
					{deals.slice(0, 24).map((d) => {
						const href = d.affiliateUrl || `#folder-viewer`;
						return (
							<a
								key={d.id}
								href={href}
								target={d.affiliateUrl ? "_blank" : undefined}
								rel={d.affiliateUrl ? "noopener noreferrer sponsored" : undefined}
								onClick={() => trackDealClick(d)}
								className="bg-white border border-gray-200 rounded-xl p-4 hover:border-blue-300 transition"
							>
								{d.imageUrl ? (
									<Image
										src={d.imageUrl}
										alt={d.product}
										width={400}
										height={250}
										className="w-full h-40 object-cover rounded-lg mb-3"
									/>
								) : null}
								<div className="font-semibold text-gray-900">{d.product}</div>
								<div className="text-sm text-gray-600 mt-1">
									{typeof d.promoPrice === "number" ? (
										<span className="font-semibold text-green-700">
											€ {d.promoPrice.toFixed(2)}
										</span>
									) : null}
									{typeof d.originalPrice === "number" ? (
										<span className="ml-2 line-through">
											€ {d.originalPrice.toFixed(2)}
										</span>
									) : null}
									{d.discount ? (
										<span className="ml-2 text-blue-700">{d.discount}</span>
									) : null}
								</div>
								{d.description ? (
									<div className="text-sm text-gray-600 mt-2">{d.description}</div>
								) : null}
							</a>
						);
					})}
				</div>
			) : (fallbackPages?.length ?? 0) > 0 ? (
				<div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
					{fallbackPages?.slice(0, 12).map((p) => (
						<a
							key={p.pageNumber}
							href="#folder-viewer"
							className="bg-white border border-gray-200 rounded-xl overflow-hidden hover:border-blue-300 transition"
						>
							<Image
								src={p.imageUrl}
								alt={`Pagina ${p.pageNumber}`}
								width={400}
								height={520}
								className="w-full h-40 object-cover"
							/>
							<div className="p-3 text-sm text-gray-800 font-medium">
								Pagina {p.pageNumber}
							</div>
						</a>
					))}
				</div>
			) : (
				<div className="bg-gray-50 border border-gray-200 rounded-xl p-6 text-sm text-gray-700">
					Bekijk de folder hieronder voor de actuele promoties.
				</div>
			)}
		</section>
	);
}
