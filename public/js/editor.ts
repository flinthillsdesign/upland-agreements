import { api, requireAuth } from "./api.js";
import { esc, escHtml, TYPE_LABELS, formatCurrency, isMouType, startThinkingAnimation, stopThinkingAnimation } from "./utils.js";

requireAuth();

interface Agreement {
	id: string;
	type: string;
	title: string;
	status: string;
	client_name: string | null;
	client_address: string | null;
	client_contact: string | null;
	client_title: string | null;
	client_email: string | null;
	effective_date: string | null;
	end_date: string | null;
	project_description: string | null;
	deliverable: string | null;
	timeframe: string | null;
	hours: number | null;
	hourly_rate: number | null;
	total_cost: number | null;
	payment_structure: string | null;
	service_rates: string | null;
	client_responsibilities: string | null;
	custom_terms: string | null;
	designer_email: string | null;
	notes: string | null;
	share_token: string | null;
	client_signature: string | null;
	designer_signature: string | null;
	valid_until: string | null;
}

const params = new URLSearchParams(window.location.search);
const agreementId = params.get("id");
if (!agreementId) window.location.href = "/dashboard.html";

let agreement: Agreement | null = null;
let conversationStarted = false;

// Batched auto-save: collect dirty fields and flush once
let dirtyFields: Record<string, unknown> = {};
let saveTimeout: ReturnType<typeof setTimeout>;

function markDirty(field: string, value: unknown) {
	dirtyFields[field] = value;
	clearTimeout(saveTimeout);
	saveTimeout = setTimeout(flushSave, 500);
}

async function flushSave() {
	const fields = dirtyFields;
	dirtyFields = {};
	if (Object.keys(fields).length === 0) return;
	await api.updateAgreement(agreementId!, fields);
}

async function load() {
	agreement = (await api.getAgreement(agreementId!)) as Agreement;
	document.getElementById("navTitle")!.textContent = agreement.title;
	document.getElementById("statusBadge")!.textContent = agreement.status;
	document.getElementById("statusBadge")!.className = `status-badge status-${agreement.status}`;
	document.getElementById("typeBadge")!.textContent = TYPE_LABELS[agreement.type as keyof typeof TYPE_LABELS] || agreement.type;
	document.title = `${agreement.title} — Agreements`;
	renderForm();
	loadConversation().catch((err) => console.error("Failed to load conversation:", err));
}

