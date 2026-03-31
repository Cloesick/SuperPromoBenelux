import crypto from "crypto";
import fs from "fs";
import path from "path";

import { scrapers } from "./scrapers";
import { getSupabaseAdmin } from "../lib/supabaseAdmin";
import type { ScrapedData } from "../lib/types";

const DATA_DIR = path.join(process.cwd(), "data", "folders");

function sha256(input: string): string {
	return crypto.createHash("sha256").update(input).digest("hex");
}

function readScrapedJson(retailerSlug: string): ScrapedData {
	const filePath = path.join(DATA_DIR, `${retailerSlug}.json`);
	if (!fs.existsSync(filePath)) {
		throw new Error(`Scraped JSON not found at ${filePath}`);
	}
	const raw = fs.readFileSync(filePath, "utf-8");
	return JSON.parse(raw) as ScrapedData;
}

function writeScrapedJson(retailerSlug: string, data: ScrapedData): void {
	if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
	const filePath = path.join(DATA_DIR, `${retailerSlug}.json`);
	fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf-8");
}

async function fetchLastSuccessfulScrapedData(args: {
	supabase: ReturnType<typeof getSupabaseAdmin>;
	retailerSlug: string;
}): Promise<ScrapedData | null> {
	const { data, error } = await args.supabase
		.from("scrape_runs")
		.select("scraped_data")
		.eq("retailer_slug", args.retailerSlug)
		.eq("status", "scrape_success")
		.not("scraped_data", "is", null)
		.order("finished_at", { ascending: false })
		.limit(1)
		.maybeSingle();

	if (error) {
		throw new Error(`Failed to fetch last successful scrape: ${error.message}`);
	}

	if (!data?.scraped_data) return null;
	return data.scraped_data as ScrapedData;
}

async function upsertFingerprint(args: {
	supabase: ReturnType<typeof getSupabaseAdmin>;
	retailerSlug: string;
	fingerprintHash: string;
	source: string;
	embedUrl?: string;
	pdfUrl?: string;
}): Promise<void> {
	const { error } = await args.supabase
		.from("retailer_folder_fingerprints")
		.upsert(
			{
				retailer_slug: args.retailerSlug,
				fingerprint: args.fingerprintHash,
				source: args.source,
				embed_url: args.embedUrl ?? null,
				pdf_url: args.pdfUrl ?? null,
				updated_at: new Date().toISOString(),
			},
			{ onConflict: "retailer_slug" },
		);

	if (error) throw new Error(`Failed to upsert fingerprint: ${error.message}`);
}

async function getExistingFingerprint(args: {
	supabase: ReturnType<typeof getSupabaseAdmin>;
	retailerSlug: string;
}): Promise<string | null> {
	const { data, error } = await args.supabase
		.from("retailer_folder_fingerprints")
		.select("fingerprint")
		.eq("retailer_slug", args.retailerSlug)
		.maybeSingle();

	if (error) throw new Error(`Failed to read fingerprint: ${error.message}`);
	return data?.fingerprint ?? null;
}

async function insertRun(args: {
	supabase: ReturnType<typeof getSupabaseAdmin>;
	runId: string;
	retailerSlug: string;
	status: string;
	message?: string;
	fingerprint?: string;
	embedUrl?: string;
	pdfUrl?: string;
	scrapedData?: unknown;
	finished: boolean;
}): Promise<number> {
	const payload: any = {
		run_id: args.runId,
		retailer_slug: args.retailerSlug,
		status: args.status,
		message: args.message ?? null,
		fingerprint: args.fingerprint ?? null,
		embed_url: args.embedUrl ?? null,
		pdf_url: args.pdfUrl ?? null,
		scraped_data: args.scrapedData ?? null,
		started_at: new Date().toISOString(),
		finished_at: args.finished ? new Date().toISOString() : null,
	};

	const { data, error } = await args.supabase
		.from("scrape_runs")
		.insert(payload)
		.select("id")
		.single();
	if (error) throw new Error(`Failed to insert scrape run: ${error.message}`);
	return data.id as number;
}

async function updateRun(args: {
	supabase: ReturnType<typeof getSupabaseAdmin>;
	runRowId: number;
	status: string;
	message?: string;
	fingerprint?: string;
	embedUrl?: string;
	pdfUrl?: string;
	scrapedData?: unknown;
	finished: boolean;
}): Promise<void> {
	const payload: any = {
		status: args.status,
		message: args.message ?? null,
		fingerprint: args.fingerprint ?? null,
		embed_url: args.embedUrl ?? null,
		pdf_url: args.pdfUrl ?? null,
		scraped_data: args.scrapedData ?? null,
	};

	if (args.finished) {
		payload.finished_at = new Date().toISOString();
	}

	const { error } = await args.supabase
		.from("scrape_runs")
		.update(payload)
		.eq("id", args.runRowId);
	if (error) throw new Error(`Failed to update scrape run: ${error.message}`);
}

