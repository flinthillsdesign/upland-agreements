// Import past agreements from Dropbox into the knowledge base
// Run: node scripts/import-agreements.js

import { readFileSync, existsSync, readdirSync } from "fs";
import { createClient } from "@libsql/client";

// Load .env
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

import mammoth from "mammoth";

const db = createClient({
	url: process.env.TURSO_URL || "file:./data/local.db",
	authToken: process.env.TURSO_TOKEN || undefined,
});

// Ensure knowledge_base table exists
await db.execute(`CREATE TABLE IF NOT EXISTS knowledge_base (
	id TEXT PRIMARY KEY,
	type TEXT NOT NULL,
	title TEXT NOT NULL,
	content TEXT NOT NULL,
	metadata TEXT,
	created_at TEXT NOT NULL DEFAULT (datetime('now')),
	updated_at TEXT NOT NULL DEFAULT (datetime('now'))
)`);

const { nanoid } = await import("nanoid");

const BASE = "/Users/joelgaeddert/Upland Dropbox/Sales/Agreement Templates";

async function extractDocx(path) {
	const result = await mammoth.extractRawText({ path });
	return result.value;
}

function parseAgreementType(filename, content) {
	if (filename.includes("MoU") && content.includes("Memo of Understanding")) {
		if (filename.includes("Concept") || content.toLowerCase().includes("concept")) return "mou_concept";
		return "mou_small";
	}
	return "full_services";
}

function parseMou(text) {
	const fields = {};

	const clientMatch = text.match(/Client\n+([\s\S]*?)(?=\n\s*\nProject)/);
	if (clientMatch) fields.client = clientMatch[1].trim();

	const projectMatch = text.match(/Project\n+([\s\S]*?)(?=\n\s*\nScope)/);
	if (projectMatch) fields.project = projectMatch[1].trim();

	const scopeMatch = text.match(/Scope of Work \/ Deliverable\n+([\s\S]*?)(?=\n\s*\nTimeframe|\n\s*\nCost)/);
	if (scopeMatch) fields.scope = scopeMatch[1].trim();

	const timeMatch = text.match(/Timeframe\n+([\s\S]*?)(?=\n\s*\nCost)/);
	if (timeMatch) fields.timeframe = timeMatch[1].trim();

	const costMatch = text.match(/Cost\n+([\s\S]*?)(?=\n\s*\n----|PROJECT TERMS)/);
	if (costMatch) fields.cost = costMatch[1].trim();

	// Extract hours and rate from cost
	const hoursMatch = fields.cost?.match(/(\d+)\s*hours?\s*x?\s*\$?([\d,.]+)/i);
	if (hoursMatch) {
		fields.hours = parseInt(hoursMatch[1]);
		fields.hourly_rate = parseFloat(hoursMatch[2].replace(",", ""));
		fields.total = fields.hours * fields.hourly_rate;
	}

	return fields;
}

function parseFullAgreement(text) {
	const fields = {};

	const clientMatch = text.match(/and\s+(.*?),\s*[\s\S]*?\("Client"\)/);
	if (clientMatch) fields.client = clientMatch[1].trim();

	const descMatch = text.match(/DESCRIPTION OF SERVICES[\s\S]*?\n\n([\s\S]*?)(?=\n\s*\nPROJECT COST)/);
	if (descMatch) fields.description = descMatch[1].trim();

	const costMatch = text.match(/shall not exceed\s+([\s\S]*?)(?:\.|$)/);
	if (costMatch) {
		const amountStr = costMatch[1].trim();
		const numMatch = amountStr.match(/\$([\d,]+)/);
		if (numMatch) fields.total = parseInt(numMatch[1].replace(/,/g, ""));
	}

	const respMatch = text.match(/CLIENT RESPONSIBILITIES[\s\S]*?\n\n([\s\S]*?)(?=\n\s*\nTITLE AND ASSIGNMENT)/);
	if (respMatch) fields.responsibilities = respMatch[1].trim();

	const ratesMatch = text.match(/SERVICE RATES[\s\S]*?\n\n([\s\S]*?)(?=\n\s*\nCLIENT RESPONSIBILITIES)/);
	if (ratesMatch) fields.rates = ratesMatch[1].trim();

	return fields;
}

async function importFile(filepath, filename) {
	console.log(`Processing: ${filename}`);
	const text = await extractDocx(filepath);
	const type = parseAgreementType(filename, text);

	let title, content, metadata;

	if (type === "mou_concept" || type === "mou_small") {
		const parsed = parseMou(text);
		title = `${parsed.client || "Unknown"} — ${parsed.project || filename}`;
		content = [
			`Client: ${parsed.client || "Unknown"}`,
			`Project: ${parsed.project || "Unknown"}`,
			`Type: ${type === "mou_concept" ? "MoU — Concept" : "MoU — Small Design"}`,
			parsed.hours ? `Hours: ${parsed.hours}` : null,
			parsed.hourly_rate ? `Rate: $${parsed.hourly_rate}/hr` : null,
			parsed.total ? `Total: $${parsed.total.toLocaleString()}` : null,
			parsed.timeframe ? `Timeframe: ${parsed.timeframe}` : null,
			"",
			"Scope of Work:",
			parsed.scope || "Not extracted",
			"",
			parsed.cost ? `Cost: ${parsed.cost}` : null,
		].filter(Boolean).join("\n");

		metadata = JSON.stringify({
			agreement_type: type,
			client: parsed.client,
			project: parsed.project,
			hours: parsed.hours,
			hourly_rate: parsed.hourly_rate,
			total: parsed.total,
		});
	} else {
		const parsed = parseFullAgreement(text);
		title = `${parsed.client || filename.replace(/\.docx$/, "").replace("Upland Agreement for Services - ", "")}`;
		content = [
			`Client: ${parsed.client || "Unknown"}`,
			`Type: Agreement for Services`,
			parsed.total ? `NTE: $${parsed.total.toLocaleString()}` : null,
			"",
			"Description of Services:",
			parsed.description || "Not extracted",
			"",
			parsed.responsibilities ? "Client Responsibilities:\n" + parsed.responsibilities : null,
			"",
			parsed.rates ? "Service Rates:\n" + parsed.rates : null,
		].filter(Boolean).join("\n");

		metadata = JSON.stringify({
			agreement_type: "full_services",
			client: parsed.client,
			total: parsed.total,
		});
	}

	const id = nanoid();
	await db.execute({
		sql: "INSERT INTO knowledge_base (id, type, title, content, metadata) VALUES (?, ?, ?, ?, ?)",
		args: [id, "past_agreement", title, content, metadata],
	});
	console.log(`  -> Imported as: ${title} (${type})`);
}

// Import all files
const rootFiles = readdirSync(BASE).filter(f => f.endsWith(".docx"));
const conceptFiles = readdirSync(BASE + "/Concepts").filter(f => f.endsWith(".docx"));

console.log(`\nFound ${rootFiles.length} root agreements + ${conceptFiles.length} concept MoUs\n`);

for (const f of rootFiles) {
	await importFile(`${BASE}/${f}`, f);
}

for (const f of conceptFiles) {
	await importFile(`${BASE}/Concepts/${f}`, f);
}

console.log("\nDone! All agreements imported to knowledge base.");