function renderForm() {
	if (!agreement) return;
	const main = document.getElementById("editorMain")!;
	const isMou = isMouType(agreement.type);

	main.innerHTML = `
		<div class="agreement-form">
			<!-- Client Info -->
			<div class="form-section">
				<div class="form-section-header"><h2>Client Information</h2></div>
				<div class="form-section-body">
					<div class="form-row">
						<div class="form-group flex-2">
							<label>Client / Organization Name</label>
							<input type="text" data-field="client_name" value="${esc(agreement.client_name)}">
						</div>
						<div class="form-group">
							<label>Contact Person</label>
							<input type="text" data-field="client_contact" value="${esc(agreement.client_contact)}">
						</div>
					</div>
					<div class="form-row">
						<div class="form-group flex-2">
							<label>Address</label>
							<input type="text" data-field="client_address" value="${esc(agreement.client_address)}">
						</div>
						<div class="form-group">
							<label>Email</label>
							<input type="email" data-field="client_email" value="${esc(agreement.client_email)}">
						</div>
					</div>
					<div class="form-row">
						<div class="form-group">
							<label>Contact Title</label>
							<input type="text" data-field="client_title" value="${esc(agreement.client_title)}" placeholder="e.g., Executive Director">
						</div>
					</div>
				</div>
			</div>

			<!-- Project Details -->
			<div class="form-section">
				<div class="form-section-header"><h2>${isMou ? "Scope of Work / Deliverable" : "Description of Services"}</h2></div>
				<div class="form-section-body">
					<div class="form-group" style="margin-bottom:8px">
						<label>Project Title</label>
						<input type="text" data-field="title" value="${esc(agreement.title)}">
					</div>
					<div class="form-group" style="margin-bottom:8px">
						<label>${isMou ? "Scope of Work / Deliverable" : "Description of Services"}</label>
						<textarea data-field="project_description" rows="6">${esc(agreement.project_description)}</textarea>
					</div>
					${isMou ? `
					<div class="form-group" style="margin-bottom:8px">
						<label>Deliverable Description</label>
						<textarea data-field="deliverable" rows="4">${esc(agreement.deliverable)}</textarea>
					</div>` : ""}
					<div class="form-group">
						<label>Timeframe</label>
						<input type="text" data-field="timeframe" value="${esc(agreement.timeframe)}" placeholder="${isMou ? "e.g., Goal is to deliver PDF within 8 weeks after MoU is signed" : "e.g., Contract term description"}">
					</div>
				</div>
			</div>

			<!-- Pricing -->
			<div class="form-section">
				<div class="form-section-header"><h2>${isMou ? "Cost" : "Project Cost & Payment"}</h2></div>
				<div class="form-section-body">
					${isMou ? `
					<div class="form-row">
						<div class="form-group">
							<label>Hours</label>
							<input type="number" data-field="hours" value="${agreement.hours || ""}" step="1">
						</div>
						<div class="form-group">
							<label>Hourly Rate ($)</label>
							<input type="number" data-field="hourly_rate" value="${agreement.hourly_rate || ""}" step="5">
						</div>
						<div class="form-group">
							<label>Total Cost</label>
							<div class="calculated-field" id="totalCost">${agreement.total_cost ? "$" + agreement.total_cost.toLocaleString() : "—"}</div>
						</div>
					</div>` : `
					<div class="form-row">
						<div class="form-group">
							<label>NTE (Not-to-Exceed) Amount ($)</label>
							<input type="number" data-field="total_cost" value="${agreement.total_cost || ""}" step="0.01">
						</div>
					</div>
					<div class="form-row">
						<div class="form-group">
							<label>Effective Date</label>
							<input type="date" data-field="effective_date" value="${agreement.effective_date || ""}">
						</div>
						<div class="form-group">
							<label>End Date</label>
							<input type="date" data-field="end_date" value="${agreement.end_date || ""}">
						</div>
					</div>
					<div class="form-group" style="margin-bottom:8px">
						<label>Payment Structure (JSON)</label>
						<textarea data-field="payment_structure" rows="4">${esc(agreement.payment_structure)}</textarea>
					</div>
					<div class="form-group" style="margin-bottom:8px">
						<label>Service Rates (JSON)</label>
						<textarea data-field="service_rates" rows="4">${esc(agreement.service_rates)}</textarea>
					</div>
					<div class="form-group">
						<label>Client Responsibilities</label>
						<textarea data-field="client_responsibilities" rows="6">${esc(agreement.client_responsibilities)}</textarea>
					</div>`}
				</div>
			</div>

			<!-- Boilerplate -->
			<div class="boilerplate-section" id="boilerplateTerms">
				<div class="boilerplate-header">
					<h3>Standard Terms (${TYPE_LABELS[agreement.type]})</h3>
					<span class="boilerplate-arrow">&#9660;</span>
				</div>
				<div class="boilerplate-body">
					<div class="boilerplate-text">${getBoilerplateText(agreement.type)}</div>
				</div>
			</div>

			<!-- Notes -->
			<div class="form-section">
				<div class="form-section-header"><h2>Internal Notes</h2></div>
				<div class="form-section-body">
					<div class="form-group">
						<textarea data-field="notes" rows="3" placeholder="Internal notes (not shown to client)">${esc(agreement.notes)}</textarea>
					</div>
				</div>
			</div>
		</div>
	`;

	// Auto-save on input changes (batched)
	main.querySelectorAll("[data-field]").forEach((el) => {
		const field = (el as HTMLElement).dataset.field!;
		el.addEventListener("input", () => {
			const value = el instanceof HTMLInputElement && el.type === "number" ? (el.value ? parseFloat(el.value) : null) : (el as HTMLInputElement | HTMLTextAreaElement).value;

			// Update local state
			(agreement as Record<string, unknown>)[field] = value;

			// Auto-calculate for MoUs
			if (isMou && (field === "hours" || field === "hourly_rate")) {
				const hours = agreement!.hours || 0;
				const rate = agreement!.hourly_rate || 0;
				agreement!.total_cost = hours * rate;
				const costEl = document.getElementById("totalCost");
				if (costEl) costEl.textContent = formatCurrency(agreement!.total_cost) || "—";
				markDirty("total_cost", agreement!.total_cost);
			}

			if (field === "title") {
				document.getElementById("navTitle")!.textContent = (el as HTMLInputElement).value;
			}

			markDirty(field, value);
		});
	});

	// Boilerplate toggle
	const bp = document.getElementById("boilerplateTerms")!;
	bp.querySelector(".boilerplate-header")!.addEventListener("click", () => {
		bp.classList.toggle("expanded");
	});
}

