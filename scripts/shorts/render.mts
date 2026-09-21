#!/usr/bin/env tsx
// ---------------------------------------------------------------------------
// Render a 15-second vertical short per retailer from its brief.
//
//   npx tsx scripts/shorts/render.mts 2026-w39 [slug ...]
//
// Reads  data/shorts/<week>/<slug>/brief.json
// Writes data/shorts/<week>/<slug>/short.mp4, thumb.jpg, posts.json
//
// Every picture is the retailer's own folder: the cover, and crops of the
// offers the brief located on it. Nothing is generated, so the template can run
// unattended every week at no cost; the Ghibli cooking reel (ChatCut) is the
// separate premium path. Text is laid out as HTML in headless Chrome, so the
// type matches the brand (Playfair Display, gold #e6b25c on cream #f7edda over
// a warm dark scrim), then composited with ffmpeg.
//
// Scenes, 30 fps, 0.5 s cross-dissolves:
//   intro  3.0 s   logo, hook, dates over the cover
//   offer  6.5 s   slow push into the hero offer, price card
//   offer  4.5 s   second offer (when the brief has one)
//   outro  2.5 s   cover + "alle folders op superpromobelgie.com"
// ---------------------------------------------------------------------------

import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { execFileSync } from "node:child_process";
import sharp from "sharp";
import puppeteer, { type Browser } from "rebrowser-puppeteer";
import { Brief, type Box, type Offer } from "../../src/shorts/brief";
import { PLATFORMS, postCopy } from "../../src/shorts/captions";

const W = 1080;
const H = 1920;
const FPS = 30;
const FADE = 0.5;
const GOLD = "#e6b25c";
const CREAM = "#f7edda";

const [week, ...only] = process.argv.slice(2);
if (!week) {
	console.error("usage: render.mts <week e.g. 2026-w39> [slug ...]");
	process.exit(1);
}
const weekDir = path.join("data", "shorts", week);

interface Rect {
	x: number;
	y: number;
	w: number;
	h: number;
}
interface Scene {
	name: string;
	seconds: number;
	/** Blurred, darkened full-frame background. */
	bg: string;
	/** Sharp foreground image and where it sits. */
	fg: string;
	fgRect: Rect;
	/** Transparent 1080x1920 PNG of type and cards. */
	overlay: string;
}

function ff(args: string[]) {
	execFileSync("ffmpeg", ["-v", "error", "-y", ...args], { stdio: "inherit" });
}

async function download(url: string, to: string) {
	const r = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0 SuperPromoShorts" } });
	if (!r.ok) throw new Error(`${url} returned ${r.status}`);
	fs.writeFileSync(to, Buffer.from(await r.arrayBuffer()));
}

/** Crop a fractional box out of the cover, padded a little so tags aren't clipped. */
async function crop(src: string, box: Box, to: string, pad = 0.01) {
	const meta = await sharp(src).metadata();
	const iw = meta.width!;
	const ih = meta.height!;
	const x = Math.max(0, Math.floor((box.x - pad) * iw));
	const y = Math.max(0, Math.floor((box.y - pad) * ih));
	const w = Math.min(iw - x, Math.ceil((box.w + 2 * pad) * iw));
	const h = Math.min(ih - y, Math.ceil((box.h + 2 * pad) * ih));
	await sharp(src).extract({ left: x, top: y, width: w, height: h }).png().toFile(to);
	return { w, h };
}

/** Largest rect of the image's aspect that fits inside `area`, centred. */
function fit(imgW: number, imgH: number, area: Rect): Rect {
	const s = Math.min(area.w / imgW, area.h / imgH);
	const w = Math.round((imgW * s) / 2) * 2;
	const h = Math.round((imgH * s) / 2) * 2;
	return { x: Math.round(area.x + (area.w - w) / 2), y: Math.round(area.y + (area.h - h) / 2), w, h };
}

const esc = (s: string) =>
	s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** "21/09" from "2026-09-21". */
const dm = (iso: string) => `${Number(iso.slice(8, 10))}/${Number(iso.slice(5, 7))}`;

const FONTS =
	'<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>' +
	'<link href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,500;0,700;0,800;1,500&family=Inter:wght@500;600;700&display=block" rel="stylesheet">';

const BASE_CSS = `
*{margin:0;padding:0;box-sizing:border-box}
html,body{width:${W}px;height:${H}px;background:transparent;overflow:hidden}
body{font-family:Inter,sans-serif;color:${CREAM}}
.serif{font-family:'Playfair Display',serif}
.kicker{font:600 30px Inter,sans-serif;letter-spacing:.32em;text-transform:uppercase;color:${GOLD}}
.rule{height:2px;background:linear-gradient(90deg,transparent,${GOLD},transparent);opacity:.8}
.frame{position:absolute;border-radius:28px;box-shadow:0 30px 80px rgba(0,0,0,.55),0 0 0 2px rgba(230,178,92,.55)}
`;

