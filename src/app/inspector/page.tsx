"use client";

import { useEffect, useMemo, useState } from "react";

type InspectorScraperConfig = {
	slug: string;
	folderUrls: string[];
	dealUrls: string[];
	cookieSelectors: string[];
	sourceFile: string;
};

type InspectorRetailer = {
	project: string;
	slug: string;
	name?: string;
	category?: string;
	website?: string;
	logo?: string;
	color?: string;
	scraper?: InspectorScraperConfig;
};

type InspectorResponse = {
	generatedAt: string;
	projects: string[];
	count: number;
	retailers: InspectorRetailer[];
};

type CoverageCheck = {
	project: string;
	slug: string;
	hasScraper: boolean;
	hasFolderUrls: boolean;
	hasDataFile: boolean;
	folderCount: number;
	hasCurrentFolder: boolean;
	renderable: boolean;
	contentSource?: string;
	dealCount: number;
	failing: boolean;
	failureReasons: string[];
	methods?: string[];
	scrapedAt?: string;
	filePath?: string;
};

type CoverageChecksResponse = {
	generatedAt: string;
	projects: string[];
	requireDeals: boolean;
	count: number;
	failingCount: number;
	checks: CoverageCheck[];
};

type ChecklistState = Record<string, boolean>;

const DEFAULT_TEST_CASES: { id: string; label: string }[] = [
	{ id: "open-website", label: "Website opent zonder blokkade" },
	{ id: "cookie", label: "Cookie consent is weg te klikken" },
	{ id: "folder-url", label: "Folder URL toont promoties/folder" },
	{ id: "deal-url", label: "Deal URL toont promo items (indien aanwezig)" },
	{ id: "viewer", label: "Folder viewer werkt (embed/pdf/screenshot)" },
	{ id: "prices", label: "Prijzen/producten worden gevonden (optioneel)" },
];

function checklistKey(retailer: InspectorRetailer) {
	return `inspector:${retailer.project}:${retailer.slug}`;
}

function loadChecklist(key: string): ChecklistState {
	try {
		const raw = localStorage.getItem(key);
		if (!raw) return {};
		const parsed = JSON.parse(raw);
		return parsed && typeof parsed === "object"
			? (parsed as ChecklistState)
			: {};
	} catch {
		return {};
	}
}

function saveChecklist(key: string, state: ChecklistState) {
	try {
		localStorage.setItem(key, JSON.stringify(state));
	} catch {
		// ignore
	}
}

