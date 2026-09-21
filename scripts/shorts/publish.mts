#!/usr/bin/env tsx
// ---------------------------------------------------------------------------
// Post the week's shorts through Zernio, one post per platform.
//
//   npx tsx scripts/shorts/publish.mts <week> [slug ...]
//
// DRY RUN unless AUTO_PUBLISH=true: it prints exactly what it would post and
// touches nothing. With AUTO_PUBLISH=true and ZERNIO_API_KEY it uploads each
// short and posts it to every connected platform.
//
// Nothing goes out unless publishBlocker() clears it against the folder the
// site serves: same folder id, not expired, at least two days left, a real
// price on the hero. Posted ids are written to published.json, so a re-run
// never posts twice.
//
// Environment
//   AUTO_PUBLISH             "true" to post; anything else is a dry run
//   ZERNIO_API_KEY           Zernio API key (sk_...)
//   SHORTS_PLATFORMS         default "youtube tiktok instagram facebook"
//   SHORTS_REDDIT_SUBREDDIT  reddit only posts when set (no "r/"); pick a
//                            community whose rules allow deal posts
//   SHORTS_POST_TIME         local Brussels time to schedule, default 17:30
// ---------------------------------------------------------------------------

import fs from "node:fs";
import path from "node:path";
import { Brief, publishBlocker } from "../../src/shorts/brief";
import { type Platform, postCopy } from "../../src/shorts/captions";

const API = "https://zernio.com/api/v1";
const [week, ...only] = process.argv.slice(2);
if (!week) {
	console.error("usage: publish.mts <week> [slug ...]");
	process.exit(1);
}

