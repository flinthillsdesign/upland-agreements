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

// LOCAL ONLY. This seeds a known password, so it never follows TURSO_AUTH_URL
// — the app itself creates no auth tables (ODIN owns that database), so local
// dev gets them here, in ODIN's shape.
const authDb = createClient({ url: "file:./data/auth.db" });

await authDb.execute(`
	CREATE TABLE IF NOT EXISTS users (
		id TEXT PRIMARY KEY,
		username TEXT UNIQUE NOT NULL,
		password_hash TEXT NOT NULL,
		role TEXT NOT NULL CHECK(role IN ('superadmin','staff')),
		name TEXT NOT NULL,
		email TEXT,
		token_invalid_before TEXT,
		reset_token TEXT,
		reset_token_expires TEXT
	)
`);
await authDb.execute(`
	CREATE TABLE IF NOT EXISTS user_app_access (
		user_id TEXT NOT NULL,
		app TEXT NOT NULL,
		role TEXT NOT NULL DEFAULT 'viewer',
		permissions TEXT,
		created_at TEXT NOT NULL DEFAULT (datetime('now')),
		PRIMARY KEY (user_id, app),
		FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
	)
`);
// A local DB made by the old in-app schema lacks these two columns.
for (const col of ["username TEXT", "token_invalid_before TEXT"]) {
	try {
		await authDb.execute(`ALTER TABLE users ADD COLUMN ${col}`);
	} catch {
		// column already exists
	}
}

// Check if admin exists
const existing = await authDb.execute({
	sql: "SELECT id FROM users WHERE email = ?",
	args: ["admin@uplandexhibits.com"],
});

if (existing.rows.length === 0) {
	const id = nanoid();
	const hash = hashSync("admin123", 10);
	await authDb.execute({
		sql: "INSERT INTO users (id, username, email, name, password_hash, role) VALUES (?, ?, ?, ?, ?, ?)",
		args: [id, "admin", "admin@uplandexhibits.com", "Admin", hash, "superadmin"],
	});
	console.log("Created local admin user: admin@uplandexhibits.com / admin123");
} else {
	await authDb.execute({ sql: "UPDATE users SET username = COALESCE(username, 'admin') WHERE email = ?", args: ["admin@uplandexhibits.com"] });
	console.log("Admin user already exists.");
}

console.log("Bootstrap complete.");
