#!/usr/bin/env tsx
// ---------------------------------------------------------------------------
// Apply the SQL schema files to POSTGRES_URL.
//
// `catalogDb.ts` talks to the database through @neondatabase/serverless, which
// is an HTTP driver: it speaks to a Neon endpoint, not to a Postgres socket. A
// local `postgresql://localhost:5432/...` therefore fails with "fetch failed"
// rather than a connection error, which reads like a network blip and is not
// one. POSTGRES_URL must be a Neon (or Neon-compatible HTTP) connection string.
//
// Every statement is idempotent (`IF NOT EXISTS`), so re-running is safe and is
// the intended way to bring a fresh database up to date.
//
//   POSTGRES_URL=postgres://... npx tsx scripts/db-migrate.mts
//   POSTGRES_URL=postgres://... npx tsx scripts/db-migrate.mts --verify
// ---------------------------------------------------------------------------

import fs from "node:fs";
import path from "node:path";
import { neon } from "@neondatabase/serverless";

const SQL_DIR = path.join(process.cwd(), "sql");

/* Only the files the comparison pipeline needs. sp_events.sql and the older
 * promo_products table belong to other features and are left alone. */
const FILES = ["002_create_catalog.sql"];

const conn = process.env.POSTGRES_URL || process.env.POSTGRES_PRISMA_URL;
if (!conn) {
	console.error(
		"POSTGRES_URL is not set.\n\n" +
			"This must be a Neon HTTP connection string — the app's driver cannot\n" +
			"reach a plain Postgres socket. Create one at neon.tech, or via the\n" +
			"Vercel Marketplace so it lands in the project's env automatically.",
	);
	process.exit(1);
}

const sql = neon(conn);
const verifyOnly = process.argv.includes("--verify");

/* Split on semicolons at end of line. Safe for this schema, which is plain
 * CREATE TABLE/INDEX with no dollar-quoted function bodies; it would not be
 * safe if one were added later. */
function statements(text: string): string[] {
	return text
		.split(/;\s*$/m)
		.map((s) => s.replace(/^\s*--.*$/gm, "").trim())
		.filter(Boolean);
}

async function verify() {
	const rows = (await sql`
		SELECT table_name FROM information_schema.tables
		WHERE table_schema = 'public'
		  AND table_name IN ('canonical_products', 'product_offers')
		ORDER BY table_name
	`) as { table_name: string }[];
	const found = rows.map((r) => r.table_name);
	console.log(`tables present: ${found.length ? found.join(", ") : "none"}`);

	if (found.includes("product_offers")) {
		const counts = (await sql`
			SELECT
			  (SELECT count(*) FROM canonical_products) AS canonicals,
			  (SELECT count(*) FROM product_offers)     AS offers
		`) as { canonicals: string; offers: string }[];
		console.log(
			`rows: canonical_products=${counts[0].canonicals} product_offers=${counts[0].offers}`,
		);
	}
	return found.length === 2;
}

async function main() {
	if (verifyOnly) {
		process.exit((await verify()) ? 0 : 1);
	}

	for (const file of FILES) {
		const full = path.join(SQL_DIR, file);
		if (!fs.existsSync(full)) {
			console.error(`missing ${file}`);
			process.exit(1);
		}
		const stmts = statements(fs.readFileSync(full, "utf8"));
		console.log(`${file}: applying ${stmts.length} statement(s)`);
		for (const s of stmts) {
			await sql.query(s);
		}
	}

	console.log("\nmigration complete.");
	await verify();
}

main().catch((err) => {
	console.error(err instanceof Error ? err.message : err);
	process.exit(1);
});
