// Import additional past agreements from Dropbox project folders
import { readFileSync, existsSync } from "fs";
import { createClient } from "@libsql/client";
import mammoth from "mammoth";
import { nanoid } from "nanoid";

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

const db = createClient({
	url: process.env.TURSO_URL || "file:./data/local.db",
	authToken: process.env.TURSO_TOKEN || undefined,
});

const files = [
	{
		path: "/Users/joelgaeddert/Upland Dropbox/Projects/Completed Projects/2025 - National WWI Museum - Soccer/Project Management/Agreement/Upland Agreement for Services - NWWIMM Socer Exhibit Design & Fabrication.docx",
		label: "NWWIMM Soccer Exhibit D&F",
	},
	{
		path: "/Users/joelgaeddert/Upland Dropbox/Projects/Completed Projects/2024 - National WWI Museum and Memorial - Paris at War/Project Management/Agreement/Upland Agreement for Services - Paris at War Exhibit Design & Fabrication.docx",
		label: "NWWIMM Paris at War D&F",
	},
	{
		path: "/Users/joelgaeddert/Upland Dropbox/Projects/Completed Projects/2023 - Japanese Hall/Project Management/Agreement/Upland Agreement for Services - Japanese Hall 2022-12-30.docx",
		label: "Japanese Hall D&F",
	},
	{
		path: "/Users/joelgaeddert/Upland Dropbox/Projects/Completed Projects/2021 - Rawlings Library News Exhibit/Project Management/Agreements/PCCLD - FHD Agreement for Services - InfoZone through Schematic Design.docx",
		label: "PCCLD InfoZone — Schematic Design",
	},
	{
		path: "/Users/joelgaeddert/Upland Dropbox/Projects/Completed Projects/2021 - Rawlings Library News Exhibit/Project Management/Agreements/PCCLD - FHD Agreement for Services - InfoZone Design Dev through Installation.docx",
		label: "PCCLD InfoZone — Design Dev through Installation",
	},
	{
		path: "/Users/joelgaeddert/Upland Dropbox/Projects/Completed Projects/2020 - WCF Satellite Sites Concept/Draft Agreements/2022-8-5 Draft Agreements/Working files/Upland Agreement for Services - Burlington Depot Exhibits.docx",
		label: "WCF Burlington Depot Exhibits",
	},
	{
		path: "/Users/joelgaeddert/Upland Dropbox/Projects/Completed Projects/2020 - WCF Satellite Sites Concept/Draft Agreements/2022-8-5 Draft Agreements/Working files/Upland Agreement for Services - Pavelka Farmstead Exhibits.docx",
		label: "WCF Pavelka Farmstead Exhibits",
	},
	{
		path: "/Users/joelgaeddert/Upland Dropbox/Projects/Completed Projects/2024 - Nebraska State Fair/Project Management/Upland MoU - NE State Fair.docx",
		label: "Nebraska State Fair MoU",
	},
	{
		path: "/Users/joelgaeddert/Upland Dropbox/Projects/Completed Projects/2024 - Nicodemus National Historic Site/Project Management/Upland MoU - NPS Nicodemus Oral History Kiosk.docx",
		label: "NPS Nicodemus Oral History Kiosk MoU",
	},
	{
		path: "/Users/joelgaeddert/Upland Dropbox/Projects/2023 - Science & Religion in Dialogue - Kiewit Luminarium/Upland MoU - Kiewit Luminarium - Initial Charette.docx",
		label: "Kiewit Luminarium Initial Charrette MoU",
	},
];

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
	const hoursMatch = fields.cost?.match(/(\d+)\s*hours?\s*x?\s*\$?([\d,.]+)/i);
	if (hoursMatch) {
		fields.hours = parseInt(hoursMatch[1]);
		fields.hourly_rate = parseFloat(hoursMatch[2].replace(",", ""));
		fields.total = fields.hours * fields.hourly_rate;
	}
	// Try to get total from dollar amount if no hours
	if (!fields.total && fields.cost) {
		const dollarMatch = fields.cost.match(/\$([\d,]+)/);
		if (dollarMatch) fields.total = parseInt(dollarMatch[1].replace(/,/g, ""));
	}
	return fields;
}

