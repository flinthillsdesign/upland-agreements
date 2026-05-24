// Agreements auth facade — adopts @upland/auth while preserving the
// historical ESM API: createToken/verifyToken/extractToken and the
// JwtPayload shape ({sub, email, role}).
//
// Identical pattern to Quotes (the other ESM-rewritten app). The
// facade keeps the off-spec quirks alive during the rollout so
// handlers don't change:
//   - mints tokens with the original {sub, email, role} payload
//   - verify tries @upland/auth first (shape-enforced); falls back
//     to local jsonwebtoken decode for tokens with `email` or with
//     role:"user" that @upland/auth rejects
//
// At cutover, the role:"user" tokens get reissued as role:"staff"
// per the philosophy doc decision #1, and the `email` claim drops
// if handlers don't actually rely on it.

import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import * as upland from "@upland/auth";

const JWT_SECRET = process.env.JWT_SECRET || "dev-secret";

export interface JwtPayload {
	sub: string;
	email: string;
	role: string;
}

export function hashPassword(password: string): string {
	return bcrypt.hashSync(password, 10);
}

export function verifyPassword(password: string, hash: string): boolean {
	return bcrypt.compareSync(password, hash);
}

// Cutover-state mint: new {sub, role, name} shape via @upland/auth.
// Maps the off-spec role:"user" to "staff"; drops the `email` claim
// (handlers read email from DB, not from the token).
export function createToken(payload: JwtPayload): string {
	const role = payload.role === "user" || payload.role === "editor" || payload.role === "manager" ? "staff" : (payload.role as "superadmin" | "staff");
	return upland.createJWT({ sub: payload.sub, role, name: payload.email });
}

export function verifyToken(token: string): JwtPayload | null {
	const modern = upland.verifyJWT(token) as any;
	if (modern && "role" in modern) {
		return { sub: modern.sub, email: modern.email || "", role: modern.role };
	}
	try {
		return jwt.verify(token, JWT_SECRET) as JwtPayload;
	} catch {
		return null;
	}
}

export function extractToken(authHeader: string | undefined): string | null {
	if (!authHeader?.startsWith("Bearer ")) return null;
	return authHeader.slice(7);
}
