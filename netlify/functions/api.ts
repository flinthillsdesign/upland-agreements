import { nanoid } from "nanoid";
import { extractToken, verifyToken, verifyPassword, createToken, hashPassword, type JwtPayload } from "../../lib/auth.js";
import { ensureAuthSchema, getUserByLogin, getUserByEmail, getUserById, getUsers, createUser, updateUser, deleteUser, setResetToken, getUserByResetToken, clearResetToken, checkAppAccess } from "../../lib/auth-storage.js";
import { ensureSchema, listAgreements, getAgreement, createAgreement, updateAgreement, deleteAgreement, duplicateAgreement, getAgreementByToken, recordView, getConversation, saveConversation, listKnowledge, getKnowledge, createKnowledge, updateKnowledge as updateKB, deleteKnowledge as deleteKB, getSettings, updateSettings, type ChatMessage } from "../../lib/storage.js";
import { generateAgreement, chat as aiChat } from "../../lib/ai.js";
import { generateShareToken } from "../../lib/share-tokens.js";
import { sendResetEmail, sendAgreementSharedEmail, sendAgreementViewedEmail, sendAgreementSignedEmail, sendAgreementCountersignedEmail } from "../../lib/email.js";

const APP_NAME = "agreements";
let initPromise: Promise<void> | null = null;

async function init() {
	if (!initPromise) {
		initPromise = Promise.all([ensureAuthSchema(), ensureSchema()]).then(() => {});
	}
	return initPromise;
}

// Allowed fields for the generic PUT /api/agreements/:id endpoint
const EDITABLE_FIELDS = new Set([
	"title", "client_name", "client_address", "client_contact", "client_title", "client_email",
	"effective_date", "end_date", "project_description", "deliverable", "timeframe",
	"hours", "hourly_rate", "total_cost", "payment_structure", "service_rates",
	"client_responsibilities", "custom_terms", "designer_email", "notes", "valid_until",
]);

function buildSignature(name: string, ip: string, title?: string, consent?: { text: string; timestamp: string }): string {
	const sig: Record<string, unknown> = { name, timestamp: new Date().toISOString(), ip };
	if (title) sig.title = title;
	if (consent) sig.consent = consent;
	return JSON.stringify(sig);
}

// === Router ===

type RouteHandler = (req: Request, params: Record<string, string>, user: JwtPayload | null) => Promise<Response>;

interface Route {
	method: string;
	pattern: RegExp;
	paramNames: string[];
	auth: "none" | "user" | "superadmin";
	handler: RouteHandler;
}

const routes: Route[] = [];

function route(method: string, path: string, auth: "none" | "user" | "superadmin", handler: RouteHandler) {
	const paramNames: string[] = [];
	const pattern = new RegExp(
		"^" + path.replace(/:(\w+)/g, (_, name) => { paramNames.push(name); return "([^/]+)"; }) + "$"
	);
	routes.push({ method, pattern, paramNames, auth, handler });
}

function json(data: unknown, status = 200): Response {
	return new Response(JSON.stringify(data), {
		status,
		headers: { "Content-Type": "application/json" },
	});
}

function err(message: string, status = 400): Response {
	return json({ error: message }, status);
}

async function requireAuth(req: Request): Promise<JwtPayload | null> {
	const token = extractToken(req.headers.get("authorization") || undefined);
	if (!token) return null;
	return verifyToken(token);
}

function getBaseUrl(req: Request): string {
	const url = new URL(req.url);
	return `${url.protocol}//${url.host}`;
}

function getClientIp(req: Request): string {
	return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "unknown";
}

// === Auth Routes ===

route("POST", "/api/login", "none", async (req) => {
	const body = await req.json() as { username?: string; password?: string };
	const { username, password } = body;
	if (!username || !password) return err("Username and password required");

	const user = await getUserByLogin(username);
	if (!user || !verifyPassword(password, user.password_hash)) return err("Invalid credentials", 401);

	// Check app access for non-superadmins
	if (user.role !== "superadmin") {
		const access = await checkAppAccess(user.id, APP_NAME);
		if (!access) return err("No access to this application", 403);
	}

	const token = createToken({ sub: user.id, email: user.email || user.username, role: user.role });
	return json({ token, user: { id: user.id, email: user.email || user.username, name: user.name, role: user.role } });
});

route("POST", "/api/forgot-password", "none", async (req) => {
	const { email } = await req.json() as { email?: string };
	if (!email) return err("Email required");

	const token = nanoid(32);
	const expires = new Date(Date.now() + 3600000).toISOString();
	await setResetToken(email, token, expires);
	await sendResetEmail(email, token, getBaseUrl(req));
	return json({ ok: true });
});