function frameDiv(r: Rect) {
	return `<div class="frame" style="left:${r.x}px;top:${r.y}px;width:${r.w}px;height:${r.h}px"></div>`;
}

function introHtml(b: Brief, logo: string | null, fg: Rect) {
	return `<html><head>${FONTS}<style>${BASE_CSS}
	.top{position:absolute;left:0;right:0;top:0;height:640px;background:linear-gradient(180deg,rgba(20,12,6,.92) 0%,rgba(20,12,6,.75) 70%,transparent 100%)}
	.logo{position:absolute;left:50%;top:70px;transform:translateX(-50%);height:150px;border-radius:18px;box-shadow:0 10px 30px rgba(0,0,0,.4)}
	.k{position:absolute;top:${logo ? 260 : 120}px;left:0;right:0;text-align:center}
	.hook{position:absolute;top:${logo ? 318 : 180}px;left:70px;right:70px;text-align:center;font-size:86px;line-height:1.14;font-weight:700}
	.dates{position:absolute;top:${logo ? 530 : 400}px;left:0;right:0;text-align:center;font:500 34px Inter,sans-serif;color:${CREAM};opacity:.9}
	</style></head><body>
	${frameDiv(fg)}
	<div class="top"></div>
	${logo ? `<img class="logo" src="${logo}">` : ""}
	<div class="k kicker">Nieuwe folder</div>
	<div class="hook serif">${esc(b.hook)}</div>
	<div class="dates">${esc(b.retailerName)} · geldig ${dm(b.validFrom)} t.e.m. ${dm(b.validUntil)}</div>
	</body></html>`;
}

function offerHtml(b: Brief, o: Offer, fg: Rect, index: number) {
	const name = esc(o.product);
	const detail = o.detail ? esc(o.detail) : "";
	const price = o.priceNow ? `<span class="eur">€</span>${esc(o.priceNow)}` : esc(o.mechanic ?? "");
	const was = o.priceNow && o.priceWas ? `<span class="was">€${esc(o.priceWas)}</span>` : "";
	const badge = o.priceNow && o.mechanic ? `<span class="badge">${esc(o.mechanic)}</span>` : "";
	return `<html><head>${FONTS}<style>${BASE_CSS}
	.top{position:absolute;left:0;right:0;top:0;height:300px;background:linear-gradient(180deg,rgba(20,12,6,.85),transparent)}
	.k{position:absolute;top:120px;left:0;right:0;text-align:center}
	.card{position:absolute;left:0;right:0;bottom:0;height:${H - fg.y - fg.h + 140}px;
		background:linear-gradient(180deg,transparent 0%,rgba(20,12,6,.88) 22%,rgba(20,12,6,.96) 100%);padding:150px 80px 0}
	.name{font-size:66px;line-height:1.14;font-weight:700}
	.detail{font:500 34px Inter,sans-serif;opacity:.85;margin-top:14px}
	.row{display:flex;align-items:baseline;gap:30px;margin-top:34px;flex-wrap:wrap}
	.price{font-size:${o.priceNow ? 190 : 130}px;line-height:1;font-weight:800;color:${GOLD}}
	.eur{font-size:.55em;margin-right:6px;vertical-align:.35em}
	.was{font:600 52px Inter,sans-serif;text-decoration:line-through;text-decoration-thickness:4px;opacity:.7}
	.badge{font:700 46px Inter,sans-serif;color:#20140a;background:${GOLD};padding:10px 26px;border-radius:999px}
	.src{position:absolute;left:80px;right:80px;bottom:90px;font:500 26px Inter,sans-serif;opacity:.6}
	</style></head><body>
	${frameDiv(fg)}
	<div class="top"></div>
	<div class="k kicker">${index === 0 ? "Deze week bij" : "Ook bij"} ${esc(b.retailerName)}</div>
	<div class="card">
		<div class="name serif">${name}</div>
		${detail ? `<div class="detail">${detail}</div>` : ""}
		<div class="row"><span class="price serif">${price}</span>${was}${badge}</div>
	</div>
	<div class="src">Prijs volgens de ${esc(b.retailerName)}-folder · t.e.m. ${dm(b.validUntil)}</div>
	</body></html>`;
}

