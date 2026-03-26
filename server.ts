import express from "express";
import { readFileSync, existsSync } from "fs";
import { resolve } from "path";

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

const PORT = parseInt(process.env.PORT || "3005", 10);
const app = express();

app.use(express.json());
app.use(express.static("public"));

// API proxy — dynamically import the handler
let handler: ((req: Request) => Promise<Response>) | null = null;

async function getHandler() {
	if (!handler) {
		const mod = await import("./netlify/functions/api.js");
		handler = mod.default;
	}
	return handler;
}

app.all("/api/*", async (req, res) => {
	try {
		const fn = await getHandler();
		const url = `http://localhost:${PORT}${req.originalUrl}`;
		const headers = new Headers();
		for (const [key, val] of Object.entries(req.headers)) {
			if (typeof val === "string") headers.set(key, val);
		}

		let body: BodyInit | undefined;
		if (["POST", "PUT", "PATCH"].includes(req.method)) {
			body = JSON.stringify(req.body);
		}

		const fetchReq = new Request(url, { method: req.method, headers, body });
		const response = await fn(fetchReq, {} as never);
		const responseBody = await response.text();

		res.status(response.status);
		response.headers.forEach((val, key) => {
			res.setHeader(key, val);
		});
		res.send(responseBody);
	} catch (error) {
		console.error("API error:", error);
		res.status(500).json({ error: "Internal server error" });
	}
});

// SPA fallback — express.static already serves existing files, so just serve index.html
app.get("*", (_req, res) => {
	res.sendFile(resolve("public/index.html"));
});

app.listen(PORT, () => {
	console.log(`Agreements dev server running at http://localhost:${PORT}`);
});
