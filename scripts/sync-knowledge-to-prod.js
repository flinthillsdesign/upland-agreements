// Sync knowledge base from local DB to production Turso
import { readFileSync, existsSync } from "fs";
import { createClient } from "@libsql/client";

if (existsSync(".env")) {
	const envContent = readFileSync(".env", "utf-8");
	for (const line of envContent.split("\n")) {
		const trimmed = line.trim();
		if (!trimmed || trimmed.startsWith("#")) continue;
		const eqIdx = trimmed.indexOf("=");
		if (eqIdx === -1) continue;
		const key = trimmed.slice(0, eqIdx).trim();
		const val = trimmed.slice(eqIdx + 1).trim();
		if (!process.env[key]) process.env[key] = val;
	}
}

const local = createClient({ url: "file:./data/local.db" });

// Production DB — use the Turso URL from Netlify env
const prodUrl = process.env.TURSO_PROD_URL || process.argv[2];
const prodToken = process.env.TURSO_PROD_TOKEN || process.argv[3];

if (!prodUrl) {
	console.error("Usage: node scripts/sync-knowledge-to-prod.js <TURSO_URL> <TURSO_TOKEN>");
	console.error("Or set TURSO_PROD_URL and TURSO_PROD_TOKEN in .env");
	process.exit(1);
}

const prod = createClient({ url: prodUrl, authToken: prodToken || undefined });

// Ensure schema exists on prod
await prod.execute(`CREATE TABLE IF NOT EXISTS knowledge_base (
	id TEXT PRIMARY KEY,
	type TEXT NOT NULL,
	title TEXT NOT NULL,
	content TEXT NOT NULL,
	metadata TEXT,
	created_at TEXT NOT NULL DEFAULT (datetime('now')),
	updated_at TEXT NOT NULL DEFAULT (datetime('now'))
)`);

// Get all local entries
const localEntries = await local.execute("SELECT * FROM knowledge_base ORDER BY title");
console.log(`Found ${localEntries.rows.length} local entries\n`);

// Get existing prod entries
const prodEntries = await prod.execute("SELECT id FROM knowledge_base");
const prodIds = new Set(prodEntries.rows.map((r) => r.id));

let added = 0;
let skipped = 0;

for (const row of localEntries.rows) {
	if (prodIds.has(row.id)) {
		console.log(`  skip: ${row.title} (already exists)`);
		skipped++;
		continue;
	}

	await prod.execute({
		sql: "INSERT INTO knowledge_base (id, type, title, content, metadata, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
		args: [row.id, row.type, row.title, row.content, row.metadata, row.created_at, row.updated_at],
	});
	console.log(`  added: ${row.title}`);
	added++;
}

console.log(`\nDone! Added ${added}, skipped ${skipped} (already in prod).`);