function outroHtml(b: Brief, logo: string | null, fg: Rect) {
	return `<html><head>${FONTS}<style>${BASE_CSS}
	.bottom{position:absolute;left:0;right:0;bottom:0;height:760px;background:linear-gradient(180deg,transparent,rgba(20,12,6,.9) 30%,rgba(20,12,6,.97))}
	.logo{position:absolute;left:50%;top:1310px;transform:translateX(-50%);height:120px;border-radius:14px}
	.k{position:absolute;top:${logo ? 1470 : 1380}px;left:0;right:0;text-align:center}
	.cta{position:absolute;top:${logo ? 1530 : 1440}px;left:60px;right:60px;text-align:center;font-size:${b.retailerName.length > 8 ? 60 : 74}px;line-height:1.14;font-weight:700;white-space:nowrap}
	.url{position:absolute;top:${logo ? 1650 : 1560}px;left:0;right:0;text-align:center;font:700 44px Inter,sans-serif;color:${GOLD}}
	.src{position:absolute;left:80px;right:80px;bottom:70px;text-align:center;font:500 24px Inter,sans-serif;opacity:.6}
	</style></head><body>
	${frameDiv(fg)}
	<div class="bottom"></div>
	${logo ? `<img class="logo" src="${logo}">` : ""}
	<div class="k kicker">Bekijk de hele folder</div>
	<div class="cta serif">Alle promo's van ${esc(b.retailerName)}</div>
	<div class="url">superpromobelgie.com</div>
	<div class="src">Niet gesponsord · prijzen uit de ${esc(b.retailerName)}-folder, geldig t.e.m. ${dm(b.validUntil)}</div>
	</body></html>`;
}

async function snap(browser: Browser, html: string, to: string) {
	const page = await browser.newPage();
	await page.setViewport({ width: W, height: H, deviceScaleFactor: 1 });
	const file = to.replace(/\.png$/, ".html");
	fs.writeFileSync(file, html);
	await page.goto("file://" + path.resolve(file), { waitUntil: "networkidle0", timeout: 60000 });
	await page.evaluate(() => (document as Document & { fonts: FontFaceSet }).fonts.ready);
	await page.screenshot({ path: to as `${string}.png`, omitBackground: true });
	await page.close();
}

function renderScene(s: Scene, to: string) {
	const n = Math.round(s.seconds * FPS);
	// zoompan on a single still yields `d` frames; pre-scaling 2x keeps the
	// slow push from stepping a pixel at a time.
	const bg = `[0]scale=${W}:${H}:force_original_aspect_ratio=increase,crop=${W}:${H},boxblur=28:2,eq=brightness=-0.22:saturation=0.9,scale=${W * 2}:${H * 2},zoompan=z='1+0.0004*on':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=${n}:s=${W}x${H}:fps=${FPS}[bg]`;
	const fg = `[1]scale=${s.fgRect.w * 2}:${s.fgRect.h * 2},zoompan=z='1+0.0009*on':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=${n}:s=${s.fgRect.w}x${s.fgRect.h}:fps=${FPS},format=rgba,geq=r='r(X,Y)':g='g(X,Y)':b='b(X,Y)':a='255*lte(hypot(max(0,abs(X-W/2)-(W/2-28)),max(0,abs(Y-H/2)-(H/2-28))),28)'[fg]`;
	ff([
		"-i", s.bg,
		"-i", s.fg,
		"-loop", "1", "-t", String(s.seconds), "-i", s.overlay,
		"-filter_complex",
		`${bg};${fg};[bg][fg]overlay=${s.fgRect.x}:${s.fgRect.y}[v1];[v1][2]overlay=0:0:shortest=1,format=yuv420p[v]`,
		"-map", "[v]", "-frames:v", String(n), "-r", String(FPS),
		"-c:v", "libx264", "-preset", "medium", "-crf", "18", to,
	]);
}

function joinScenes(clips: string[], seconds: number[], music: string | null, to: string) {
	const inputs = clips.flatMap((c) => ["-i", c]);
	let chain = "";
	let prev = "[0:v]";
	let offset = 0;
	for (let i = 1; i < clips.length; i++) {
		offset += seconds[i - 1] - FADE;
		const out = i === clips.length - 1 ? "[v]" : `[x${i}]`;
		chain += `${prev}[${i}:v]xfade=transition=fade:duration=${FADE}:offset=${offset.toFixed(3)}${out};`;
		prev = out;
	}
	const total = seconds.reduce((a, b) => a + b, 0) - FADE * (clips.length - 1);
	const audio = music
		? ["-i", music, "-filter_complex", `${chain}[${clips.length}:a]atrim=0:${total},afade=t=in:d=0.4,afade=t=out:st=${total - 1.2}:d=1.2,volume=0.8[a]`]
		: ["-f", "lavfi", "-t", String(total), "-i", "anullsrc=r=44100:cl=stereo", "-filter_complex", chain.replace(/;$/, "")];
	ff([
		...inputs,
		...audio,
		"-map", "[v]", "-map", music ? "[a]" : `${clips.length}:a`,
		"-t", String(total),
		"-c:v", "libx264", "-preset", "slow", "-crf", "19", "-pix_fmt", "yuv420p", "-r", String(FPS),
		"-c:a", "aac", "-b:a", "160k", "-movflags", "+faststart",
		to,
	]);
	return total;
}

