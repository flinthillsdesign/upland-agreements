import { api } from "./api.js";
import { esc, formatDate, formatCurrency, isMouType } from "./utils.js";

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
	share_token: string | null;
	client_signature: string | null;
	designer_signature: string | null;
}

interface Settings {
	legal_name?: string;
	company_address?: string;
	designer_name?: string;
	designer_title?: string;
}

const params = new URLSearchParams(window.location.search);
const token = params.get("token");
const previewId = params.get("id");
const isPreview = !!previewId;

if (!token && !previewId) {
	document.getElementById("documentContent")!.innerHTML = '<p style="text-align:center;padding:40px;color:var(--text-muted)">Invalid link.</p>';
}

const STATUS_TEXT: Record<string, string> = {
	draft: "This agreement is still being prepared.",
	sent: "This agreement is ready for your review.",
	viewed: "This agreement is ready for your review and signature.",
	signed: "This agreement has been signed by the client. Awaiting countersignature.",
	countersigned: "This agreement has been fully executed by both parties.",
	declined: "This agreement has been declined.",
	expired: "This agreement has expired.",
};

async function load() {
	if (!token && !previewId) return;

	try {
		const data = isPreview
			? (await api.previewAgreement(previewId!)) as { error?: string; agreement: Agreement; settings: Settings }
			: (await api.viewAgreement(token!)) as { error?: string; agreement: Agreement; settings: Settings };
		if (data.error) {
			document.getElementById("documentContent")!.innerHTML = `<p style="text-align:center;padding:40px;color:var(--text-muted)">${esc(data.error)}</p>`;
			return;
		}

		const agreement: Agreement = data.agreement;
		const settings: Settings = data.settings || {};

		document.title = `${agreement.title} — Upland Exhibits`;

		// Status bar
		if (isPreview) {
			document.getElementById("statusText")!.textContent = "Preview — this is how the client will see it.";
		} else {
			document.getElementById("statusText")!.textContent = STATUS_TEXT[agreement.status] || "";
		}

		// Render document
		if (isMouType(agreement.type)) {
			renderMou(agreement, settings);
		} else {
			renderFullAgreement(agreement, settings);
		}

		// Signature area
		renderSignatures(agreement, settings);
	} catch (err) {
		console.error("Failed to load agreement:", err);
		document.getElementById("documentContent")!.innerHTML = '<p style="text-align:center;padding:40px;color:var(--text-muted)">Failed to load agreement.</p>';
	}
}

