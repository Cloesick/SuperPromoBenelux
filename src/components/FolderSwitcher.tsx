"use client";

import { useState } from "react";
import { Calendar } from "lucide-react";
import { Folder, Retailer } from "@/lib/types";
import { FolderViewer } from "./FolderViewer";

interface FolderSwitcherProps {
	folders: Folder[];
	retailer: Retailer;
}

// Default to the folder that's valid today, else the first one.
function pickDefault(folders: Folder[]): number {
	const now = Date.now();
	const idx = folders.findIndex((f) => {
		try {
			const from = new Date(f.validFrom).getTime();
			const until = new Date(f.validUntil + "T23:59:59").getTime();
			return now >= from && now <= until;
		} catch {
			return false;
		}
	});
	return idx >= 0 ? idx : 0;
}

function formatRange(folder: Folder): string {
	try {
		const opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "short" };
		const from = new Date(folder.validFrom).toLocaleDateString("nl-BE", opts);
		const until = new Date(folder.validUntil).toLocaleDateString("nl-BE", opts);
		return `${from} – ${until}`;
	} catch {
		return "";
	}
}

export function FolderSwitcher({ folders, retailer }: FolderSwitcherProps) {
	const [active, setActive] = useState(() => pickDefault(folders));

	if (folders.length === 0) return null;
	const selected = folders[active] ?? folders[0];

	return (
		<div>
			{folders.length > 1 && (
				<div className="mb-6">
					<p className="text-sm font-medium text-gray-500 mb-2">
						{folders.length} folders beschikbaar bij {retailer.name}
					</p>
					<div
						className="flex flex-wrap gap-2"
						role="tablist"
						aria-label={`${retailer.name} folders`}
					>
						{folders.map((f, i) => (
							<button
								key={f.id}
								type="button"
								role="tab"
								aria-selected={i === active}
								onClick={() => setActive(i)}
								className={`flex flex-col items-start gap-0.5 px-4 py-2.5 rounded-xl border text-left transition ${
									i === active
										? "bg-blue-700 text-white border-blue-700 shadow-sm"
										: "bg-white text-gray-700 border-gray-200 hover:border-blue-300 hover:bg-blue-50"
								}`}
							>
								<span className="text-sm font-semibold">{f.title}</span>
								<span
									className={`flex items-center gap-1 text-xs ${
										i === active ? "text-blue-100" : "text-gray-500"
									}`}
								>
									<Calendar className="w-3 h-3" suppressHydrationWarning />
									{formatRange(f)}
								</span>
							</button>
						))}
					</div>
				</div>
			)}

			<FolderViewer folder={selected} retailer={retailer} />
		</div>
	);
}
