import { createClient } from "@libsql/client";
import bcryptjs from "bcryptjs";
const { hashSync } = bcryptjs;
import { readFileSync, existsSync } from "fs";
import { nanoid } from "nanoid";

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

const authDb = createClient({
	url: process.env.TURSO_AUTH_URL || "file:./data/auth.db",
	authToken: process.env.TURSO_AUTH_TOKEN || undefined,
});

await authDb.execute(`
	CREATE TABLE IF NOT EXISTS users (
		id TEXT PRIMARY KEY,
		email TEXT NOT NULL UNIQUE,
		name TEXT NOT NULL,
		password_hash TEXT NOT NULL,
		role TEXT NOT NULL DEFAULT 'user',
		reset_token TEXT,
		reset_expires TEXT,
		created_at TEXT NOT NULL DEFAULT (datetime('now')),
		updated_at TEXT NOT NULL DEFAULT (datetime('now'))
	)
`);

// Check if admin exists
const existing = await authDb.execute({
	sql: "SELECT id FROM users WHERE email = ?",
	args: ["admin@uplandexhibits.com"],
});

if (existing.rows.length === 0) {
	const id = nanoid();
	const hash = hashSync("admin123", 10);
	await authDb.execute({
		sql: "INSERT INTO users (id, email, name, password_hash, role) VALUES (?, ?, ?, ?, ?)",
		args: [id, "admin@uplandexhibits.com", "Admin", hash, "superadmin"],
	});
	console.log("Created admin user: admin@uplandexhibits.com / admin123");
} else {
	console.log("Admin user already exists.");
}

console.log("Bootstrap complete.");