function getBoilerplateText(type: string): string {
	if (isMouType(type)) {
		let text = `TITLE AND ASSIGNMENT.
- Client Content: All materials, information, and content provided by the Client shall remain the sole property of Client.
- Final Art: All original works created by Designer specifically for this project shall be considered works made for hire, the property of Client upon full payment.
- Third Party Materials: Third party materials are the exclusive property of their respective owners.
- Preliminary Works: All preliminary works, sketches, and concepts not selected as Final Art remain the exclusive property of Designer.
- All intellectual property rights to systems, hardware, and software developed by Designer remain the exclusive property of Designer, with license granted to Client for project use.

ACCREDITATION/PROMOTIONS. Either party may reproduce, publish and display photographs of the Project in portfolios, promotional materials, and professional publications.`;

		if (type === "mou_small") {
			text += `\n\nFINAL APPROVAL. Client shall provide final proofreading and approval of all Final Art before its release for production. If the Client approves work containing errors or omissions, such as, by way of example, not limitation, typographic errors or misspellings, Client shall incur the cost of correcting such errors.`;
		}
		return text;
	}

	return `7. PAYMENT TERMS. All invoices are due and payable within 30 days (NET30). Past due amounts accrue interest at 18% per annum. Client responsible for collection costs including reasonable attorney fees.

8. REMEDIES FOR NON-PAYMENT. Non-payment constitutes material breach. Designer may cancel agreement, suspend work, and recover all amounts due plus damages.

9. BEST EFFORTS BASIS. Designer will use best professional efforts. Non-acceptance of a design does not justify non-payment for services rendered.

10. CHANGES. Additional charges apply for out-of-scope changes. All changes require written agreement.

13. TITLE AND ASSIGNMENT. Standard IP terms (same as MoU).

14. ACCREDITATION/PROMOTIONS. Standard promotional rights.

15. WARRANTIES AND REPRESENTATIONS. Designer: timely service, 2-year defect warranty, no infringement. Client: owns provided content, no infringement.

16. CONFIDENTIAL INFORMATION. Mutual NDA on proprietary information.

17. RELATIONSHIP OF THE PARTIES. Independent contractor, not employee.

18. NO EXCLUSIVITY. Both parties free to work with others.

19. INDEMNIFICATION; HOLD HARMLESS. Mutual indemnification for negligence, breach, and unlawful content.

20. LIMITATION OF LIABILITY. Designer's max liability = 50% of total compensation. No consequential damages.

21. DEFAULT. 30-day cure period (5 business days for non-payment).

22. FORCE MAJEURE. Standard force majeure clause.

24. ENTIRE AGREEMENT. This is the whole deal, supersedes prior agreements.

25. AMENDMENT. Written and signed by both parties.

26. SEVERABILITY. Invalid provisions don't void the rest.

27. WAIVER OF CONTRACTUAL RIGHT. Non-enforcement isn't waiver.

28. APPLICABLE LAW. State of Kansas.`;
}

// === Chat ===

interface ChatMessage {
	role: string;
	content: string;
	timestamp: string;
}

async function loadConversation() {
	const data = (await api.getConversation(agreementId!)) as { messages: ChatMessage[] };
	if (data.messages && data.messages.length > 0) {
		conversationStarted = true;
		renderMessages(data.messages);
	}
}

function renderMessages(messages: ChatMessage[]) {
	const container = document.getElementById("chatMessages")!;
	container.innerHTML = messages
		.map(
			(m) => `<div class="chat-message ${m.role}">${escHtml(m.content)}</div>`
		)
		.join("");
	container.scrollTop = container.scrollHeight;
}

function addMessage(role: string, content: string) {
	const container = document.getElementById("chatMessages")!;
	// Clear empty state
	const empty = container.querySelector(".chat-empty");
	if (empty) empty.remove();

	const div = document.createElement("div");
	div.className = `chat-message ${role}`;
	div.innerHTML = escHtml(content);
	container.appendChild(div);
	container.scrollTop = container.scrollHeight;
}

document.getElementById("chatSend")!.addEventListener("click", sendChat);
document.getElementById("chatInput")!.addEventListener("keydown", (e) => {
	if (e.key === "Enter" && !e.shiftKey) {
		e.preventDefault();
		sendChat();
	}
});