function pickMusic(): string | null {
	// Licensed tracks only: drop them in assets/shorts/music/. Silence otherwise;
	// every platform accepts it and TikTok/Reels let you add a sound in-app.
	const dir = path.join("assets", "shorts", "music");
	if (!fs.existsSync(dir)) return null;
	const tracks = fs.readdirSync(dir).filter((f) => /\.(mp3|m4a|wav)$/i.test(f)).sort();
	if (tracks.length === 0) return null;
	const n = Number(week.replace(/\D/g, "")) % tracks.length;
	return path.join(dir, tracks[n]);
}

async function renderOne(browser: Browser, slug: string) {
	const dir = path.join(weekDir, slug);
	const brief = Brief.parse(JSON.parse(fs.readFileSync(path.join(dir, "brief.json"), "utf-8")));
	const tmp = fs.mkdtempSync(path.join(os.tmpdir(), `short-${slug}-`));

	const coverRaw = path.join(tmp, "cover.src");
	await download(brief.coverUrl, coverRaw);
	const cover = path.join(tmp, "cover.png");
	await sharp(coverRaw).png().toFile(cover);
	const { width: cw, height: ch } = await sharp(cover).metadata();

	let logo: string | null = null;
	if (brief.logoBox) {
		logo = path.join(tmp, "logo.png");
		await crop(cover, brief.logoBox, logo, 0.004);
		logo = "file://" + path.resolve(logo);
	}

	const offers = brief.offers.slice(0, 2);
	const seconds = offers.length === 2 ? [3.0, 6.5, 4.5, 2.5] : [3.0, 8.0, 5.0];
	const scenes: Scene[] = [];

	const introRect = fit(cw!, ch!, { x: 110, y: 660, w: 860, h: 1180 });
	await snap(browser, introHtml(brief, logo, introRect), path.join(tmp, "o-intro.png"));
	scenes.push({ name: "intro", seconds: seconds[0], bg: cover, fg: cover, fgRect: introRect, overlay: path.join(tmp, "o-intro.png") });

	for (const [i, o] of offers.entries()) {
		const cropFile = path.join(tmp, `offer${i}.png`);
		const c = await crop(cover, o.box, cropFile);
		const r = fit(c.w, c.h, { x: 60, y: 250, w: 960, h: 900 });
		await snap(browser, offerHtml(brief, o, r, i), path.join(tmp, `o-offer${i}.png`));
		scenes.push({ name: `offer${i}`, seconds: seconds[1 + i], bg: cropFile, fg: cropFile, fgRect: r, overlay: path.join(tmp, `o-offer${i}.png`) });
	}

	const outroRect = fit(cw!, ch!, { x: 250, y: 150, w: 580, h: 1080 });
	await snap(browser, outroHtml(brief, logo, outroRect), path.join(tmp, "o-outro.png"));
	scenes.push({ name: "outro", seconds: seconds[seconds.length - 1], bg: cover, fg: cover, fgRect: outroRect, overlay: path.join(tmp, "o-outro.png") });

	const clips = scenes.map((s) => {
		const out = path.join(tmp, `${s.name}.mp4`);
		renderScene(s, out);
		return out;
	});
	const video = path.join(dir, "short.mp4");
	const total = joinScenes(clips, scenes.map((s) => s.seconds), pickMusic(), video);

	// Thumbnail: the hero offer, settled.
	ff(["-ss", String(seconds[0] + 1.5), "-i", video, "-frames:v", "1", "-q:v", "3", path.join(dir, "thumb.jpg")]);

	const posts = Object.fromEntries(PLATFORMS.map((p) => [p, postCopy(brief, p)]));
	fs.writeFileSync(path.join(dir, "posts.json"), JSON.stringify(posts, null, 2));
	// Best effort: Windows can hold a lock on a just-closed file, and a
	// leftover temp folder is not worth failing a finished render over.
	try {
		fs.rmSync(tmp, { recursive: true, force: true, maxRetries: 3, retryDelay: 200 });
	} catch {}
	console.log(`✓ ${slug.padEnd(14)} ${total.toFixed(1)}s  ${video}`);
}

const slugs = (only.length ? only : fs.readdirSync(weekDir)).filter((s) =>
	fs.existsSync(path.join(weekDir, s, "brief.json")),
);
const browser = await puppeteer.launch({
	headless: true,
	executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
	args: ["--allow-file-access-from-files", "--no-sandbox"],
});
let failed = 0;
try {
	for (const slug of slugs) {
		try {
			await renderOne(browser, slug);
		} catch (e) {
			failed++;
			console.error(`✗ ${slug}: ${(e as Error).message}`);
		}
	}
} finally {
	await browser.close();
}
if (failed) process.exitCode = 1;