function renderMou(agreement: Agreement, settings: Settings) {
	const companyName = settings.legal_name || "Flint Hills Design, LLC dba Upland Exhibits";
	const isSmall = agreement.type === "mou_small";

	document.getElementById("documentContent")!.innerHTML = `
		<div class="doc-header">
			<img src="/upland-logo.svg" alt="Upland Exhibits" class="doc-logo">
			<div class="company-name">${esc(companyName)}</div>
			<h1>Memo of Understanding</h1>
			<div class="doc-subtitle">for Design Services</div>
		</div>

		<div class="mou-field">
			<div class="mou-field-label">Client</div>
			<div class="mou-field-value">${esc(agreement.client_name) || "_______________"}<br>${esc(agreement.client_address) || ""}</div>
		</div>

		<div class="mou-field">
			<div class="mou-field-label">Project</div>
			<div class="mou-field-value">${esc(agreement.title)}</div>
		</div>

		<div class="mou-field">
			<div class="mou-field-label">Scope of Work / Deliverable</div>
			<div class="mou-field-value">${esc(agreement.project_description) || "—"}${agreement.deliverable ? "\n\n" + esc(agreement.deliverable) : ""}</div>
		</div>

		<div class="mou-field">
			<div class="mou-field-label">Timeframe</div>
			<div class="mou-field-value">${esc(agreement.timeframe) || "—"}</div>
		</div>

		<div class="mou-field">
			<div class="mou-field-label">Cost</div>
			<div class="mou-field-value">${agreement.hours && agreement.hourly_rate
				? `${agreement.hours} hours x $${agreement.hourly_rate} / hr = ${formatCurrency(agreement.total_cost)}`
				: agreement.total_cost ? formatCurrency(agreement.total_cost) : "—"}</div>
		</div>

		<div class="doc-terms-divider">----- PROJECT TERMS -----</div>

		<div class="doc-term">
			<div class="doc-term-title">TITLE AND ASSIGNMENT.</div>
			<div class="doc-term-body">
				<div class="doc-term-sub">- <strong>Client Content.</strong> All materials, information, photographs, data, and content provided by the Client for incorporation into the Project shall remain the sole property of Client.</div>
				<div class="doc-term-sub">- <strong>Final Art.</strong> All original artwork, designs, and creative works produced by Designer specifically for this Project and selected by Client as Final Art shall be considered works made for hire and shall become the property of Client upon Client's full payment of all amounts due under this Agreement.</div>
				<div class="doc-term-sub">- <strong>Third Party Materials.</strong> All third party materials incorporated into the Project are the exclusive property of their respective owners. Designer shall obtain appropriate licenses for third party materials.</div>
				<div class="doc-term-sub">- <strong>Preliminary Works.</strong> All sketches, concepts, preliminary designs, and other creative works not selected as Final Art shall remain the exclusive property of Designer.</div>
				<div class="doc-term-sub">- <strong>Designer IP.</strong> All intellectual property rights to systems, hardware, software, fabrication methods, and proprietary processes developed or used by Designer shall remain the exclusive property of Designer, with a license granted to Client for use in connection with the Project.</div>
			</div>
		</div>

		<div class="doc-term">
			<div class="doc-term-title">ACCREDITATION/PROMOTIONS.</div>
			<div class="doc-term-body">Either party may reproduce, publish, and display photographs of the Project in portfolios, websites, social media, and other promotional materials, and submit the Project for design awards and publications.</div>
		</div>

		${isSmall ? `
		<div class="doc-term">
			<div class="doc-term-title">FINAL APPROVAL.</div>
			<div class="doc-term-body">Client shall provide final proofreading and approval of all Final Art before its release for production. If the Client approves work containing errors or omissions, such as, by way of example, not limitation, typographic errors or misspellings, Client shall incur the cost of correcting such errors.</div>
		</div>` : ""}

		<div class="doc-signature-area" id="signatureArea"></div>
	`;
}

