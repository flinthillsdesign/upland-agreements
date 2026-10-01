// Agreements auth facade — a thin front on @upland/auth: mint a token at
// login and gate staff requests with the library's own checkAccess.
// Handlers get a JwtPayload of {sub, email, role}. Passwords are changed in
// ODIN; this app only verifies one at login.

import * as upland from "@upland/auth";

export { verifyPasswordSync as verifyPassword } from "@upland/auth";

export interface JwtPayload {
	sub: string;
	email: string;
	role: string;
}

// The token's `name` claim carries the login's email — the gate hands it
// back, and countersigning falls back to it for the signer's name.
export function createToken(payload: JwtPayload): string {
	const role = payload.role === "superadmin" ? "superadmin" : "staff";
	return upland.createJWT({ sub: payload.sub, role, name: payload.email });
}

// The suite's one request gate — @upland/auth's checkAccess. A staff request
// gets in only if the token is valid, the person still exists, they haven't
// been logged out since it was minted, and they hold a grant for `app` (a
// superadmin, read from the database rather than the token, needs none).
export function checkAccess(authHeader: string | null | undefined, app: string, storage: upland.AuthStorage): Promise<upland.Decision> {
	return upland.checkAccess(upland.getAuth({ authorization: authHeader || undefined }), { app, storage });
}