async function main() {
	const supabase = getSupabaseAdmin();
	const target = process.argv[2];
	const runId = `monitor-${new Date().toISOString()}`;

	const toMonitor = target
		? scrapers.filter((s) => s.retailerSlug === target)
		: scrapers;

	if (toMonitor.length === 0) {
		console.error(`Unknown retailer: ${target}`);
		console.log(`Available: ${scrapers.map((s) => s.retailerSlug).join(", ")}`);
		process.exit(1);
	}

	console.log(`Monitoring ${toMonitor.length} retailer(s)...\n`);

	for (const scraper of toMonitor) {
		const slug = scraper.retailerSlug;
		console.log(`[${slug}] Probing fingerprint...`);

		let runRowId: number | null = null;

		try {
			runRowId = await insertRun({
				supabase,
				runId,
				retailerSlug: slug,
				status: "started",
				message: "Monitor started",
				finished: false,
			});

			const probe = await scraper.probeFingerprint();
			const fingerprintHash = sha256(probe.fingerprint);

			const existing = await getExistingFingerprint({
				supabase,
				retailerSlug: slug,
			});

			const changed = !existing || existing !== fingerprintHash;
			console.log(
				`[${slug}] ${existing ? "Existing" : "No existing"} fingerprint; changed=${changed}`,
			);

			if (!changed) {
				// Fallback: if local file is missing, restore last known good scrape.
				const localPath = path.join(DATA_DIR, `${slug}.json`);
				if (!fs.existsSync(localPath)) {
					const last = await fetchLastSuccessfulScrapedData({
						supabase,
						retailerSlug: slug,
					});
					if (last) {
						writeScrapedJson(slug, last);
						console.log(
							`[${slug}] Restored local JSON from last successful scrape`,
						);
					}
				}

				await updateRun({
					supabase,
					runRowId: runRowId!,
					status: "no_change",
					message: "Fingerprint unchanged; scrape skipped",
					fingerprint: fingerprintHash,
					embedUrl: probe.embedUrl,
					pdfUrl: probe.pdfUrl,
					finished: true,
				});
				continue;
			}

			await updateRun({
				supabase,
				runRowId: runRowId!,
				status: "change_detected",
				message: "Fingerprint changed; running full scrape",
				fingerprint: fingerprintHash,
				embedUrl: probe.embedUrl,
				pdfUrl: probe.pdfUrl,
				finished: false,
			});

			await scraper.run();
			const scrapedData = readScrapedJson(slug);

			await upsertFingerprint({
				supabase,
				retailerSlug: slug,
				fingerprintHash,
				source: probe.source,
				embedUrl: probe.embedUrl,
				pdfUrl: probe.pdfUrl,
			});

			await updateRun({
				supabase,
				runRowId: runRowId!,
				status: "scrape_success",
				message: "Scrape completed and uploaded to Supabase",
				fingerprint: fingerprintHash,
				embedUrl: probe.embedUrl,
				pdfUrl: probe.pdfUrl,
				scrapedData,
				finished: true,
			});

			console.log(`[${slug}] Scrape uploaded to Supabase`);
		} catch (e) {
			const msg = e instanceof Error ? e.message : String(e);
			console.error(`[${slug}] Monitor error: ${msg}`);

			// Fallback: ensure there is always renderable local JSON.
			try {
				const last = await fetchLastSuccessfulScrapedData({
					supabase,
					retailerSlug: slug,
				});
				if (last) {
					writeScrapedJson(slug, last);
					console.log(
						`[${slug}] Restored local JSON from last successful scrape after error`,
					);
				}
			} catch {
				// ignore
			}

			try {
				if (runRowId) {
					await updateRun({
						supabase,
						runRowId,
						status: "error",
						message: msg,
						finished: true,
					});
				} else {
					await insertRun({
						supabase,
						runId,
						retailerSlug: slug,
						status: "error",
						message: msg,
						finished: true,
					});
				}
			} catch {
				// ignore
			}
		}

		console.log("");
	}
}

main().catch((e) => {
	console.error(e);
	process.exit(1);
});