function renderFullAgreement(agreement: Agreement, settings: Settings) {
	const companyName = settings.legal_name || "Flint Hills Design, LLC dba Upland Exhibits";
	const companyAddress = settings.company_address || "507 SE 36th St., Newton, Kansas 67114";

	let paymentStructure = { initial_pct: 10, initial_amount: 0, progress_note: "", final_pct: 10, final_amount: 0 };
	try { if (agreement.payment_structure) paymentStructure = JSON.parse(agreement.payment_structure); } catch (e) { console.warn("Malformed payment_structure JSON:", e); }

	let rates = { head_rate: 95, design_rate: 75, fab_rate: 65, materials_markup: 15, travel_rate: 55 };
	try { if (agreement.service_rates) rates = JSON.parse(agreement.service_rates); } catch (e) { console.warn("Malformed service_rates JSON:", e); }

	document.getElementById("documentContent")!.innerHTML = `
		<div class="doc-header">
			<img src="/upland-logo.svg" alt="Upland Exhibits" class="doc-logo">
			<div class="company-name">${esc(companyName)}</div>
			<h1>General Agreement for Services</h1>
		</div>

		<div class="doc-preamble">
			This Agreement ("Agreement") is made effective as of ${formatDate(agreement.effective_date, "long")} by and between <strong>${esc(companyName)}</strong>, of ${esc(companyAddress)}, ("Upland" or "Designer"), and <strong>${esc(agreement.client_name) || "_______________"}</strong>, ${esc(agreement.client_address) || "_______________"} ("Client").
		</div>

		<div class="doc-section">
			<span class="doc-section-number">1. </span><span class="doc-section-title">TERM.</span>
			<div class="doc-section-body">This Agreement shall begin on the Effective Date and shall end, unless earlier terminated, upon satisfactory completion of the Project as outlined in the Description of Services, but in any event, no later than ${formatDate(agreement.end_date, "long")}.</div>
		</div>

		<div class="doc-section">
			<span class="doc-section-number">2. </span><span class="doc-section-title">DESCRIPTION OF SERVICES.</span>
			<div class="doc-section-body">${esc(agreement.project_description) || "—"}</div>
		</div>

		<div class="doc-section">
			<span class="doc-section-number">3. </span><span class="doc-section-title">PROJECT COST.</span>
			<div class="doc-section-body">The parties agree that all Services shall be performed on a Time-And-Material-Not-To-Exceed basis. The total compensation to Designer under this Agreement shall not exceed <strong>${formatCurrency(agreement.total_cost)}</strong> ("NTE Amount").</div>
		</div>

		<div class="doc-section">
			<span class="doc-section-number">4. </span><span class="doc-section-title">INITIAL PAYMENT.</span>
			<div class="doc-section-body">A payment of <strong>${formatCurrency(paymentStructure.initial_amount)}</strong> (equaling approximately ${paymentStructure.initial_pct || 10}% of the Project Cost) will be required to retain Upland's services. This payment will be due within 30 days of signing this Agreement. Work shall not commence until the Initial Payment is received.</div>
		</div>

		<div class="doc-section">
			<span class="doc-section-number">5. </span><span class="doc-section-title">PROGRESS BILLINGS.</span>
			<div class="doc-section-body">${paymentStructure.progress_note || "Progress billings will be invoiced on a percentage of completion basis, not to exceed 90% of the NTE Amount."}</div>
		</div>

		<div class="doc-section">
			<span class="doc-section-number">6. </span><span class="doc-section-title">FINAL PAYMENT.</span>
			<div class="doc-section-body">The remaining balance of approximately <strong>${formatCurrency(paymentStructure.final_amount)}</strong> (${paymentStructure.final_pct || 10}% of the Project Cost) will be invoiced upon Substantial Completion of the Project.</div>
		</div>

		<div class="doc-section">
			<span class="doc-section-number">7. </span><span class="doc-section-title">PAYMENT TERMS.</span>
			<div class="doc-section-body">All invoices are due and payable within thirty (30) days of the invoice date (NET30). Past due amounts shall accrue interest at the rate of eighteen percent (18%) per annum. Client shall be responsible for all costs of collection, including reasonable attorney fees.</div>
		</div>

		<div class="doc-section">
			<span class="doc-section-number">8. </span><span class="doc-section-title">REMEDIES FOR NON-PAYMENT.</span>
			<div class="doc-section-body">Non-payment of any amount due under this Agreement shall constitute a material breach. Upon such breach, Designer may, at its sole discretion: (a) cancel this Agreement; (b) suspend all work until payment is received; and (c) recover all amounts due plus damages.</div>
		</div>

		<div class="doc-section">
			<span class="doc-section-number">9. </span><span class="doc-section-title">BEST EFFORTS BASIS.</span>
			<div class="doc-section-body">Designer will use its best professional efforts to provide the Services. Non-acceptance of a particular design direction by Client does not justify non-payment for services rendered in good faith.</div>
		</div>

		<div class="doc-section">
			<span class="doc-section-number">10. </span><span class="doc-section-title">CHANGES.</span>
			<div class="doc-section-body">Any changes to the scope of Services as described herein shall be subject to additional charges. All changes must be agreed upon in writing by both parties prior to commencement of additional work.</div>
		</div>

		<div class="doc-section">
			<span class="doc-section-number">11. </span><span class="doc-section-title">SERVICE RATES.</span>
			<div class="doc-section-body">
				<table class="rate-table">
					<tr><td>Head of Design & Head of Fabrication</td><td>$${rates.head_rate}/hour</td></tr>
					<tr><td>Design staff</td><td>$${rates.design_rate}/hour</td></tr>
					<tr><td>Fabrication staff</td><td>$${rates.fab_rate}/hour</td></tr>
					<tr><td>All project materials billed at cost plus</td><td>${rates.materials_markup}%</td></tr>
					<tr><td>Travel time</td><td>$${rates.travel_rate}/hour</td></tr>
					<tr><td>Travel mileage and per diem</td><td>Current IRS or GSA rates</td></tr>
				</table>
			</div>
		</div>

		<div class="doc-section">
			<span class="doc-section-number">12. </span><span class="doc-section-title">CLIENT RESPONSIBILITIES.</span>
			<div class="doc-section-body">${esc(agreement.client_responsibilities) || "—"}</div>
		</div>

		<div class="doc-section">
			<span class="doc-section-number">13. </span><span class="doc-section-title">TITLE AND ASSIGNMENT.</span>
			<div class="doc-section-body">Client Content remains sole property of Client. Final Art becomes property of Client upon full payment. Third Party Materials remain property of their respective owners. Preliminary Works remain property of Designer. All intellectual property rights to systems, hardware, and software remain exclusive property of Designer, with license granted to Client.</div>
		</div>

		<div class="doc-section">
			<span class="doc-section-number">14. </span><span class="doc-section-title">ACCREDITATION/PROMOTIONS.</span>
			<div class="doc-section-body">Either party may reproduce, publish, and display photographs of the Project in portfolios, websites, social media, and other promotional materials.</div>
		</div>

		<div class="doc-section">
			<span class="doc-section-number">15. </span><span class="doc-section-title">WARRANTIES AND REPRESENTATIONS.</span>
			<div class="doc-section-body">Designer warrants that: (a) Services will be performed in a timely and professional manner; (b) all work product will be free from defects in materials and workmanship for a period of two (2) years from delivery; (c) the work product will not infringe upon any third party intellectual property rights. Client warrants that: (a) Client owns or has rights to all content provided to Designer; (b) such content does not infringe upon any third party rights.</div>
		</div>

		<div class="doc-section">
			<span class="doc-section-number">16. </span><span class="doc-section-title">CONFIDENTIAL INFORMATION.</span>
			<div class="doc-section-body">Each party agrees to keep confidential all proprietary information received from the other party and not to disclose such information to third parties without prior written consent, except as required by law.</div>
		</div>

		<div class="doc-section">
			<span class="doc-section-number">17. </span><span class="doc-section-title">RELATIONSHIP OF THE PARTIES.</span>
			<div class="doc-section-body">Designer is an independent contractor. Nothing in this Agreement shall be construed to create a partnership, joint venture, or employer-employee relationship.</div>
		</div>

		<div class="doc-section">
			<span class="doc-section-number">18. </span><span class="doc-section-title">NO EXCLUSIVITY.</span>
			<div class="doc-section-body">Both parties are free to engage in similar agreements with other parties.</div>
		</div>

		<div class="doc-section">
			<span class="doc-section-number">19. </span><span class="doc-section-title">INDEMNIFICATION; HOLD HARMLESS.</span>
			<div class="doc-section-body">Each party shall indemnify and hold harmless the other party from and against any claims, damages, losses, or expenses arising from: (a) the indemnifying party's negligence or willful misconduct; (b) breach of this Agreement; (c) any unlawful content provided by the indemnifying party.</div>
		</div>

		<div class="doc-section">
			<span class="doc-section-number">20. </span><span class="doc-section-title">LIMITATION OF LIABILITY.</span>
			<div class="doc-section-body">Designer's maximum aggregate liability under this Agreement shall not exceed fifty percent (50%) of the total compensation paid or payable to Designer. In no event shall either party be liable for consequential, incidental, indirect, special, or punitive damages.</div>
		</div>

		<div class="doc-section">
			<span class="doc-section-number">21. </span><span class="doc-section-title">DEFAULT.</span>
			<div class="doc-section-body">In the event of a breach, the non-breaching party shall provide written notice and the breaching party shall have thirty (30) days to cure (five (5) business days for non-payment).</div>
		</div>

		<div class="doc-section">
			<span class="doc-section-number">22. </span><span class="doc-section-title">FORCE MAJEURE.</span>
			<div class="doc-section-body">Neither party shall be liable for failure to perform due to causes beyond its reasonable control, including but not limited to acts of God, war, terrorism, pandemic, natural disasters, government action, or failure of third-party services.</div>
		</div>

		<div class="doc-section">
			<span class="doc-section-number">23. </span><span class="doc-section-title">NOTICE.</span>
			<div class="doc-section-body">All notices shall be sent via email to:<br>Designer: ${esc(agreement.designer_email) || "joel@uplandexhibits.com"}<br>Client: ${esc(agreement.client_email) || "_______________"}</div>
		</div>

		<div class="doc-section">
			<span class="doc-section-number">24. </span><span class="doc-section-title">ENTIRE AGREEMENT.</span>
			<div class="doc-section-body">This Agreement constitutes the entire agreement between the parties and supersedes all prior agreements, understandings, and communications, whether written or oral.</div>
		</div>

		<div class="doc-section">
			<span class="doc-section-number">25. </span><span class="doc-section-title">AMENDMENT.</span>
			<div class="doc-section-body">This Agreement may only be amended by a written instrument signed by both parties.</div>
		</div>

		<div class="doc-section">
			<span class="doc-section-number">26. </span><span class="doc-section-title">SEVERABILITY.</span>
			<div class="doc-section-body">If any provision of this Agreement is found to be invalid or unenforceable, the remaining provisions shall continue in full force and effect.</div>
		</div>

		<div class="doc-section">
			<span class="doc-section-number">27. </span><span class="doc-section-title">WAIVER OF CONTRACTUAL RIGHT.</span>
			<div class="doc-section-body">The failure of either party to enforce any provision of this Agreement shall not constitute a waiver of such provision or the right to enforce it at a later time.</div>
		</div>

		<div class="doc-section">
			<span class="doc-section-number">28. </span><span class="doc-section-title">APPLICABLE LAW.</span>
			<div class="doc-section-body">This Agreement shall be governed by and construed in accordance with the laws of the State of Kansas.</div>
		</div>

		<div class="doc-signature-area" id="signatureArea"></div>
	`;
}

