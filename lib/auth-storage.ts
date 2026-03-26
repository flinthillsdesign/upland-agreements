import { createClient, type Client } from "@libsql/client";

let client: Client;

function getClient(): Client {
	if (!client) {
		client = createClient({
			url: process.env.TURSO_AUTH_URL || "file:./data/auth.db",
			authToken: process.env.TURSO_AUTH_TOKEN || undefined,
		});
	}
	return client;
}

export async function ensureAuthSchema(): Promise<void> {
	const db = getClient();
	await db.execute(`
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
	await db.execute(`
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
}

export async function checkAppAccess(userId: string, app: string): Promise<{ role: string; permissions: string | null } | null> {
	const db = getClient();
	const r = await db.execute({
		sql: "SELECT role, permissions FROM user_app_access WHERE user_id = ? AND app = ?",
		args: [userId, app],
	});
	return (r.rows[0] as unknown as { role: string; permissions: string | null }) || null;
}

export interface User {
	id: string;
	email: string;
	name: string;
	password_hash: string;
	role: string;
	reset_token: string | null;
	reset_expires: string | null;
	created_at: string;
	updated_at: string;
}

export async function getUserByEmail(email: string): Promise<User | null> {
	const db = getClient();
	const result = await db.execute({ sql: "SELECT * FROM users WHERE email = ?", args: [email] });
	return (result.rows[0] as unknown as User) || null;
}

export async function getUserById(id: string): Promise<User | null> {
	const db = getClient();
	const result = await db.execute({ sql: "SELECT * FROM users WHERE id = ?", args: [id] });
	return (result.rows[0] as unknown as User) || null;
}

export async function getUsers(): Promise<User[]> {
	const db = getClient();
	const result = await db.execute("SELECT * FROM users ORDER BY name");
	return result.rows as unknown as User[];
}

export async function createUser(user: { id: string; email: string; name: string; password_hash: string; role: string }): Promise<void> {
	const db = getClient();
	await db.execute({
		sql: "INSERT INTO users (id, email, name, password_hash, role) VALUES (?, ?, ?, ?, ?)",
		args: [user.id, user.email, user.name, user.password_hash, user.role],
	});
}

export async function updateUser(id: string, fields: Partial<Pick<User, "email" | "name" | "password_hash" | "role">>): Promise<void> {
	const db = getClient();
	const sets: string[] = [];
	const args: unknown[] = [];
	for (const [key, val] of Object.entries(fields)) {
		if (val !== undefined) {
			sets.push(`${key} = ?`);
			args.push(val);
		}
	}
	if (sets.length === 0) return;
	sets.push("updated_at = datetime('now')");
	args.push(id);
	await db.execute({ sql: `UPDATE users SET ${sets.join(", ")} WHERE id = ?`, args });
}

export async function deleteUser(id: string): Promise<void> {
	const db = getClient();
	await db.execute({ sql: "DELETE FROM users WHERE id = ?", args: [id] });
}

export async function setResetToken(email: string, token: string, expires: string): Promise<boolean> {
	const db = getClient();
	const result = await db.execute({
		sql: "UPDATE users SET reset_token = ?, reset_expires = ?, updated_at = datetime('now') WHERE email = ?",
		args: [token, expires, email],
	});
	return (result.rowsAffected ?? 0) > 0;
}

export async function getUserByResetToken(token: string): Promise<User | null> {
	const db = getClient();
	const result = await db.execute({
		sql: "SELECT * FROM users WHERE reset_token = ? AND reset_expires > datetime('now')",
		args: [token],
	});
	return (result.rows[0] as unknown as User) || null;
}

export async function clearResetToken(id: string): Promise<void> {
	const db = getClient();
	await db.execute({
		sql: "UPDATE users SET reset_token = NULL, reset_expires = NULL, updated_at = datetime('now') WHERE id = ?",
		args: [id],
	});
}