route("POST", "/api/reset-password", "none", async (req) => {
	const { token, password } = await req.json() as { token?: string; password?: string };
	if (!token || !password) return err("Token and password required");

	const user = await getUserByResetToken(token);
	if (!user) return err("Invalid or expired reset token", 400);

	await updateUser(user.id, { password_hash: hashPassword(password) });
	await clearResetToken(user.id);
	return json({ ok: true });
});

// === Agreement Routes ===

route("GET", "/api/agreements", "user", async (req) => {
	const url = new URL(req.url);
	const filters = {
		type: url.searchParams.get("type") || undefined,
		status: url.searchParams.get("status") || undefined,
		search: url.searchParams.get("search") || undefined,
	};
	const agreements = await listAgreements(filters);
	return json(agreements);
});

route("POST", "/api/agreements", "user", async (req, _params, user) => {
	const body = await req.json() as Record<string, unknown>;
	if (!body.type || !body.title) return err("type and title required");

	const agreement = await createAgreement({
		...body as { type: string; title: string },
		created_by: user!.sub,
	});
	return json(agreement, 201);
});

route("GET", "/api/agreements/:id", "user", async (_req, params) => {
	const agreement = await getAgreement(params.id);
	if (!agreement) return err("Not found", 404);
	return json(agreement);
});

route("PUT", "/api/agreements/:id", "user", async (req, params) => {
	const body = await req.json() as Record<string, unknown>;
	// Only allow editable fields through the generic update endpoint
	const filtered: Record<string, unknown> = {};
	for (const [key, val] of Object.entries(body)) {
		if (EDITABLE_FIELDS.has(key)) filtered[key] = val;
	}
	const agreement = await updateAgreement(params.id, filtered);
	if (!agreement) return err("Not found", 404);
	return json(agreement);
});

route("DELETE", "/api/agreements/:id", "user", async (_req, params) => {
	await deleteAgreement(params.id);
	return json({ ok: true });
});

route("POST", "/api/agreements/:id/duplicate", "user", async (_req, params, user) => {
	const copy = await duplicateAgreement(params.id, user!.sub);
	if (!copy) return err("Not found", 404);
	return json(copy, 201);
});

// === AI Routes ===

route("POST", "/api/agreements/:id/generate", "user", async (req, params) => {
	const { prompt } = await req.json() as { prompt?: string };
	if (!prompt) return err("prompt required");

	const [agreement, knowledge] = await Promise.all([getAgreement(params.id), listKnowledge()]);
	if (!agreement) return err("Not found", 404);

	const result = await generateAgreement(prompt, agreement, knowledge);

	// Apply fields and save conversation in parallel
	const messages: ChatMessage[] = [
		{ role: "user", content: prompt, timestamp: new Date().toISOString() },
		{ role: "assistant", content: result.message, timestamp: new Date().toISOString() },
	];
	await Promise.all([
		result.fields ? updateAgreement(params.id, { ...result.fields, prompt }) : Promise.resolve(null),
		saveConversation(params.id, messages),
	]);

	const updated = result.fields ? await getAgreement(params.id) : agreement;
	return json({ agreement: updated, message: result.message, references: result.references });
});

route("POST", "/api/agreements/:id/chat", "user", async (req, params) => {
	const { message } = await req.json() as { message?: string };
	if (!message) return err("message required");

	const [agreement, knowledge, existing] = await Promise.all([
		getAgreement(params.id),
		listKnowledge(),
		getConversation(params.id),
	]);
	if (!agreement) return err("Not found", 404);

	const messages: ChatMessage[] = existing?.messages || [];
	messages.push({ role: "user", content: message, timestamp: new Date().toISOString() });

	const result = await aiChat(messages, agreement, knowledge);

	messages.push({ role: "assistant", content: result.message, timestamp: new Date().toISOString() });

	// Save conversation and apply fields in parallel
	await Promise.all([
		saveConversation(params.id, messages),
		result.fields ? updateAgreement(params.id, result.fields) : Promise.resolve(null),
	]);

	const updated = result.fields ? await getAgreement(params.id) : agreement;
	return json({ agreement: updated, message: result.message, references: result.references });
});

route("GET", "/api/agreements/:id/conversation", "user", async (_req, params) => {
	const conv = await getConversation(params.id);
	return json(conv || { messages: [] });
});

// === Preview (authenticated, no view tracking) ===

route("GET", "/api/agreements/:id/preview", "user", async (_req, params) => {
	const agreement = await getAgreement(params.id);
	if (!agreement) return err("Not found", 404);
	const settings = await getSettings();
	return json({ agreement, settings });
});