function renderSignatures(agreement: Agreement, settings: Settings) {
	const area = document.getElementById("signatureArea")!;
	const companyName = settings.legal_name || "Flint Hills Design, LLC dba Upland Exhibits";
	const designerName = settings.designer_name || "Joel Gaeddert";
	const designerTitle = settings.designer_title || "CEO";
	const isMou = isMouType(agreement.type);

	let clientSig = null;
	let designerSig = null;
	try { if (agreement.client_signature) clientSig = JSON.parse(agreement.client_signature); } catch (e) { console.warn("Malformed client_signature JSON:", e); }
	try { if (agreement.designer_signature) designerSig = JSON.parse(agreement.designer_signature); } catch (e) { console.warn("Malformed designer_signature JSON:", e); }

	area.innerHTML = `
		<div style="margin-bottom:16px;font-weight:600;font-size:15px">Agreed and accepted:</div>

		${isMou ? `
		<!-- MoU signature layout: two pairs side by side -->
		<div class="signature-pairs">
			<div class="signature-pair">
				${clientSig ? `
					<div class="signed-info">
						<div class="signed-name">${esc(clientSig.name)}${clientSig.title ? `, ${esc(clientSig.title)}` : ""}</div>
						<div class="signed-meta">Signed ${formatDate(clientSig.timestamp, "long")}</div>
					</div>
				` : `
					<div class="signature-line-row">
						<div class="signature-field">
							<div class="signature-line"></div>
							<div class="signature-underline-label">Client Signature</div>
						</div>
						<div class="date-field">
							<div class="signature-line"></div>
							<div class="signature-underline-label">Date</div>
						</div>
					</div>
				`}
			</div>
			<div class="signature-pair">
				${designerSig ? `
					<div class="signed-info">
						<div class="signed-name">${esc(designerSig.name)}</div>
						<div class="signed-meta">Signed ${formatDate(designerSig.timestamp, "long")}</div>
					</div>
				` : `
					<div class="signature-line-row">
						<div class="signature-field">
							<div class="signature-line"></div>
							<div class="signature-underline-label">${esc(designerName)}, ${esc(designerTitle)}</div>
						</div>
						<div class="date-field">
							<div class="signature-line"></div>
							<div class="signature-underline-label">Date</div>
						</div>
					</div>
				`}
			</div>
		</div>
		` : `
		<!-- Full agreement signature layout: stacked -->
		<div class="signature-block">
			<div class="signature-block-label">"Client"</div>
			<div class="signature-block-org">${esc(agreement.client_name) || "_______________"}</div>
			${clientSig ? `
				<div class="signed-info">
					<div class="signed-name">${esc(clientSig.name)}${clientSig.title ? `, ${esc(clientSig.title)}` : ""}</div>
					<div class="signed-meta">Signed ${formatDate(clientSig.timestamp, "long")}</div>
				</div>
			` : `
				<div class="signature-line-row">
					<div class="signature-field">
						<div class="signature-line"></div>
						<div class="signature-underline-label">Signed</div>
					</div>
					<div class="date-field">
						<div class="signature-line"></div>
						<div class="signature-underline-label">Date</div>
					</div>
				</div>
				<div style="margin-top:8px">
					<div class="signature-line"></div>
					<div class="signature-underline-label">By: ${esc(agreement.client_contact) || "_______________"}${agreement.client_title ? ", " + esc(agreement.client_title) : ""}</div>
				</div>
			`}
		</div>

		<div class="signature-block">
			<div class="signature-block-label">"Designer"</div>
			<div class="signature-block-org">${esc(companyName)}</div>
			${designerSig ? `
				<div class="signed-info">
					<div class="signed-name">${esc(designerSig.name)}</div>
					<div class="signed-meta">Signed ${formatDate(designerSig.timestamp, "long")}</div>
				</div>
			` : `
				<div class="signature-line-row">
					<div class="signature-field">
						<div class="signature-line"></div>
						<div class="signature-underline-label">Signed</div>
					</div>
					<div class="date-field">
						<div class="signature-line"></div>
						<div class="signature-underline-label">Date</div>
					</div>
				</div>
				<div style="margin-top:4px;font-size:13px;padding-left:4px">${designerName}, ${designerTitle}</div>
			`}
		</div>
		`}

		${!isPreview && !clientSig && (agreement.status === "sent" || agreement.status === "viewed") ? `
		<div class="sign-area" id="signArea">
			<h3>Sign This Agreement</h3>
			<p style="font-size:0.85rem;color:var(--text-muted);margin-bottom:16px">By typing your name below and clicking "Sign Agreement", you acknowledge that you have read and agree to the terms above.</p>
			<div class="form-group" style="margin-bottom:12px">
				<label>Your Full Name</label>
				<input type="text" id="signName" placeholder="Type your full legal name" required>
			</div>
			<div class="form-group" style="margin-bottom:16px">
				<label>Your Title</label>
				<input type="text" id="signTitle" placeholder="e.g., Executive Director">
			</div>
			<button class="btn btn-primary btn-lg" id="signBtn">Sign Agreement</button>
		</div>
		` : ""}
	`;

	// Sign handler
	const signBtn = document.getElementById("signBtn");
	if (signBtn) {
		signBtn.addEventListener("click", async () => {
			const nameInput = document.getElementById("signName") as HTMLInputElement;
			const titleInput = document.getElementById("signTitle") as HTMLInputElement;
			const name = nameInput.value.trim();
			const title = titleInput?.value.trim() || "";
			if (!name) {
				nameInput.focus();
				return;
			}

			(signBtn as HTMLButtonElement).disabled = true;
			signBtn.textContent = "Signing...";

			try {
				const result = (await api.signAgreement(token!, name, title)) as { error?: string };

				if (result.error) {
					alert(result.error);
					(signBtn as HTMLButtonElement).disabled = false;
					signBtn.textContent = "Sign Agreement";
					return;
				}

				// Reload to show signed state
				load();
			} catch {
				alert("Failed to sign. Please try again.");
				(signBtn as HTMLButtonElement).disabled = false;
				signBtn.textContent = "Sign Agreement";
			}
		});
	}
}

