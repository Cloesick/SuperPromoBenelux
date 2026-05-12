"use client";

import { useCallback, useMemo, useState } from "react";
import { RetailerCard } from "@/components/RetailerCard";
import type { Retailer } from "@/lib/types";
import type { LatLng } from "@/lib/geo";
import { getNearestStoreDistanceKm, getNearestStores } from "@/lib/stores";
import { NearMeFilter } from "@/components/NearMeFilter";

export function FoldersClient({
	retailers,
	basePath = "",
}: {
	retailers: Retailer[];
	basePath?: string;
}) {
	const [userLocation, setUserLocation] = useState<{
		label: string;
		location: LatLng;
	} | null>(null);

	const onLocationChange = useCallback(
		(v: { label: string; location: LatLng } | null) => {
			setUserLocation(v);
		},
		[],
	);

	const retailersSorted = useMemo(() => {
		if (!userLocation) return retailers;

		const loc = userLocation.location;
		return [...retailers].sort((a, b) => {
			const da = getNearestStoreDistanceKm(a.slug, loc);
			const db = getNearestStoreDistanceKm(b.slug, loc);

			const aHas = da !== null;
			const bHas = db !== null;
			if (aHas && !bHas) return -1;
			if (!aHas && bHas) return 1;
			if (!aHas && !bHas) return a.name.localeCompare(b.name);
			return (da ?? 0) - (db ?? 0);
		});
	}, [retailers, userLocation]);

	const supermarkten = useMemo(
		() => retailersSorted.filter((r: Retailer) => r.category === "supermarkt"),
		[retailersSorted],
	);
	const discounters = useMemo(
		() => retailersSorted.filter((r: Retailer) => r.category === "discounter"),
		[retailersSorted],
	);

	const nearest = useMemo(() => {
		if (!userLocation) return [];
		return getNearestStores(userLocation.location, 6);
	}, [userLocation]);

	return (
		<>
			<NearMeFilter onChange={onLocationChange} />

			{userLocation && nearest.length > 0 ? (
				<section className="mb-10">
					<h2 className="text-xl font-bold text-gray-900 mb-4">
						Winkels bij jou in de buurt
					</h2>
					<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
						{nearest.map((s: (typeof nearest)[number]) => (
							<div
								key={s.id}
								className="bg-white border border-gray-200 rounded-xl p-4"
							>
								<div className="font-semibold text-gray-900">{s.name}</div>
								<div className="text-sm text-gray-600">
									{s.postalCode ? `${s.postalCode} ` : ""}
									{s.city}
								</div>
								<div className="text-sm text-gray-600">
									{Math.round(s.distanceKm * 10) / 10} km
								</div>
							</div>
						))}
					</div>
				</section>
			) : null}

			<div>
				<h2 className="text-xl font-bold text-gray-900 mb-4">Supermarkten</h2>
				<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
					{supermarkten.map((retailer: Retailer) => (
						<div key={retailer.slug}>
							<RetailerCard retailer={retailer} basePath={basePath} />
						</div>
					))}
				</div>
			</div>

			{discounters.length > 0 && (
				<div>
					<h2 className="text-xl font-bold text-gray-900 mb-4">Discounters</h2>
					<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
						{discounters.map((retailer: Retailer) => (
							<div key={retailer.slug}>
								<RetailerCard retailer={retailer} basePath={basePath} />
							</div>
						))}
					</div>
				</div>
			)}
		</>
	);
}