function parseFullAgreement(text) {
	const fields = {};
	const clientMatch = text.match(/and\s+(.*?),\s*[\s\S]{0,200}?\("Client"\)/);
	if (clientMatch) fields.client = clientMatch[1].trim().replace(/_{2,}/g, "").trim();
	const descMatch = text.match(/DESCRIPTION OF SERVICES[\s\S]*?\n\n([\s\S]*?)(?=\n\s*\nPROJECT COST)/);
	if (descMatch) fields.description = descMatch[1].trim();
	const costMatch = text.match(/shall not exceed\s+([\s\S]*?)(?:\.\s|\n)/);
	if (costMatch) {
		const numMatch = costMatch[1].match(/\$([\d,]+)/);
		if (numMatch) fields.total = parseInt(numMatch[1].replace(/,/g, ""));
	}
	const respMatch = text.match(/CLIENT RESPONSIBILITIES[\s\S]*?\n\n([\s\S]*?)(?=\n\s*\nTITLE AND ASSIGNMENT)/);
	if (respMatch) fields.responsibilities = respMatch[1].trim();
	const ratesSection = text.match(/SERVICE RATES[\s\S]*?\n\n([\s\S]*?)(?=\n\s*\nCLIENT RESPONSIBILITIES)/);
	if (ratesSection) fields.rates = ratesSection[1].trim();
	return fields;
}

for (const file of files) {
	console.log(`\nProcessing: ${file.label}`);
	try {
		const result = await mammoth.extractRawText({ path: file.path });
		const text = result.value;
		const isMou = text.includes("Memo of Understanding");

		let title, content, metadata;

		if (isMou) {
			const p = parseMou(text);
			title = p.client ? `${p.client} — ${p.project || file.label}` : file.label;
			content = [
				`Client: ${p.client || "Unknown"}`,
				`Project: ${p.project || "Unknown"}`,
				`Type: MoU`,
				p.hours ? `Hours: ${p.hours}` : null,
				p.hourly_rate ? `Rate: $${p.hourly_rate}/hr` : null,
				p.total ? `Total: $${p.total.toLocaleString()}` : null,
				p.timeframe ? `Timeframe: ${p.timeframe}` : null,
				"",
				"Scope of Work:",
				p.scope || "Not extracted",
				p.cost ? `\nCost: ${p.cost}` : null,
			].filter(Boolean).join("\n");
			metadata = JSON.stringify({ agreement_type: "mou_concept", client: p.client, hours: p.hours, hourly_rate: p.hourly_rate, total: p.total });
		} else {
			const p = parseFullAgreement(text);
			title = p.client || file.label;
			content = [
				`Client: ${p.client || "Unknown"}`,
				`Type: Agreement for Services`,
				p.total ? `NTE: $${p.total.toLocaleString()}` : null,
				"",
				p.description ? "Description of Services:\n" + p.description : null,
				p.responsibilities ? "\nClient Responsibilities:\n" + p.responsibilities : null,
				p.rates ? "\nService Rates:\n" + p.rates : null,
			].filter(Boolean).join("\n");
			metadata = JSON.stringify({ agreement_type: "full_services", client: p.client, total: p.total });
		}

		const id = nanoid();
		await db.execute({
			sql: "INSERT INTO knowledge_base (id, type, title, content, metadata) VALUES (?, ?, ?, ?, ?)",
			args: [id, "past_agreement", title, content, metadata],
		});
		console.log(`  -> ${title} (${isMou ? "MoU" : "Full"})${isMou ? "" : p => ""}`);
	} catch (err) {
		console.error(`  -> FAILED: ${err.message}`);
	}
}

console.log("\nDone!");
