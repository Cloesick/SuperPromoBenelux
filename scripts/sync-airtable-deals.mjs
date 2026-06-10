#!/usr/bin/env node
// Sync deals from the "SuperPromo — Deals Engine" Airtable base into the
// site's data/folders/*.json files.
//
// Airtable is the editorial source of truth for DEALS; this script materializes
// them into the JSON the site already reads (src/lib/folders.ts), so the
// runtime/SSG path is unchanged. It MERGES — folder metadata + page images in
// the JSON are preserved; only the `deals[]` arrays are refreshed.
//
// Usage:
//   AIRTABLE_TOKEN=pat... node scripts/sync-airtable-deals.mjs            # dry run
//   AIRTABLE_TOKEN=pat... node scripts/sync-airtable-deals.mjs --write    # apply
//
// Env:
//   AIRTABLE_TOKEN  (required)  PAT with data.records:read on the base
//   AIRTABLE_BASE   (optional)  defaults to appILxwPpKEWomToC

import fs from "node:fs";
import path from "node:path";

const TOKEN = process.env.AIRTABLE_TOKEN;
const BASE = process.env.AIRTABLE_BASE || "appILxwPpKEWomToC";
const WRITE = process.argv.includes("--write");
const DATA_DIR = path.join(process.cwd(), "data", "folders");

if (!TOKEN) {
  console.error("✖ AIRTABLE_TOKEN is required (PAT with data.records:read).");
  process.exit(1);
}

const API = `https://api.airtable.com/v0/${BASE}`;
const headers = { Authorization: `Bearer ${TOKEN}` };

async function listAll(table) {
  const out = [];
  let offset;
  do {
    const url = new URL(`${API}/${encodeURIComponent(table)}`);
    url.searchParams.set("pageSize", "100");
    if (offset) url.searchParams.set("offset", offset);
    const res = await fetch(url, { headers });
    if (!res.ok) throw new Error(`${table} ${res.status}: ${await res.text()}`);
    const json = await res.json();
    out.push(...json.records);
    offset = json.offset;
  } while (offset);
  return out;
}

// "albert-heijn-2026-w24-folder" -> "albert-heijn"
function slugFromFolderId(folderId = "") {
  const m = folderId.match(/^(.*)-\d{4}-w\d{2}-folder$/);
  return m ? m[1] : null;
}

function toSiteDeal(rec, slug) {
  const f = rec.fields;
  return {
    id: rec.id,
    product: f.Product ?? "",
    originalPrice: f["Original Price"],
    promoPrice: f["Promo Price"],
    discount: f.Discount,
    category: f.Category,
    imageUrl: f["Image URL"],
    affiliateUrl: f["Product URL"],
    validFrom: f["Valid From"] ?? "",
    validUntil: f["Valid Until"] ?? "",
    retailerSlug: slug,
  };
}

async function main() {
  console.log(`Reading Airtable base ${BASE} …`);
  const [folders, deals] = await Promise.all([
    listAll("Folders"),
    listAll("Deals"),
  ]);

  // recordId -> slug (via the folder's Folder ID)
  const folderSlug = new Map();
  for (const fr of folders) {
    const slug = slugFromFolderId(fr.fields["Folder ID"]);
    if (slug) folderSlug.set(fr.id, slug);
  }

  // group deals by retailer slug (resolved through the linked Folder)
  const bySlug = new Map();
  let unlinked = 0;
  for (const dr of deals) {
    if (dr.fields.Status === "Expired") continue;
    const link = (dr.fields.Folder || [])[0];
    const slug = link ? folderSlug.get(link) : null;
    if (!slug) {
      unlinked++;
      continue;
    }
    if (!bySlug.has(slug)) bySlug.set(slug, []);
    bySlug.get(slug).push(toSiteDeal(dr, slug));
  }

  console.log(
    `Found ${deals.length} deals across ${folders.length} folders → ` +
      `${bySlug.size} retailers (${unlinked} unlinked, skipped).`,
  );

  let changed = 0;
  for (const [slug, siteDeals] of bySlug) {
    const file = path.join(DATA_DIR, `${slug}.json`);
    if (!fs.existsSync(file)) {
      console.warn(`  • ${slug}: no data/folders/${slug}.json — skipping`);
      continue;
    }
    const data = JSON.parse(fs.readFileSync(file, "utf-8"));
    const before = (data.deals || []).length;
    data.deals = siteDeals; // refresh top-level deals; preserve folders/pages
    data.scrapedAt = new Date().toISOString();
    if (!data.methods?.includes("api")) data.methods = [...(data.methods || []), "api"];

    console.log(`  • ${slug}: ${before} → ${siteDeals.length} deals`);
    if (WRITE) {
      fs.writeFileSync(file, JSON.stringify(data, null, 2) + "\n");
      changed++;
    }
  }

  if (!WRITE) {
    console.log("\nDry run — no files written. Re-run with --write to apply.");
  } else {
    console.log(`\n✔ Wrote ${changed} file(s).`);
  }
}

main().catch((err) => {
  console.error("✖", err.message);
  process.exit(1);
});
