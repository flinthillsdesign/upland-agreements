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

function setSaveStatus(status: "dirty" | "saving" | "saved" | "error") {
	const el = document.getElementById("saveStatus");
	if (!el) return;
	el.textContent = status === "dirty" ? "Unsaved changes" : status === "saving" ? "Saving..." : status === "saved" ? "Saved" : "Save failed";
	el.className = `save-status ${status}`;
	if (status === "saved") {
		setTimeout(() => { if (el.className.includes("saved")) { el.textContent = ""; el.className = "save-status"; } }, 2000);
	}
}

function markDirty(field: string, value: unknown) {
	dirtyFields[field] = value;
	clearTimeout(saveTimeout);
	setSaveStatus("dirty");
	saveTimeout = setTimeout(flushSave, 500);
}

async function flushSave() {
	const fields = dirtyFields;
	dirtyFields = {};
	if (Object.keys(fields).length === 0) return;
	setSaveStatus("saving");
	try {
		await api.updateAgreement(agreementId!, fields);
		setSaveStatus("saved");
	} catch {
		setSaveStatus("error");
	}
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

function getDurationMonths(a: Record<string, unknown>): string {
	const dateStr = (a.end_date || a.timeframe_date || "") as string;
	if (!dateStr) return "";
	const target = new Date(dateStr + "T00:00:00");
	const now = new Date();
	const months = Math.round((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24 * 30));
	return months > 0 ? String(months) : "";
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
					<div class="form-row">
						<div class="form-group">
							<label>Duration (months)</label>
							<input type="number" id="durationMonths" min="0.5" step="0.5" placeholder="e.g., 3" value="${getDurationMonths(agreement)}">
						</div>
						<div class="form-group flex-2">
							<label>${isMou ? "Target Delivery Date" : "End Date"}</label>
							<input type="date" id="targetDate" data-field="${isMou ? "timeframe_date" : "end_date"}" value="${isMou ? (agreement as any).timeframe_date || "" : agreement.end_date || ""}">
						</div>
					</div>
					<input type="hidden" data-field="timeframe" value="${esc(agreement.timeframe)}">
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
					</div>` : (() => {
					let ps = { initial_pct: 10, initial_amount: 0, final_pct: 10, final_amount: 0 };
					let sr = { head_rate: 95, design_rate: 75, fab_rate: 65, materials_markup: 15, travel_rate: 55 };
					try { if (agreement.payment_structure) ps = typeof agreement.payment_structure === "string" ? JSON.parse(agreement.payment_structure) : agreement.payment_structure; } catch {}
					try { if (agreement.service_rates) sr = typeof agreement.service_rates === "string" ? JSON.parse(agreement.service_rates) : agreement.service_rates; } catch {}
					return `
					<div class="form-row">
						<div class="form-group">
							<label>Not-to-Exceed (NTE) Amount ($)</label>
							<input type="number" data-field="total_cost" value="${agreement.total_cost || ""}" step="1000">
						</div>
						<div class="form-group">
							<label>Effective Date (blank = date of signing)</label>
							<input type="date" data-field="effective_date" value="${agreement.effective_date || ""}">
						</div>
					</div>
					<div style="margin-bottom:12px">
						<label style="font-size:0.78rem;font-weight:500;color:var(--text-muted);margin-bottom:6px;display:block">Payment Schedule</label>
						<div class="form-row">
							<div class="form-group" style="flex:0 0 80px">
								<label>Initial %</label>
								<input type="number" id="ps_initial_pct" value="${ps.initial_pct}" step="1" min="0" max="100">
							</div>
							<div class="form-group" style="flex:0 0 80px">
								<label>Final %</label>
								<input type="number" id="ps_final_pct" value="${ps.final_pct}" step="1" min="0" max="100">
							</div>
							<div class="form-group" style="flex:1">
								<label>Payment Breakdown</label>
								<div class="calculated-field" id="paymentCalc"></div>
							</div>
						</div>
					</div>
					<div style="margin-bottom:12px">
						<button type="button" class="btn btn-ghost btn-sm" id="toggleRates" style="font-size:0.78rem;color:var(--text-muted);padding:4px 0">Service Rates (using standard rates) &#9656;</button>
						<div id="ratesFields" hidden>
							<div class="form-row" style="margin-top:8px">
								<div class="form-group">
									<label>Head of Design/Fab ($/hr)</label>
									<input type="number" id="sr_head" value="${sr.head_rate}" step="5">
								</div>
								<div class="form-group">
									<label>Design Staff ($/hr)</label>
									<input type="number" id="sr_design" value="${sr.design_rate}" step="5">
								</div>
								<div class="form-group">
									<label>Fab Staff ($/hr)</label>
									<input type="number" id="sr_fab" value="${sr.fab_rate}" step="5">
								</div>
							</div>
							<div class="form-row">
								<div class="form-group">
									<label>Travel ($/hr)</label>
									<input type="number" id="sr_travel" value="${sr.travel_rate}" step="5">
								</div>
								<div class="form-group">
									<label>Materials Markup %</label>
									<input type="number" id="sr_materials" value="${sr.materials_markup}" step="1">
								</div>
							</div>
						</div>
					</div>
					<div style="margin-bottom:12px">
						<button type="button" class="btn btn-ghost btn-sm" id="toggleResponsibilities" style="font-size:0.78rem;color:var(--text-muted);padding:4px 0">Additional Client Responsibilities (standard list included) &#9656;</button>
						<div id="responsibilitiesFields" hidden>
							<textarea data-field="client_responsibilities" rows="3" style="margin-top:8px;width:100%" placeholder="Any project-specific responsibilities beyond the standard list...">${esc(agreement.client_responsibilities)}</textarea>
						</div>
					</div>`;
				})()}
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

	// Payment structure + service rates (full agreements) — sync individual fields to JSON
	if (!isMou) {
		const psFields = ["ps_initial_pct", "ps_final_pct"];
		const srFields = ["sr_head", "sr_design", "sr_fab", "sr_travel", "sr_materials"];

		function savePaymentStructure() {
			const nte = agreement!.total_cost || 0;
			const iPct = parseFloat((document.getElementById("ps_initial_pct") as HTMLInputElement)?.value) || 0;
			const fPct = parseFloat((document.getElementById("ps_final_pct") as HTMLInputElement)?.value) || 0;
			const iAmt = Math.round(nte * iPct / 100);
			const fAmt = Math.round(nte * fPct / 100);
			const data = {
				initial_pct: iPct,
				initial_amount: iAmt,
				progress_note: "Progress billings will be invoiced on a percentage of completion basis, not to exceed 90% of the NTE Amount.",
				final_pct: fPct,
				final_amount: fAmt,
			};
			(agreement as Record<string, unknown>).payment_structure = JSON.stringify(data);
			markDirty("payment_structure", JSON.stringify(data));
			// Update calculated display
			const calcEl = document.getElementById("paymentCalc");
			if (calcEl && nte) {
				calcEl.textContent = `${formatCurrency(iAmt)} initial / progress to 90% / ${formatCurrency(fAmt)} final`;
			}
		}

		// Recalculate payment when NTE changes
		const nteInput = main.querySelector("[data-field='total_cost']") as HTMLInputElement;
		nteInput?.addEventListener("input", savePaymentStructure);

		function saveServiceRates() {
			const data = {
				head_rate: parseFloat((document.getElementById("sr_head") as HTMLInputElement)?.value) || 0,
				design_rate: parseFloat((document.getElementById("sr_design") as HTMLInputElement)?.value) || 0,
				fab_rate: parseFloat((document.getElementById("sr_fab") as HTMLInputElement)?.value) || 0,
				materials_markup: parseFloat((document.getElementById("sr_materials") as HTMLInputElement)?.value) || 0,
				travel_rate: parseFloat((document.getElementById("sr_travel") as HTMLInputElement)?.value) || 0,
			};
			(agreement as Record<string, unknown>).service_rates = JSON.stringify(data);
			markDirty("service_rates", JSON.stringify(data));
		}

		psFields.forEach((id) => document.getElementById(id)?.addEventListener("input", savePaymentStructure));
		savePaymentStructure(); // initial calculation
		srFields.forEach((id) => document.getElementById(id)?.addEventListener("input", saveServiceRates));

		document.getElementById("toggleRates")?.addEventListener("click", () => {
			const fields = document.getElementById("ratesFields")!;
			const btn = document.getElementById("toggleRates")!;
			if (fields.hidden) {
				fields.hidden = false;
				btn.innerHTML = "Service Rates &#9662;";
			} else {
				fields.hidden = true;
				btn.innerHTML = "Service Rates (using standard rates) &#9656;";
			}
		});

		document.getElementById("toggleResponsibilities")?.addEventListener("click", () => {
			const fields = document.getElementById("responsibilitiesFields")!;
			const btn = document.getElementById("toggleResponsibilities")!;
			if (fields.hidden) {
				fields.hidden = false;
				btn.innerHTML = "Additional Client Responsibilities &#9662;";
			} else {
				fields.hidden = true;
				btn.innerHTML = "Additional Client Responsibilities (standard list included) &#9656;";
			}
		});
	}

	// Duration months -> date picker sync
	const durationInput = document.getElementById("durationMonths") as HTMLInputElement;
	const dateInput = document.getElementById("targetDate") as HTMLInputElement;
	if (durationInput && dateInput) {
		durationInput.addEventListener("input", () => {
			const months = parseFloat(durationInput.value);
			if (!months || months <= 0) return;
			const target = new Date();
			target.setTime(target.getTime() + months * 30.44 * 24 * 60 * 60 * 1000);
			dateInput.value = target.toISOString().split("T")[0];
			dateInput.dispatchEvent(new Event("input", { bubbles: true }));
			updateTimeframeText();
		});
		dateInput.addEventListener("input", () => {
			// Update months display from date
			if (dateInput.value) {
				const target = new Date(dateInput.value + "T00:00:00");
				const now = new Date();
				const diffMs = target.getTime() - now.getTime();
				const diffMonths = diffMs / (1000 * 60 * 60 * 24 * 30.44);
				durationInput.value = diffMonths > 0 ? diffMonths.toFixed(1) : "";
			}
			updateTimeframeText();
		});
	}

	function updateTimeframeText() {
		if (!dateInput?.value) return;
		const date = new Date(dateInput.value + "T00:00:00");
		const formatted = date.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
		const timeframeText = isMou
			? `Goal is to deliver PDF by ${formatted}`
			: formatted;
		const hidden = main.querySelector("[data-field='timeframe']") as HTMLInputElement;
		if (hidden) {
			hidden.value = timeframeText;
			(agreement as Record<string, unknown>).timeframe = timeframeText;
			markDirty("timeframe", timeframeText);
		}
		if (!isMou) {
			(agreement as Record<string, unknown>).end_date = dateInput.value;
			markDirty("end_date", dateInput.value);
		}
	}

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

	return `7. PAYMENT TERMS AND REMEDIES. NET30 via email. Interest at 18%/year or max allowed by law. Collection costs including attorney fees. Non-payment is material breach — Upland may cancel, suspend, and/or seek legal remedies.

8. BEST EFFORTS BASIS. Designs based on training, experience, and professional judgment. Non-acceptance of designs shall not constitute reason for non-payment.

9. CHANGES. Out-of-scope changes billed T&M at Service Rates, despite any NTE. Schedule may extend. Approved by signed writing or email. Rework of previously approved work is Additional Services.

11. CLIENT RESPONSIBILITIES. Standard list (a-i): decision-making, Client Content, site info, naming approvals, electrical/structural, existing displays, space prep, final approval, ADA compliance.

12. SCHEDULE; CLIENT DELAYS. Client delays automatically extend schedule. Additional costs billed as Additional Services.

13. SUBSTITUTIONS. Designer may substitute materials/methods of comparable quality when required by availability, field conditions, codes, etc.

14. TITLE AND ASSIGNMENT. Full IP terms: Client Content, Final Art (work-for-hire), Third Party Materials (Client indemnifies), Preliminary Works (Designer's), Designer IP (Designer's with license to Client).

15. ACCREDITATION/PROMOTIONS. Either party may use project in promotional materials.

16. WARRANTIES AND REPRESENTATIONS. Designer represents, warrants, and covenants: timely service, 2-year defect warranty, no infringement. Client: owns content, no infringement.

17. CONFIDENTIAL INFORMATION. Mutual strict confidence. Includes Preliminary Works. Excludes public domain info.

18. RELATIONSHIP OF THE PARTIES. Independent contractor. Designer pays subs, indemnifies Client for sub non-payment.

19. NO EXCLUSIVITY. Both parties free to work with others.

20. INDEMNIFICATION; HOLD HARMLESS. Asymmetric. Threshold: gross negligence, recklessness, intentional wrongful conduct.

21. LIMITATION OF LIABILITY. Designer's max = 50% of compensation paid. No consequential/indirect/punitive damages.

22. DEFAULT, SUSPENSION, AND TERMINATION. Defer performance until cured. 30 days to cure (5 for non-payment). Auto-termination. Pause 30+ days: invoice all work, restart fee. On termination: Client pays all services, materials, commitments, and close-out costs.

23. FORCE MAJEURE. Written notice. Obligations suspended. Duty to mitigate and resume.

24. NOTICE. Via email with deemed-receipt rule.

25. GENERAL PROVISIONS. (a) Entire Agreement — supersedes all prior. (b) Amendment — written and signed. (c) Severability — court may narrow. (d) Waiver — non-enforcement isn't waiver. (e) Applicable Law — State of Kansas.`;
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
function toggleChat() {
	const sidebar = document.getElementById("chatSidebar")!;
	const fab = document.getElementById("chatFab")!;
	sidebar.classList.toggle("collapsed");
	fab.hidden = !sidebar.classList.contains("collapsed");
}
document.getElementById("chatToggle")!.addEventListener("click", toggleChat);
document.getElementById("chatFab")!.addEventListener("click", toggleChat);

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
	const title = prompt("Your title (e.g., CEO):");
	try {
		await api.countersign(agreementId!, name, title || "");
		alert("Agreement countersigned.");
		load();
	} catch (err) {
		alert((err as Error).message);
	}
});