// === Sharing Routes ===

route("POST", "/api/agreements/:id/share", "user", async (req, params) => {
	const agreement = await getAgreement(params.id);
	if (!agreement) return err("Not found", 404);

	const { send_email } = await req.json().catch(() => ({ send_email: undefined })) as { send_email?: boolean };

	let token = agreement.share_token;
	const isNew = !token;
	if (!token) {
		token = generateShareToken();
		await updateAgreement(params.id, { share_token: token, status: "sent" });
	}

	const viewUrl = `${getBaseUrl(req)}/view.html?token=${token}`;

	// Only send email on first share, or if explicitly requested
	let emailSent = false;
	if (agreement.client_email && (isNew || send_email)) {
		await sendAgreementSharedEmail(agreement.client_email, agreement.title, viewUrl);
		emailSent = true;
	}

	return json({ token, url: viewUrl, emailSent });
});

route("DELETE", "/api/agreements/:id/share", "user", async (_req, params) => {
	await updateAgreement(params.id, { share_token: null });
	return json({ ok: true });
});

// === Client View Routes (token auth) ===

route("GET", "/api/agreements/view/:token", "none", async (req, params) => {
	const agreement = await getAgreementByToken(params.token);
	if (!agreement) return err("Not found", 404);

	await recordView(params.token);

	// Notify designer on first view
	if (agreement.view_count === 0 && agreement.designer_email) {
		const editorUrl = `${getBaseUrl(req)}/editor.html?id=${agreement.id}`;
		await sendAgreementViewedEmail(agreement.designer_email, agreement.title, agreement.client_name || "A client", editorUrl);
	}

	// Get settings for boilerplate
	const settings = await getSettings();

	return json({ agreement, settings });
});

// Verification codes stored in memory (per function instance)
const verificationCodes = new Map<string, { code: string; email: string; expires: number }>();

route("POST", "/api/agreements/view/:token/send-code", "none", async (req, params) => {
	const agreement = await getAgreementByToken(params.token);
	if (!agreement) return err("Not found", 404);
	if (agreement.client_signature) return err("Already signed");

	const { email } = await req.json() as { email?: string };
	if (!email) return err("Email required");

	const code = String(Math.floor(100000 + Math.random() * 900000));
	verificationCodes.set(params.token, { code, email, expires: Date.now() + 10 * 60 * 1000 });

	// Send code via Postmark
	const { sendVerificationCode } = await import("../../lib/email.js");
	await sendVerificationCode(email, code, agreement.title);

	return json({ ok: true });
});

route("POST", "/api/agreements/view/:token/sign", "none", async (req, params) => {
	const agreement = await getAgreementByToken(params.token);
	if (!agreement) return err("Not found", 404);
	if (agreement.client_signature) return err("Already signed");

	const { name, title, client_name, client_address, consent_text, email, code } = await req.json() as { name?: string; title?: string; client_name?: string; client_address?: string; consent_text?: string; email?: string; code?: string };
	if (!name) return err("Signature name required");
	if (!code) return err("Verification code required");

	// Verify the code
	const stored = verificationCodes.get(params.token);
	if (!stored || stored.code !== code || stored.email !== email || stored.expires < Date.now()) {
		return err("Invalid or expired verification code", 400);
	}
	verificationCodes.delete(params.token);

	const consent = consent_text ? { text: consent_text, timestamp: new Date().toISOString() } : undefined;
	const signature = buildSignature(name, getClientIp(req), title, consent);

	// Update agreement: signature + client-confirmed org info + verified email + effective date if blank
	const updates: Record<string, unknown> = { client_signature: signature, status: "signed" };
	if (client_name !== undefined) updates.client_name = client_name;
	if (client_address !== undefined) updates.client_address = client_address;
	if (email) updates.client_email = email;
	if (!agreement.effective_date) updates.effective_date = new Date().toISOString().split("T")[0];
	await updateAgreement(agreement.id, updates);

	// Notify designer
	if (agreement.designer_email) {
		const editorUrl = `${getBaseUrl(req)}/editor.html?id=${agreement.id}`;
		await sendAgreementSignedEmail(agreement.designer_email, agreement.title, name, editorUrl);
	}

	return json({ ok: true, signature: JSON.parse(signature) });
});

// === Counter-Signature ===

