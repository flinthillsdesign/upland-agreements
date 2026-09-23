// Freeze the terms of every agreement the client has already signed.
//
// A signed agreement should keep the wording it was signed with. New signatures freeze
// themselves (the sign route stores signed_terms); this backfills the ones signed before
// that existed, rendering each with the template as it is in this checkout. Run it BEFORE
// deploying a template change, so the frozen text is the old wording, not the new.
//
//   node scripts/freeze-signed.ts          # freeze every signed agreement without signed_terms
//   node scripts/freeze-signed.ts --dry    # only list what would be frozen
//
// Reads TURSO_URL / TURSO_TOKEN from .env (falls back to the local dev DB).

import { readFileSync, existsSync } from "fs";
import { createClient } from "@libsql/client";
import { renderAgreementTerms, type AgreementData, type SettingsData } from "../lib/render-agreement.ts";

if (existsSync(".env")) {
	for (const line of readFileSync(".env", "utf-8").split("\n")) {
		const trimmed = line.trim();
		if (!trimmed || trimmed.startsWith("#")) continue;
		const eq = trimmed.indexOf("=");
		if (eq === -1) continue;
		const key = trimmed.slice(0, eq).trim();
		if (!process.env[key]) process.env[key] = trimmed.slice(eq + 1).trim();
	}
}

const dry = process.argv.includes("--dry");
const db = createClient({
	url: process.env.TURSO_URL || "file:./data/local.db",
	authToken: process.env.TURSO_TOKEN || undefined,
});

await db.execute("ALTER TABLE agreements ADD COLUMN signed_terms TEXT").catch(() => { /* already exists */ });

const settingsRow = await db.execute("SELECT data FROM settings WHERE id = 1");
const settings = JSON.parse((settingsRow.rows[0]?.data as string) || "{}") as SettingsData;

const result = await db.execute(
	"SELECT * FROM agreements WHERE client_signature IS NOT NULL AND (signed_terms IS NULL OR signed_terms = '') ORDER BY updated_at",
);
console.log(`${result.rows.length} signed agreement(s) without frozen terms${dry ? " (dry run)" : ""}`);

for (const row of result.rows) {
	const agreement = row as unknown as AgreementData & { id: string };
	const terms = renderAgreementTerms(agreement, settings);
	console.log(`  ${agreement.id}  ${agreement.status.padEnd(14)} ${agreement.title}  (${terms.length} chars)`);
	if (!dry) {
		await db.execute({ sql: "UPDATE agreements SET signed_terms = ? WHERE id = ?", args: [terms, agreement.id] });
	}
}
console.log(dry ? "Nothing written." : "Done.");