export default function InspectorPage() {
	const [data, setData] = useState<InspectorResponse | null>(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [query, setQuery] = useState("");
	const [projectFilter, setProjectFilter] = useState<string>("");
	const [hideWithoutScraper, setHideWithoutScraper] = useState(false);
	const [onlyFailing, setOnlyFailing] = useState(false);
	const [requireDeals, setRequireDeals] = useState(false);
	const [checksLoading, setChecksLoading] = useState(false);
	const [checksError, setChecksError] = useState<string | null>(null);
	const [checksData, setChecksData] = useState<CoverageChecksResponse | null>(
		null,
	);

	useEffect(() => {
		let cancelled = false;
		async function run() {
			setLoading(true);
			setError(null);
			try {
				const res = await fetch("/api/inspector", { cache: "no-store" });
				if (!res.ok) throw new Error(`HTTP ${res.status}`);
				const json = (await res.json()) as InspectorResponse;
				if (!cancelled) setData(json);
			} catch (e) {
				if (!cancelled) setError(e instanceof Error ? e.message : String(e));
			} finally {
				if (!cancelled) setLoading(false);
			}
		}
		void run();
		return () => {
			cancelled = true;
		};
	}, []);

	const projects = data?.projects ?? [];

	const checksByKey = useMemo(() => {
		const map = new Map<string, CoverageCheck>();
		for (const c of checksData?.checks ?? []) {
			map.set(`${c.project}:${c.slug}`, c);
		}
		return map;
	}, [checksData]);

	const failingKeySet = useMemo(() => {
		const set = new Set<string>();
		for (const c of checksData?.checks ?? []) {
			if (c.failing) set.add(`${c.project}:${c.slug}`);
		}
		return set;
	}, [checksData]);

	const filtered = useMemo(() => {
		const retailers = data?.retailers ?? [];
		const q = query.trim().toLowerCase();

		return retailers
			.filter((r) => (projectFilter ? r.project === projectFilter : true))
			.filter((r) => (hideWithoutScraper ? Boolean(r.scraper) : true))
			.filter((r) =>
				onlyFailing ? failingKeySet.has(`${r.project}:${r.slug}`) : true,
			)
			.filter((r) => {
				if (!q) return true;
				const hay = [
					r.project,
					r.slug,
					r.name ?? "",
					r.category ?? "",
					r.website ?? "",
				]
					.join(" ")
					.toLowerCase();
				return hay.includes(q);
			})
			.sort((a, b) => {
				const pa = a.project.localeCompare(b.project);
				if (pa !== 0) return pa;
				return a.slug.localeCompare(b.slug);
			});
	}, [
		data,
		query,
		projectFilter,
		hideWithoutScraper,
		onlyFailing,
		failingKeySet,
	]);

	async function runCoverageChecks(nextRequireDeals?: boolean) {
		setChecksLoading(true);
		setChecksError(null);
		try {
			const require = nextRequireDeals ?? requireDeals;
			const qp = require ? "?requireDeals=1" : "";
			const res = await fetch(`/api/inspector/checks${qp}`, {
				cache: "no-store",
			});
			if (!res.ok) throw new Error(`HTTP ${res.status}`);
			const json = (await res.json()) as CoverageChecksResponse;
			setChecksData(json);
			setRequireDeals(Boolean(json.requireDeals));
		} catch (e) {
			setChecksError(e instanceof Error ? e.message : String(e));
		} finally {
			setChecksLoading(false);
		}
	}

	return (
		<div className="max-w-6xl mx-auto px-4 py-10">
			<h1 className="text-2xl font-bold text-gray-900">Retailer Inspector</h1>
			<p className="text-gray-600 mt-2">
				Inspecteer retailer URLs en werk test-cases af. Data komt uit jouw
				lokale repos via
				<code className="px-1">/api/inspector</code>.
			</p>

			<div className="mt-6 bg-white border border-gray-200 rounded-xl p-4">
				<div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
					<div>
						<div className="font-semibold text-gray-900">
							Workspace coverage checks
						</div>
						<div className="text-sm text-gray-600">
							Controleert per retailer of er lokaal scraped data bestaat in
							<code className="px-1">data/folders/&lt;slug&gt;.json</code> en of
							er een renderbare folder is (embed/pdf/pages).
						</div>
					</div>
					<div className="flex items-center gap-3">
						<button
							onClick={() => void runCoverageChecks()}
							disabled={checksLoading}
							className="px-4 py-2 rounded-lg bg-blue-700 text-white font-medium disabled:opacity-60"
						>
							{checksLoading ? "Running..." : "Run coverage checks"}
						</button>
						<label className="flex items-center gap-2 text-sm text-gray-700">
							<input
								type="checkbox"
								checked={requireDeals}
								onChange={(e) => {
									const v = e.target.checked;
									setRequireDeals(v);
									void runCoverageChecks(v);
								}}
								disabled={checksLoading}
							/>
							Require products
						</label>
						<label className="flex items-center gap-2 text-sm text-gray-700">
							<input
								type="checkbox"
								checked={onlyFailing}
								onChange={(e) => setOnlyFailing(e.target.checked)}
								disabled={!checksData}
							/>
							Only failing
						</label>
					</div>
				</div>

				<div className="mt-3 text-sm text-gray-600">
					{checksError ? `Fout: ${checksError}` : null}
					{checksData
						? `Gegenereerd: ${new Date(checksData.generatedAt).toLocaleString()} — failing: ${checksData.failingCount}/${checksData.count} — require products: ${checksData.requireDeals ? "yes" : "no"}`
						: "Nog niet uitgevoerd."}
				</div>
			</div>

			<div className="mt-6 grid grid-cols-1 md:grid-cols-4 gap-3">
				<input
					value={query}
					onChange={(e) => setQuery(e.target.value)}
					placeholder="Zoek op slug, naam, categorie, url..."
					className="md:col-span-2 w-full border border-gray-200 rounded-lg px-3 py-2"
				/>
				<select
					value={projectFilter}
					onChange={(e) => setProjectFilter(e.target.value)}
					className="w-full border border-gray-200 rounded-lg px-3 py-2"
				>
					<option value="">Alle projecten</option>
					{projects.map((p) => (
						<option key={p} value={p}>
							{p}
						</option>
					))}
				</select>
				<label className="flex items-center gap-2 text-sm text-gray-700 border border-gray-200 rounded-lg px-3 py-2">
					<input
						type="checkbox"
						checked={hideWithoutScraper}
						onChange={(e) => setHideWithoutScraper(e.target.checked)}
					/>
					Alleen met scraper
				</label>
			</div>

			<div className="mt-4 flex items-center justify-between text-sm text-gray-600">
				<div>
					{loading ? "Laden..." : null}
					{error ? `Fout: ${error}` : null}
					{data
						? `Gegenereerd: ${new Date(data.generatedAt).toLocaleString()}`
						: null}
				</div>
				<div>
					{data ? `${filtered.length} / ${data.count} retailers` : null}
				</div>
			</div>

			<div className="mt-6 space-y-4">
				{filtered.map((r) => (
					<RetailerRow
						key={`${r.project}:${r.slug}`}
						retailer={r}
						check={checksByKey.get(`${r.project}:${r.slug}`)}
					/>
				))}
			</div>
		</div>
	);
}

function RetailerRow({
	retailer,
	check,
}: {
	retailer: InspectorRetailer;
	check: CoverageCheck | undefined;
}) {
	const [checklist, setChecklist] = useState<ChecklistState>({});
	const key = checklistKey(retailer);

	useEffect(() => {
		setChecklist(loadChecklist(key));
	}, [key]);

	const folderUrls = retailer.scraper?.folderUrls ?? [];
	const dealUrls = retailer.scraper?.dealUrls ?? [];

	const failing = check ? check.failing : null;

	const progress = useMemo(() => {
		const total = DEFAULT_TEST_CASES.length;
		const done = DEFAULT_TEST_CASES.filter((t) => checklist[t.id]).length;
		return { done, total };
	}, [checklist]);

	function toggle(id: string) {
		const next = { ...checklist, [id]: !checklist[id] };
		setChecklist(next);
		saveChecklist(key, next);
	}

	return (
		<div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
			<div className="px-5 py-4 flex flex-col md:flex-row md:items-center md:justify-between gap-2">
				<div>
					<div className="flex items-center gap-2">
						<span className="font-semibold text-gray-900">
							{retailer.name ?? retailer.slug}
						</span>
						<span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-700">
							{retailer.project}
						</span>
						<span className="text-xs text-gray-500">{retailer.slug}</span>
						{retailer.category ? (
							<span className="text-xs text-gray-500">
								({retailer.category})
							</span>
						) : null}
						{check ? (
							<span
								className={
									"text-xs px-2 py-0.5 rounded-full " +
									(failing
										? "bg-red-100 text-red-800"
										: "bg-green-100 text-green-800")
								}
							>
								{failing ? "FAIL" : "PASS"}
							</span>
						) : (
							<span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-700">
								checks: n/a
							</span>
						)}
					</div>
					<div className="mt-2 flex flex-wrap gap-2 text-sm">
						{retailer.website ? (
							<a
								href={retailer.website}
								target="_blank"
								rel="noreferrer"
								className="underline text-blue-700"
							>
								Website
							</a>
						) : null}
						{folderUrls.map((u) => (
							<a
								key={u}
								href={u}
								target="_blank"
								rel="noreferrer"
								className="underline text-blue-700"
							>
								Folder
							</a>
						))}
						{dealUrls.map((u) => (
							<a
								key={u}
								href={u}
								target="_blank"
								rel="noreferrer"
								className="underline text-blue-700"
							>
								Deals
							</a>
						))}
						{retailer.scraper ? (
							<span className="text-xs text-gray-500">
								scraper: {retailer.scraper.sourceFile}
							</span>
						) : (
							<span className="text-xs text-amber-700">
								geen scraper gevonden
							</span>
						)}
						{check ? (
							<span className="text-xs text-gray-500">
								folders: {check.folderCount} • deals: {check.dealCount}
								{check.contentSource ? ` • source: ${check.contentSource}` : ""}
							</span>
						) : null}
						{check && failing && check.failureReasons.length > 0 ? (
							<span className="text-xs text-red-700">
								reasons: {check.failureReasons.join(", ")}
							</span>
						) : null}
					</div>
				</div>

				<div className="text-sm text-gray-700">
					<span className="font-medium">Checklist:</span> {progress.done}/
					{progress.total}
				</div>
			</div>

			<div className="border-t border-gray-100 px-5 py-4">
				<div className="grid grid-cols-1 md:grid-cols-2 gap-2">
					{DEFAULT_TEST_CASES.map((t) => (
						<label
							key={t.id}
							className="flex items-center gap-2 text-sm text-gray-800"
						>
							<input
								type="checkbox"
								checked={Boolean(checklist[t.id])}
								onChange={() => toggle(t.id)}
							/>
							{t.label}
						</label>
					))}
				</div>
			</div>
		</div>
	);
}