route("POST", "/api/agreements/:id/countersign", "user", async (req, params, user) => {
	const agreement = await getAgreement(params.id);
	if (!agreement) return err("Not found", 404);
	if (!agreement.client_signature) return err("Client must sign first");
	if (agreement.designer_signature) return err("Already countersigned");

	const { name } = await req.json() as { name?: string };

	const signature = buildSignature(name || user!.email, getClientIp(req));

	await updateAgreement(agreement.id, { designer_signature: signature, status: "countersigned" });

	// Notify client
	if (agreement.client_email && agreement.share_token) {
		const viewUrl = `${getBaseUrl(req)}/view.html?token=${agreement.share_token}`;
		await sendAgreementCountersignedEmail(agreement.client_email, agreement.title, viewUrl);
	}

	return json({ ok: true, signature: JSON.parse(signature) });
});

// === Knowledge Base ===

route("GET", "/api/knowledge", "user", async () => {
	const entries = await listKnowledge();
	return json(entries);
});

route("POST", "/api/knowledge", "user", async (req) => {
	const body = await req.json() as { type: string; title: string; content: string; metadata?: string };
	if (!body.type || !body.title || !body.content) return err("type, title, and content required");
	const entry = await createKnowledge(body);
	return json(entry, 201);
});

route("PUT", "/api/knowledge/:id", "user", async (req, params) => {
	const body = await req.json() as Record<string, unknown>;
	const entry = await updateKB(params.id, body);
	if (!entry) return err("Not found", 404);
	return json(entry);
});

route("DELETE", "/api/knowledge/:id", "user", async (_req, params) => {
	await deleteKB(params.id);
	return json({ ok: true });
});

// === Settings ===

route("GET", "/api/settings", "superadmin", async () => {
	const settings = await getSettings();
	return json(settings);
});

route("PUT", "/api/settings", "superadmin", async (req) => {
	const body = await req.json() as Record<string, unknown>;
	const settings = await updateSettings(body);
	return json(settings);
});

// === Users ===

route("GET", "/api/users", "superadmin", async () => {
	const users = await getUsers();
	return json(users.map((u) => ({ id: u.id, email: u.email, name: u.name, role: u.role, created_at: u.created_at })));
});

route("POST", "/api/users", "superadmin", async (req) => {
	const body = await req.json() as { email: string; name: string; password: string; role?: string };
	if (!body.email || !body.name || !body.password) return err("email, name, and password required");
	const id = nanoid();
	await createUser({ id, email: body.email, name: body.name, password_hash: hashPassword(body.password), role: body.role || "user" });
	return json({ id, email: body.email, name: body.name, role: body.role || "user" }, 201);
});

route("PUT", "/api/users/:id", "superadmin", async (req, params) => {
	const body = await req.json() as Record<string, string>;
	const fields: Record<string, string> = {};
	if (body.email) fields.email = body.email;
	if (body.name) fields.name = body.name;
	if (body.role) fields.role = body.role;
	if (body.password) fields.password_hash = hashPassword(body.password);
	await updateUser(params.id, fields);
	const user = await getUserById(params.id);
	if (!user) return err("Not found", 404);
	return json({ id: user.id, email: user.email, name: user.name, role: user.role });
});

route("DELETE", "/api/users/:id", "superadmin", async (_req, params) => {
	await deleteUser(params.id);
	return json({ ok: true });
});

// === Main Handler ===

export default async function handler(req: Request): Promise<Response> {
	await init();

	// CORS
	if (req.method === "OPTIONS") {
		return new Response(null, {
			headers: {
				"Access-Control-Allow-Origin": "*",
				"Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
				"Access-Control-Allow-Headers": "Content-Type, Authorization",
			},
		});
	}

	const url = new URL(req.url);
	const path = url.pathname;

	for (const r of routes) {
		if (r.method !== req.method) continue;
		const match = path.match(r.pattern);
		if (!match) continue;

		const params: Record<string, string> = {};
		r.paramNames.forEach((name, i) => { params[name] = match[i + 1]; });

		// Auth check
		let user: JwtPayload | null = null;
		if (r.auth !== "none") {
			user = await requireAuth(req);
			if (!user) return err("Unauthorized", 401);

			if (r.auth === "superadmin" && user.role !== "superadmin") {
				// Check app access
				const access = await checkAppAccess(user.sub, APP_NAME);
				if (!access || access.role !== "admin") {
					return err("Forbidden", 403);
				}
			} else if (r.auth === "user" && user.role !== "superadmin") {
				const access = await checkAppAccess(user.sub, APP_NAME);
				if (!access) return err("Forbidden", 403);
			}
		}

		try {
			const response = await r.handler(req, params, user);
			// Add CORS headers
			const headers = new Headers(response.headers);
			headers.set("Access-Control-Allow-Origin", "*");
			return new Response(response.body, { status: response.status, headers });
		} catch (error) {
			console.error("Route error:", error);
			return err("Internal server error", 500);
		}
	}

	return err("Not found", 404);
}
