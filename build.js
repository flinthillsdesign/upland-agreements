import { build } from "esbuild";
import { readdirSync } from "fs";

const frontendEntries = readdirSync("public/js")
	.filter((f) => f.endsWith(".ts"))
	.map((f) => `public/js/${f}`);

// Frontend bundles
await build({
	entryPoints: frontendEntries,
	bundle: true,
	outdir: "public/js",
	outExtension: { ".js": ".js" },
	format: "esm",
	platform: "browser",
	target: "es2022",
	minify: process.argv.includes("--minify"),
	sourcemap: true,
	entryNames: "[name].bundle",
});

// Netlify function
await build({
	entryPoints: ["netlify/functions/api.ts"],
	bundle: true,
	outdir: "netlify/functions",
	outExtension: { ".js": ".mjs" },
	format: "esm",
	platform: "node",
	target: "node20",
	sourcemap: true,
	external: ["bcryptjs", "jsonwebtoken", "@anthropic-ai/sdk", "postmark", "node:module"],
	banner: {
		js: 'import { createRequire } from "module"; const require = createRequire(import.meta.url);',
	},
});

console.log("Build complete.");