// PDF download via html2pdf.js
declare const html2pdf: any;

document.getElementById("pdfBtn")?.addEventListener("click", () => {
	const element = document.getElementById("documentContent")!;
	const titleEl = document.querySelector(".doc-header h1");
	const docType = titleEl?.textContent?.trim() || "Agreement";
	const parts = document.title.split(" — ");
	const filename = `${(parts[0] || docType).replace(/[^a-zA-Z0-9 ]/g, "").replace(/\s+/g, "_")}.pdf`;

	const btn = document.getElementById("pdfBtn") as HTMLButtonElement;
	btn.disabled = true;
	btn.textContent = "Generating...";

	element.classList.add("pdf-rendering");

	html2pdf()
		.set({
			margin: [0.4, 0.5, 0.5, 0.5],
			filename,
			image: { type: "jpeg", quality: 0.98 },
			html2canvas: { scale: 1.5, useCORS: true },
			jsPDF: { unit: "in", format: "letter", orientation: "portrait" },
			pagebreak: { mode: ["css", "legacy"] },
		})
		.from(element)
		.save()
		.then(() => {
			element.classList.remove("pdf-rendering");
			btn.disabled = false;
			btn.textContent = "Download PDF";
		})
		.catch(() => {
			element.classList.remove("pdf-rendering");
			btn.disabled = false;
			btn.textContent = "Download PDF";
			alert("Failed to generate PDF. Try using the Print button instead.");
		});
});

load();