// === Share modal ===
const shareModal = document.getElementById("shareModal")!;

function showShareState() {
	const hasToken = !!agreement?.share_token;
	document.getElementById("shareLinkField")!.hidden = !hasToken;
	document.getElementById("shareActions")!.hidden = hasToken;
	document.getElementById("shareManage")!.hidden = !hasToken;
	document.getElementById("shareStatus")!.hidden = true;
	document.getElementById("shareDescription")!.textContent = hasToken
		? "This agreement has been shared with your client."
		: "Generate a shareable link for your client to review and sign.";
	if (hasToken) {
		(document.getElementById("shareLinkInput") as HTMLInputElement).value = `${window.location.origin}/view.html?token=${agreement!.share_token}`;
	}
}

document.getElementById("shareBtn")!.addEventListener("click", () => {
	if (!agreement) return;
	showShareState();
	shareModal.hidden = false;
});
document.getElementById("closeShare")!.addEventListener("click", () => { shareModal.hidden = true; });
shareModal.querySelector(".modal-backdrop")!.addEventListener("click", () => { shareModal.hidden = true; });

document.getElementById("generateShareLink")!.addEventListener("click", async () => {
	const btn = document.getElementById("generateShareLink") as HTMLButtonElement;
	btn.disabled = true;
	btn.textContent = "Sending...";
	const data = (await api.shareAgreement(agreementId!)) as { token: string; url: string; emailSent: boolean };
	agreement!.share_token = data.token;
	showShareState();
	const status = document.getElementById("shareStatus")!;
	status.textContent = data.emailSent ? "Link generated and email sent to client." : "Link generated.";
	status.hidden = false;
	btn.disabled = false;
	btn.textContent = "Generate & Send Link";
});

document.getElementById("resendEmail")!.addEventListener("click", async () => {
	const btn = document.getElementById("resendEmail") as HTMLButtonElement;
	btn.disabled = true;
	btn.textContent = "Sending...";
	const data = (await api.shareAgreement(agreementId!, true)) as { emailSent: boolean };
	const status = document.getElementById("shareStatus")!;
	status.textContent = data.emailSent ? "Email resent." : "No client email on file.";
	status.hidden = false;
	btn.textContent = "Resend Email";
	btn.disabled = false;
});

document.getElementById("copyShareLink")!.addEventListener("click", () => {
	const input = document.getElementById("shareLinkInput") as HTMLInputElement;
	navigator.clipboard.writeText(input.value);
	const status = document.getElementById("shareStatus")!;
	status.textContent = "Link copied to clipboard.";
	status.hidden = false;
});

document.getElementById("revokeShareLink")!.addEventListener("click", async () => {
	if (!confirm("Revoke the share link? The client will no longer be able to access this agreement.")) return;
	await api.revokeShare(agreementId!);
	agreement!.share_token = null;
	showShareState();
});

// Initial load
load();