const live = process.env.AUTO_PUBLISH === "true";
const key = process.env.ZERNIO_API_KEY;
const subreddit = process.env.SHORTS_REDDIT_SUBREDDIT?.replace(/^r\//, "");
const platforms = (process.env.SHORTS_PLATFORMS ?? "youtube tiktok instagram facebook")
	.split(/[\s,]+/)
	.filter(Boolean)
	.concat(subreddit ? ["reddit"] : []) as Platform[];

async function api<T>(method: string, p: string, body?: unknown): Promise<T> {
	const r = await fetch(API + p, {
		method,
		headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
		body: body ? JSON.stringify(body) : undefined,
	});
	const text = await r.text();
	if (!r.ok) throw new Error(`${method} ${p} → ${r.status} ${text.slice(0, 300)}`);
	return (text ? JSON.parse(text) : {}) as T;
}

async function upload(file: string): Promise<string> {
	const bytes = fs.readFileSync(file);
	const pre = await api<{ uploadUrl: string; publicUrl: string }>("POST", "/media/presign", {
		filename: path.basename(file),
		contentType: "video/mp4",
		size: bytes.length,
	});
	const put = await fetch(pre.uploadUrl, { method: "PUT", headers: { "Content-Type": "video/mp4" }, body: bytes });
	if (!put.ok) throw new Error(`upload PUT → ${put.status}`);
	return pre.publicUrl;
}

/** Today at SHORTS_POST_TIME in Brussels, or null once that time has passed. */
function scheduleSlot(): string | null {
	const [hh, mm] = (process.env.SHORTS_POST_TIME ?? "17:30").split(":").map(Number);
	const now = new Date();
	const brussels = new Intl.DateTimeFormat("en-CA", {
		timeZone: "Europe/Brussels", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false,
	}).formatToParts(now);
	const get = (t: string) => brussels.find((p) => p.type === t)!.value;
	const nowMin = Number(get("hour")) * 60 + Number(get("minute"));
	if (nowMin >= hh * 60 + mm - 5) return null;
	return `${get("year")}-${get("month")}-${get("day")}T${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}:00`;
}

function platformBody(p: Platform, accountId: string, brief: Brief) {
	const copy = postCopy(brief, p);
	const target: Record<string, unknown> = { platform: p, accountId };
	const extra: Record<string, unknown> = {};
	if (p === "youtube") target.platformSpecificData = { title: copy.title, visibility: "public", madeForKids: false, categoryId: "22" };
	if (p === "reddit") target.platformSpecificData = { subreddit, title: copy.title };
	if (p === "tiktok")
		// The account owner chose unattended posting; these confirm it on
		// their behalf, as TikTok's content-posting rules require.
		extra.tiktokSettings = {
			privacy_level: "PUBLIC_TO_EVERYONE",
			allow_comment: true,
			allow_duet: false,
			allow_stitch: false,
			content_preview_confirmed: true,
			express_consent_given: true,
		};
	return { copy, target, extra };
}

async function main() {
	const weekDir = path.join("data", "shorts", week);
	if (!fs.existsSync(weekDir)) {
		console.log(`No shorts for ${week}.`);
		return;
	}
	if (live && !key) throw new Error("AUTO_PUBLISH=true but ZERNIO_API_KEY is not set");
	console.log(live ? `LIVE: posting ${week} to ${platforms.join(", ")}` : `DRY RUN for ${week} (set AUTO_PUBLISH=true to post)`);

	const accounts: Record<string, string> = {};
	if (key) {
		const { accounts: list } = await api<{ accounts: { _id: string; platform: string; isActive?: boolean }[] }>("GET", "/accounts");
		for (const a of list) if (a.isActive !== false && !accounts[a.platform]) accounts[a.platform] = a._id;
	}
	const slot = scheduleSlot();
	let failed = 0;

	for (const slug of only.length ? only : fs.readdirSync(weekDir)) {
		const dir = path.join(weekDir, slug);
		const video = path.join(dir, "short.mp4");
		if (!fs.existsSync(path.join(dir, "brief.json")) || !fs.existsSync(video)) continue;
		const brief = Brief.parse(JSON.parse(fs.readFileSync(path.join(dir, "brief.json"), "utf-8")));

		const folderFile = path.join("data", "folders", `${slug}.json`);
		const folders = fs.existsSync(folderFile) ? JSON.parse(fs.readFileSync(folderFile, "utf-8")).folders ?? [] : [];
		const folder = folders.find((f: { id: string }) => f.id === brief.folderId) ?? folders[0] ?? null;
		const blocked = publishBlocker(brief, folder);
		if (blocked) {
			console.log(`⊘ ${slug.padEnd(14)} not posted: ${blocked}`);
			continue;
		}

		const doneFile = path.join(dir, "published.json");
		const done: Record<string, string> = fs.existsSync(doneFile) ? JSON.parse(fs.readFileSync(doneFile, "utf-8")) : {};
		let mediaUrl: string | null = null;

		for (const p of platforms) {
			if (done[p]) {
				console.log(`= ${slug.padEnd(14)} ${p}: already posted (${done[p]})`);
				continue;
			}
			const accountId = accounts[p];
			if (key && !accountId) {
				console.log(`- ${slug.padEnd(14)} ${p}: no connected ${p} account in Zernio`);
				continue;
			}
			const { copy, target, extra } = platformBody(p, accountId ?? "<account>", brief);
			if (!live) {
				console.log(`· ${slug.padEnd(14)} ${p}: ${copy.title ?? copy.caption.split("\n")[0]}`);
				continue;
			}
			try {
				mediaUrl ??= await upload(video);
				const res = await api<{ post: { _id: string } }>("POST", "/posts", {
					content: copy.caption,
					mediaItems: [{ type: "video", url: mediaUrl }],
					platforms: [target],
					...extra,
					...(slot ? { scheduledFor: slot, timezone: "Europe/Brussels" } : { publishNow: true }),
				});
				done[p] = res.post._id;
				fs.writeFileSync(doneFile, JSON.stringify(done, null, 2) + "\n");
				console.log(`✓ ${slug.padEnd(14)} ${p}: ${slot ? `scheduled ${slot}` : "published"} (${res.post._id})`);
			} catch (e) {
				failed++;
				console.error(`✗ ${slug.padEnd(14)} ${p}: ${(e as Error).message}`);
			}
		}
	}
	if (failed) process.exitCode = 1;
}

await main();