async function sendChat() {
	const input = document.getElementById("chatInput") as HTMLTextAreaElement;
	const message = input.value.trim();
	if (!message) return;

	input.value = "";
	addMessage("user", message);

	// Show thinking animation
	const container = document.getElementById("chatMessages")!;
	const thinkingEl = document.createElement("div");
	thinkingEl.className = "chat-message assistant";
	container.appendChild(thinkingEl);
	container.scrollTop = container.scrollHeight;
	startThinkingAnimation(thinkingEl);

	const sendBtn = document.getElementById("chatSend") as HTMLButtonElement;
	sendBtn.disabled = true;

	try {
		let result: { message: string; agreement?: Agreement; references?: string[] };
		if (!conversationStarted && !agreement?.project_description) {
			result = (await api.generateAgreement(agreementId!, message)) as typeof result;
		} else {
			result = (await api.chatAgreement(agreementId!, message)) as typeof result;
		}

		stopThinkingAnimation();
		thinkingEl.remove();

		let responseText = result.message;
		if (result.references && result.references.length > 0) {
			responseText += "\n\nReferenced: " + result.references.join(", ");
		}
		addMessage("assistant", responseText);
		conversationStarted = true;

		// Update form with new data
		if (result.agreement) {
			agreement = result.agreement;
			renderForm();
		}
	} catch (err) {
		stopThinkingAnimation();
		thinkingEl.remove();
		addMessage("assistant", `Error: ${(err as Error).message}`);
	}

	sendBtn.disabled = false;
}

// === Chat toggle ===
document.getElementById("chatToggle")!.addEventListener("click", () => {
	document.getElementById("chatSidebar")!.classList.toggle("collapsed");
});

// === More menu ===
document.getElementById("moreBtn")!.addEventListener("click", (e) => {
	e.stopPropagation();
	document.getElementById("moreMenu")!.classList.toggle("open");
});
document.addEventListener("click", () => {
	document.getElementById("moreMenu")!.classList.remove("open");
});

// === Actions ===
document.getElementById("previewBtn")!.addEventListener("click", () => {
	window.open(`/view.html?id=${agreementId}`, "_blank");
});

document.getElementById("duplicateBtn")!.addEventListener("click", async () => {
	const copy = (await api.duplicateAgreement(agreementId!)) as { id: string };
	window.location.href = `/editor.html?id=${copy.id}`;
});

document.getElementById("deleteBtn")!.addEventListener("click", async () => {
	if (!confirm("Delete this agreement? This cannot be undone.")) return;
	await api.deleteAgreement(agreementId!);
	window.location.href = "/dashboard.html";
});

document.getElementById("countersignBtn")!.addEventListener("click", async () => {
	const name = prompt("Enter your name to countersign:");
	if (!name) return;
	try {
		await api.countersign(agreementId!, name);
		alert("Agreement countersigned.");
		load();
	} catch (err) {
		alert((err as Error).message);
	}
});

// === Share modal ===
const shareModal = document.getElementById("shareModal")!;
document.getElementById("shareBtn")!.addEventListener("click", () => {
	if (!agreement) return;
	const linkField = document.getElementById("shareLinkField")!;
	const revokeBtn = document.getElementById("revokeShareLink")!;
	if (agreement.share_token) {
		const url = `${window.location.origin}/view.html?token=${agreement.share_token}`;
		(document.getElementById("shareLinkInput") as HTMLInputElement).value = url;
		linkField.hidden = false;
		revokeBtn.hidden = false;
	} else {
		linkField.hidden = true;
		revokeBtn.hidden = true;
	}
	shareModal.hidden = false;
});
document.getElementById("closeShare")!.addEventListener("click", () => { shareModal.hidden = true; });
shareModal.querySelector(".modal-backdrop")!.addEventListener("click", () => { shareModal.hidden = true; });

document.getElementById("generateShareLink")!.addEventListener("click", async () => {
	const data = (await api.shareAgreement(agreementId!)) as { token: string; url: string };
	agreement.share_token = data.token;
	(document.getElementById("shareLinkInput") as HTMLInputElement).value = data.url;
	document.getElementById("shareLinkField")!.hidden = false;
	document.getElementById("revokeShareLink")!.hidden = false;
});

document.getElementById("copyShareLink")!.addEventListener("click", () => {
	const input = document.getElementById("shareLinkInput") as HTMLInputElement;
	navigator.clipboard.writeText(input.value);
});

document.getElementById("revokeShareLink")!.addEventListener("click", async () => {
	if (!confirm("Revoke the share link? The client will no longer be able to access this agreement.")) return;
	await api.revokeShare(agreementId!);
	agreement.share_token = null;
	document.getElementById("shareLinkField")!.hidden = true;
	document.getElementById("revokeShareLink")!.hidden = true;
});

// Initial load
load();
