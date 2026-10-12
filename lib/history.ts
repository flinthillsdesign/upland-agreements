// An agreement's history, oldest first: created, sent, each open, signed,
// countersigned. The events table is the record from the day it began
// (2026-10-12); for what happened before that, the agreement row and its
// share links still know the first open per address and each signature, and
// those stand in where no event was logged.

import { parseSignature } from "./render-agreement.js";
import type { Agreement, AgreementEvent, ShareLink } from "./storage.js";

export type HistoryKind = "created" | AgreementEvent["kind"];

export interface HistoryEntry {
	at: string;
	kind: HistoryKind;
	who: string | null;
	// Opens counted before the log: "first of N", so the row is honest about what it knows.
	count?: number;
}

function signerLabel(json: string | null): string | null {
	const s = parseSignature(json);
	return s ? [s.name, s.email].filter(Boolean).join(" · ") : null;
}

export function agreementHistory(a: Agreement, links: ShareLink[], events: AgreementEvent[]): HistoryEntry[] {
	const out: HistoryEntry[] = [{ at: a.created_at, kind: "created", who: null }, ...events];
	const logged = (kind: AgreementEvent["kind"]) => events.some((e) => e.kind === kind);

	if (!logged("opened")) {
		const attributed = links.reduce((n, l) => n + l.view_count, 0);
		for (const l of links) if (l.viewed_at) out.push({ at: l.viewed_at, kind: "opened", who: l.email, count: l.view_count });
		if (a.viewed_at && a.view_count > attributed) out.push({ at: a.viewed_at, kind: "opened", who: null, count: a.view_count - attributed });
	}
	const client = parseSignature(a.client_signature);
	if (client && !logged("signed")) out.push({ at: client.timestamp, kind: "signed", who: signerLabel(a.client_signature) });
	const designer = parseSignature(a.designer_signature);
	if (designer && !logged("countersigned")) out.push({ at: designer.timestamp, kind: "countersigned", who: designer.name });

	return out.sort((x, y) => x.at.localeCompare(y.at));
}
