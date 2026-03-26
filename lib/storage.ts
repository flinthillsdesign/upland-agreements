import type { Client } from "@libsql/client";
import { nanoid } from "nanoid";

let client: Client;

function getClient(): Client {
	if (!client) {
		const url = process.env.TURSO_URL || "file:./data/local.db";
		const isRemote = url.startsWith("libsql://") || url.startsWith("https://");
		const { createClient } = isRemote ? require("@libsql/client/http") : require("@libsql/client");
		client = createClient({
			url,
			authToken: process.env.TURSO_TOKEN || undefined,
		});
	}
	return client;
}

export async function ensureSchema(): Promise<void> {
	const db = getClient();

	await db.execute(`
		CREATE TABLE IF NOT EXISTS agreements (
			id TEXT PRIMARY KEY,
			type TEXT NOT NULL,
			title TEXT NOT NULL,
			status TEXT NOT NULL DEFAULT 'draft',
			client_name TEXT,
			client_address TEXT,
			client_contact TEXT,
			client_title TEXT,
			client_email TEXT,
			effective_date TEXT,
			end_date TEXT,
			project_description TEXT,
			deliverable TEXT,
			timeframe TEXT,
			hours REAL,
			hourly_rate REAL,
			total_cost REAL,
			payment_structure TEXT,
			service_rates TEXT,
			client_responsibilities TEXT,
			custom_terms TEXT,
			designer_email TEXT DEFAULT 'joel@uplandexhibits.com',
			prompt TEXT,
			notes TEXT,
			share_token TEXT UNIQUE,
			viewed_at TEXT,
			view_count INTEGER DEFAULT 0,
			client_signature TEXT,
			designer_signature TEXT,
			valid_until TEXT,
			created_by TEXT,
			created_at TEXT NOT NULL DEFAULT (datetime('now')),
			updated_at TEXT NOT NULL DEFAULT (datetime('now'))
		)
	`);

	await db.execute(`
		CREATE TABLE IF NOT EXISTS conversations (
			id TEXT PRIMARY KEY,
			agreement_id TEXT NOT NULL,
			messages TEXT NOT NULL DEFAULT '[]',
			created_at TEXT NOT NULL DEFAULT (datetime('now')),
			FOREIGN KEY (agreement_id) REFERENCES agreements(id) ON DELETE CASCADE
		)
	`);

	await db.execute(`
		CREATE TABLE IF NOT EXISTS knowledge_base (
			id TEXT PRIMARY KEY,
			type TEXT NOT NULL,
			title TEXT NOT NULL,
			content TEXT NOT NULL,
			metadata TEXT,
			created_at TEXT NOT NULL DEFAULT (datetime('now')),
			updated_at TEXT NOT NULL DEFAULT (datetime('now'))
		)
	`);

	await db.execute(`
		CREATE TABLE IF NOT EXISTS settings (
			id INTEGER PRIMARY KEY CHECK (id = 1),
			data TEXT NOT NULL DEFAULT '{}'
		)
	`);

	await db.execute(`
		CREATE TABLE IF NOT EXISTS verification_codes (
			token TEXT PRIMARY KEY,
			code TEXT NOT NULL,
			email TEXT NOT NULL,
			expires TEXT NOT NULL
		)
	`);

	// Settings row + indexes (all independent, run in parallel)
	await Promise.all([
		db.execute("INSERT OR IGNORE INTO settings (id, data) VALUES (1, '{}')"),
		db.execute("CREATE INDEX IF NOT EXISTS idx_agreements_status ON agreements(status)"),
		db.execute("CREATE INDEX IF NOT EXISTS idx_agreements_share_token ON agreements(share_token)"),
		db.execute("CREATE INDEX IF NOT EXISTS idx_conversations_agreement ON conversations(agreement_id)"),
	]);
}

// === Agreements ===

export interface Agreement {
	id: string;
	type: string;
	title: string;
	status: string;
	client_name: string | null;
	client_address: string | null;
	client_contact: string | null;
	client_title: string | null;
	client_email: string | null;
	effective_date: string | null;
	end_date: string | null;
	project_description: string | null;
	deliverable: string | null;
	timeframe: string | null;
	hours: number | null;
	hourly_rate: number | null;
	total_cost: number | null;
	payment_structure: string | null;
	service_rates: string | null;
	client_responsibilities: string | null;
	custom_terms: string | null;
	designer_email: string | null;
	prompt: string | null;
	notes: string | null;
	share_token: string | null;
	viewed_at: string | null;
	view_count: number;
	client_signature: string | null;
	designer_signature: string | null;
	valid_until: string | null;
	created_by: string | null;
	created_at: string;
	updated_at: string;
}

