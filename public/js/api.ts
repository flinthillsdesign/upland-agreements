const TOKEN_KEY = "agreements_token";
const USER_KEY = "agreements_user";

export function getToken(): string | null {
	return localStorage.getItem(TOKEN_KEY);
}

export function getUser(): { id: string; email: string; name: string; role: string } | null {
	const raw = localStorage.getItem(USER_KEY);
	return raw ? JSON.parse(raw) : null;
}

export function setAuth(token: string, user: { id: string; email: string; name: string; role: string }) {
	localStorage.setItem(TOKEN_KEY, token);
	localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function clearAuth() {
	localStorage.removeItem(TOKEN_KEY);
	localStorage.removeItem(USER_KEY);
}

export function requireAuth(): string {
	const token = getToken();
	if (!token) {
		window.location.href = "/";
		throw new Error("Not authenticated");
	}
	return token;
}

async function request(method: string, path: string, body?: unknown): Promise<unknown> {
	const token = getToken();
	const headers: Record<string, string> = { "Content-Type": "application/json" };
	if (token) headers["Authorization"] = `Bearer ${token}`;

	let res: Response;
	try {
		res = await fetch(path, {
			method,
			headers,
			body: body ? JSON.stringify(body) : undefined,
		});
	} catch {
		throw new Error("Network error — check your connection and try again");
	}

	if (res.status === 401) {
		clearAuth();
		window.location.href = "/";
		throw new Error("Unauthorized");
	}

	const text = await res.text();
	let data: unknown;
	try {
		data = JSON.parse(text);
	} catch {
		throw new Error(res.status === 502 ? "Request timed out — try again" : `Server error (${res.status})`);
	}

	if (!res.ok) throw new Error((data as { error: string }).error || "Request failed");
	return data;
}

export const api = {
	// Auth
	login: (username: string, password: string) => request("POST", "/api/login", { username, password }),

	// Agreements
	listAgreements: (params?: { type?: string; status?: string; search?: string }) => {
		const qs = new URLSearchParams();
		if (params?.type) qs.set("type", params.type);
		if (params?.status) qs.set("status", params.status);
		if (params?.search) qs.set("search", params.search);
		const q = qs.toString();
		return request("GET", `/api/agreements${q ? `?${q}` : ""}`);
	},
	getAgreement: (id: string) => request("GET", `/api/agreements/${id}`),
	createAgreement: (data: Record<string, unknown>) => request("POST", "/api/agreements", data),
	updateAgreement: (id: string, data: Record<string, unknown>) => request("PUT", `/api/agreements/${id}`, data),
	deleteAgreement: (id: string) => request("DELETE", `/api/agreements/${id}`),
	duplicateAgreement: (id: string) => request("POST", `/api/agreements/${id}/duplicate`),

	previewAgreement: (id: string) => request("GET", `/api/agreements/${id}/preview`),

	// AI
	generateAgreement: (id: string, prompt: string) => request("POST", `/api/agreements/${id}/generate`, { prompt }),
	chatAgreement: (id: string, message: string) => request("POST", `/api/agreements/${id}/chat`, { message }),
	getConversation: (id: string) => request("GET", `/api/agreements/${id}/conversation`),

	// Sharing
	shareAgreement: (id: string, sendEmail?: boolean) => request("POST", `/api/agreements/${id}/share`, sendEmail ? { send_email: true } : undefined),
	revokeShare: (id: string) => request("DELETE", `/api/agreements/${id}/share`),

	// Signatures
	countersign: (id: string, name: string) => request("POST", `/api/agreements/${id}/countersign`, { name }),

	// Client view (no auth)
	viewAgreement: (token: string) => fetch(`/api/agreements/view/${token}`).then((r) => r.json()),
	signAgreement: (token: string, data: { name: string; title?: string; client_name?: string; client_address?: string; consent_text?: string }) =>
		fetch(`/api/agreements/view/${token}/sign`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) }).then((r) => r.json()),

	// Knowledge
	listKnowledge: () => request("GET", "/api/knowledge"),
	createKnowledge: (data: Record<string, unknown>) => request("POST", "/api/knowledge", data),
	updateKnowledge: (id: string, data: Record<string, unknown>) => request("PUT", `/api/knowledge/${id}`, data),
	deleteKnowledge: (id: string) => request("DELETE", `/api/knowledge/${id}`),

	// Settings
	getSettings: () => request("GET", "/api/settings"),
	updateSettings: (data: Record<string, unknown>) => request("PUT", "/api/settings", data),

	// Users
	listUsers: () => request("GET", "/api/users"),
	createUser: (data: Record<string, unknown>) => request("POST", "/api/users", data),
	updateUser: (id: string, data: Record<string, unknown>) => request("PUT", `/api/users/${id}`, data),
	deleteUser: (id: string) => request("DELETE", `/api/users/${id}`),
};
