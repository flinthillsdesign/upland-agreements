// Read-only view of the shared auth DB. ODIN owns that database — its
// schema and every write to it. This app looks up a login, and gives
// @upland/auth's request gate the two reads it needs. Nothing here creates
// or alters a table. (Local dev: scripts/seed-local.js makes the tables.)

import type { Client } from "@libsql/client";
import type { AuthStorage } from "@upland/auth";

let client: Client;

function getClient(): Client {
	if (!client) {
		const url = process.env.TURSO_AUTH_URL || "file:./data/auth.db";
		const isRemote = url.startsWith("libsql://") || url.startsWith("https://");
		const { createClient } = isRemote ? require("@libsql/client/http") : require("@libsql/client");
		client = createClient({
			url,
			authToken: process.env.TURSO_AUTH_TOKEN || undefined,
		});
	}
	return client;
}

export interface User {
	id: string;
	username: string;
	email: string | null;
	name: string;
	password_hash: string;
	role: string;
	token_invalid_before: string | null;
}

export async function getUserByUsername(username: string): Promise<User | null> {
	const db = getClient();
	const result = await db.execute({ sql: "SELECT * FROM users WHERE username = ?", args: [username] });
	return (result.rows[0] as unknown as User) || null;
}

export async function getUserByEmail(email: string): Promise<User | null> {
	const db = getClient();
	const result = await db.execute({ sql: "SELECT * FROM users WHERE email = ?", args: [email] });
	return (result.rows[0] as unknown as User) || null;
}

export async function getUserByLogin(login: string): Promise<User | null> {
	return (await getUserByUsername(login)) || getUserByEmail(login);
}

export async function getUserById(id: string): Promise<User | null> {
	const db = getClient();
	const result = await db.execute({ sql: "SELECT * FROM users WHERE id = ?", args: [id] });
	return (result.rows[0] as unknown as User) || null;
}

// What @upland/auth's gate asks of a store: the person (existence, role,
// revocation) and their grant for one app.
export const authStorage: AuthStorage = {
	async getUser(sub) {
		const u = await getUserById(sub);
		if (!u) return null;
		return { sub: u.id, role: u.role === "superadmin" ? "superadmin" : "staff", token_invalid_before: u.token_invalid_before ?? null };
	},
	async getAccess(sub, app) {
		const db = getClient();
		const r = await db.execute({
			sql: "SELECT user_id, app, permissions FROM user_app_access WHERE user_id = ? AND app = ?",
			args: [sub, app],
		});
		return (r.rows[0] as unknown as { user_id: string; app: string; permissions: string | null }) || null;
	},
};