export async function listAgreements(filters?: { type?: string; status?: string; search?: string }): Promise<Agreement[]> {
	const db = getClient();
	const conditions: string[] = [];
	const args: unknown[] = [];

	if (filters?.type) {
		conditions.push("type = ?");
		args.push(filters.type);
	}
	if (filters?.status) {
		conditions.push("status = ?");
		args.push(filters.status);
	}
	if (filters?.search) {
		conditions.push("(title LIKE ? OR client_name LIKE ?)");
		args.push(`%${filters.search}%`, `%${filters.search}%`);
	}

	const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
	const result = await db.execute({ sql: `SELECT * FROM agreements ${where} ORDER BY updated_at DESC`, args });
	return result.rows as unknown as Agreement[];
}

export async function getAgreement(id: string): Promise<Agreement | null> {
	const db = getClient();
	const result = await db.execute({ sql: "SELECT * FROM agreements WHERE id = ?", args: [id] });
	return (result.rows[0] as unknown as Agreement) || null;
}

export async function getAgreementByToken(token: string): Promise<Agreement | null> {
	const db = getClient();
	const result = await db.execute({ sql: "SELECT * FROM agreements WHERE share_token = ?", args: [token] });
	return (result.rows[0] as unknown as Agreement) || null;
}

export async function createAgreement(data: Partial<Agreement> & { type: string; title: string; created_by: string }): Promise<Agreement> {
	const db = getClient();
	const id = nanoid();
	const fields = { id, status: "draft", ...data };

	const cols = Object.keys(fields);
	const placeholders = cols.map(() => "?").join(", ");
	const values = cols.map((k) => (fields as Record<string, unknown>)[k]);

	await db.execute({ sql: `INSERT INTO agreements (${cols.join(", ")}) VALUES (${placeholders})`, args: values });
	return (await getAgreement(id))!;
}

export async function updateAgreement(id: string, fields: Partial<Agreement>): Promise<Agreement | null> {
	const db = getClient();
	const sets: string[] = [];
	const args: unknown[] = [];

	for (const [key, val] of Object.entries(fields)) {
		if (key === "id" || key === "created_at") continue;
		if (val !== undefined) {
			sets.push(`${key} = ?`);
			args.push(val);
		}
	}
	if (sets.length === 0) return getAgreement(id);

	sets.push("updated_at = datetime('now')");
	args.push(id);
	await db.execute({ sql: `UPDATE agreements SET ${sets.join(", ")} WHERE id = ?`, args });
	return getAgreement(id);
}

export async function deleteAgreement(id: string): Promise<void> {
	const db = getClient();
	await db.execute({ sql: "DELETE FROM agreements WHERE id = ?", args: [id] });
}

