// What another Upland tool may be told about an agreement. ODIN's Ask reads
// this as the person asking, through the same staff gate as every other
// route. An allow-list: the facts and the wording of the contract — never a
// share link, a signing code, or where a signature came from. A new column
// reaches a reader only when it is added here.

import { parseSignature, renderAgreementTerms, type SettingsData } from "./render-agreement.js";
import type { Agreement, ShareLink } from "./storage.js";

function signer(json: string | null) {
	const s = parseSignature(json);
	return s ? { name: s.name, title: s.title || null, email: s.email || null, at: s.timestamp } : null;
}

// One line of the list.
export function agreementFacts(a: Agreement) {
	return {
		id: a.id,
		type: a.type,
		title: a.title,
		status: a.status,
		client: a.client_name,
		contact: a.client_contact,
		total_cost: a.total_cost,
		hours: a.hours,
		effective_date: a.effective_date,
		end_date: a.end_date,
		sign_by: a.valid_until,
		times_opened: a.view_count,
		last_opened: a.viewed_at,
		client_signed: signer(a.client_signature),
		upland_signed: signer(a.designer_signature),
		created_at: a.created_at,
		updated_at: a.updated_at,
	};
}

// One agreement in full. `terms_html` is what the document says: the wording
// frozen at signing, or the live template for one not yet signed.
export function agreementDetail(a: Agreement, links: ShareLink[], settings: SettingsData) {
	return {
		...agreementFacts(a),
		contact_title: a.client_title,
		client_address: a.client_address,
		sent_to: links.map((l) => ({ email: l.email, times_opened: l.view_count, last_opened: l.viewed_at })),
		upland_contact: a.designer_email,
		notes: a.notes,
		terms_html: a.signed_terms || renderAgreementTerms(a, settings),
	};
}