export async function duplicateAgreement(id: string, userId: string): Promise<Agreement | null> {
	const original = await getAgreement(id);
	if (!original) return null;

	const newId = nanoid();
	const db = getClient();
	await db.execute({
		sql: `INSERT INTO agreements (id, type, title, status, client_name, client_address, client_contact, client_title, client_email,
			effective_date, end_date, project_description, deliverable, timeframe, hours, hourly_rate, total_cost,
			payment_structure, service_rates, client_responsibilities, custom_terms, designer_email, prompt, notes, created_by)
			VALUES (?, ?, ?, 'draft', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		args: [
			newId, original.type, `${original.title} (Copy)`, original.client_name, original.client_address,
			original.client_contact, original.client_title, original.client_email, original.effective_date,
			original.end_date, original.project_description, original.deliverable, original.timeframe,
			original.hours, original.hourly_rate, original.total_cost, original.payment_structure,
			original.service_rates, original.client_responsibilities, original.custom_terms,
			original.designer_email, original.prompt, original.notes, userId,
		],
	});
	return getAgreement(newId);
}

export async function recordView(token: string): Promise<void> {
	const db = getClient();
	await db.execute({
		sql: `UPDATE agreements SET
			view_count = view_count + 1,
			viewed_at = COALESCE(viewed_at, datetime('now')),
			status = CASE WHEN status = 'sent' THEN 'viewed' ELSE status END,
			updated_at = datetime('now')
			WHERE share_token = ?`,
		args: [token],
	});
}

// === Conversations ===

export interface ChatMessage {
	role: "user" | "assistant";
	content: string;
	timestamp: string;
}

export async function getConversation(agreementId: string): Promise<{ id: string; messages: ChatMessage[] } | null> {
	const db = getClient();
	const result = await db.execute({ sql: "SELECT * FROM conversations WHERE agreement_id = ? ORDER BY created_at DESC LIMIT 1", args: [agreementId] });
	if (!result.rows[0]) return null;
	const row = result.rows[0] as unknown as { id: string; messages: string };
	return { id: row.id, messages: JSON.parse(row.messages) };
}

export async function saveConversation(agreementId: string, messages: ChatMessage[]): Promise<void> {
	const db = getClient();
	const existing = await getConversation(agreementId);
	if (existing) {
		await db.execute({ sql: "UPDATE conversations SET messages = ? WHERE id = ?", args: [JSON.stringify(messages), existing.id] });
	} else {
		await db.execute({ sql: "INSERT INTO conversations (id, agreement_id, messages) VALUES (?, ?, ?)", args: [nanoid(), agreementId, JSON.stringify(messages)] });
	}
}

// === Knowledge Base ===

export interface KnowledgeEntry {
	id: string;
	type: string;
	title: string;
	content: string;
	metadata: string | null;
	created_at: string;
	updated_at: string;
}

export async function listKnowledge(): Promise<KnowledgeEntry[]> {
	const db = getClient();
	const result = await db.execute("SELECT * FROM knowledge_base ORDER BY updated_at DESC");
	return result.rows as unknown as KnowledgeEntry[];
}

export async function getKnowledge(id: string): Promise<KnowledgeEntry | null> {
	const db = getClient();
	const result = await db.execute({ sql: "SELECT * FROM knowledge_base WHERE id = ?", args: [id] });
	return (result.rows[0] as unknown as KnowledgeEntry) || null;
}

export async function createKnowledge(data: { type: string; title: string; content: string; metadata?: string }): Promise<KnowledgeEntry> {
	const db = getClient();
	const id = nanoid();
	await db.execute({
		sql: "INSERT INTO knowledge_base (id, type, title, content, metadata) VALUES (?, ?, ?, ?, ?)",
		args: [id, data.type, data.title, data.content, data.metadata || null],
	});
	return (await getKnowledge(id))!;
}

export async function updateKnowledge(id: string, fields: Partial<Pick<KnowledgeEntry, "type" | "title" | "content" | "metadata">>): Promise<KnowledgeEntry | null> {
	const db = getClient();
	const sets: string[] = [];
	const args: unknown[] = [];
	for (const [key, val] of Object.entries(fields)) {
		if (val !== undefined) {
			sets.push(`${key} = ?`);
			args.push(val);
		}
	}
	if (sets.length === 0) return getKnowledge(id);
	sets.push("updated_at = datetime('now')");
	args.push(id);
	await db.execute({ sql: `UPDATE knowledge_base SET ${sets.join(", ")} WHERE id = ?`, args });
	return getKnowledge(id);
}

export async function deleteKnowledge(id: string): Promise<void> {
	const db = getClient();
	await db.execute({ sql: "DELETE FROM knowledge_base WHERE id = ?", args: [id] });
}

// === Settings ===

export async function getSettings(): Promise<Record<string, unknown>> {
	const db = getClient();
	const result = await db.execute("SELECT data FROM settings WHERE id = 1");
	if (!result.rows[0]) return {};
	return JSON.parse((result.rows[0] as unknown as { data: string }).data);
}

export async function updateSettings(data: Record<string, unknown>): Promise<Record<string, unknown>> {
	const db = getClient();
	const current = await getSettings();
	const merged = { ...current, ...data };
	await db.execute({ sql: "UPDATE settings SET data = ? WHERE id = 1", args: [JSON.stringify(merged)] });
	return merged;
}

// === Verification Codes ===

export async function saveVerificationCode(token: string, code: string, email: string, expiresAt: string): Promise<void> {
	const db = getClient();
	await db.execute({
		sql: "INSERT OR REPLACE INTO verification_codes (token, code, email, expires) VALUES (?, ?, ?, ?)",
		args: [token, code, email, expiresAt],
	});
}

export async function getVerificationCode(token: string): Promise<{ code: string; email: string; expires: string } | null> {
	const db = getClient();
	const result = await db.execute({ sql: "SELECT code, email, expires FROM verification_codes WHERE token = ?", args: [token] });
	return (result.rows[0] as unknown as { code: string; email: string; expires: string }) || null;
}

export async function deleteVerificationCode(token: string): Promise<void> {
	const db = getClient();
	await db.execute({ sql: "DELETE FROM verification_codes WHERE token = ?", args: [token] });
}
