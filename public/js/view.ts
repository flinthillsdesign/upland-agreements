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

function formatParagraphs(text: string | null): string {
	if (!text) return "<p>—</p>";
	return text.split(/\n\n+/).map((p) => p.trim()).filter(Boolean).map((p) => `<p style="margin:0 0 8px">${esc(p)}</p>`).join("");
}

function formatList(text: string | null): string {
	if (!text) return "—";
	const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
	const isList = lines.every((l) => l.startsWith("- ") || l.startsWith("* "));
	if (isList && lines.length > 1) {
		return "<ul>" + lines.map((l) => `<li>${esc(l.replace(/^[-*]\s*/, ""))}</li>`).join("") + "</ul>";
	}
	return esc(text);
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
			<div class="mou-field-value">${formatParagraphs(agreement.project_description)}${agreement.deliverable ? formatParagraphs(agreement.deliverable) : ""}</div>
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

		<div class="doc-terms-divider">Project Terms</div>

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
			<h1>General Agreement for Services</h1>
		</div>

		<div class="doc-preamble">
			This Agreement ("Agreement") is made effective as of ${formatDate(agreement.effective_date, "long")} by and between <strong>${esc(companyName)}</strong>, of ${esc(companyAddress)}, ("Upland" or "Designer"), and <strong>${esc(agreement.client_name) || "_______________"}</strong>, ${esc(agreement.client_address) || "_______________"} ("Client").
		</div>

		<div class="doc-section">
			<span class="doc-section-number">1. </span><span class="doc-section-title">TERM.</span>
			<span class="doc-section-body">This Agreement shall begin on the Effective Date and shall end, unless earlier terminated, upon satisfactory completion of the Project as outlined in the Description of Services, but in any event, no later than ${formatDate(agreement.end_date, "long")}.</span>
		</div>

		<div class="doc-section">
			<span class="doc-section-number">2. </span><span class="doc-section-title">DESCRIPTION OF SERVICES.</span>
			<span class="doc-section-body">${esc(agreement.project_description) || "—"}</span>
		</div>

		<div class="doc-section">
			<span class="doc-section-number">3. </span><span class="doc-section-title">PROJECT COST.</span>
			<span class="doc-section-body">The parties agree that all Services shall be performed on a Time-And-Material-Not-To-Exceed basis. The total compensation to Designer under this Agreement shall not exceed <strong>${formatCurrency(agreement.total_cost)}</strong> ("NTE Amount").</span>
		</div>

		<div class="doc-section">
			<span class="doc-section-number">4. </span><span class="doc-section-title">INITIAL PAYMENT.</span>
			<span class="doc-section-body">A payment of <strong>${formatCurrency(paymentStructure.initial_amount)}</strong> (equaling approximately ${paymentStructure.initial_pct || 10}% of the Project Cost) will be required to retain Upland's services. This payment will be due within 30 days of signing this Agreement. Work shall not commence until the Initial Payment is received.</span>
		</div>

		<div class="doc-section">
			<span class="doc-section-number">5. </span><span class="doc-section-title">PROGRESS BILLINGS.</span>
			<span class="doc-section-body">${paymentStructure.progress_note || "Progress billings will be invoiced on a percentage of completion basis, not to exceed 90% of the NTE Amount."}</span>
		</div>

		<div class="doc-section">
			<span class="doc-section-number">6. </span><span class="doc-section-title">FINAL PAYMENT.</span>
			<span class="doc-section-body">The remaining balance of approximately <strong>${formatCurrency(paymentStructure.final_amount)}</strong> (${paymentStructure.final_pct || 10}% of the Project Cost) may be invoiced upon Substantial Completion of the Project, defined as installation of the exhibit such that it is suitable for public viewing, subject only to minor punch list items that do not materially impair use. Client approval shall not be unreasonably withheld.</span>
		</div>

		<div class="doc-section">
			<span class="doc-section-number">7. </span><span class="doc-section-title">PAYMENT TERMS.</span>
			<span class="doc-section-body">Upland shall submit all invoices to Client via email, with NET30 terms. Payment shall be made to ${esc(companyName)}, ${esc(companyAddress)}. If any invoice is not paid when due, interest will be added to and payable on all overdue amounts at 18 percent per year, or the maximum percentage allowed under applicable laws, whichever is less. Client shall pay all costs of collection, including without limitation, reasonable attorney fees.</span>
		</div>

		<div class="doc-section">
			<span class="doc-section-number">8. </span><span class="doc-section-title">REMEDIES FOR NON-PAYMENT.</span>
			<span class="doc-section-body">In addition to any other right or remedy provided by law, if Client fails to pay for the Services when due, Upland has the option to treat such failure to pay as a material breach of this Agreement, and may cancel this Agreement, suspend further services, and/or seek legal remedies.</span>
		</div>

		<div class="doc-section">
			<span class="doc-section-number">9. </span><span class="doc-section-title">BEST EFFORTS BASIS.</span>
			<span class="doc-section-body">The Services will be provided on a "best effort" basis. That is, Designer will create designs based on training, experience, and professional judgment that represent Designer's best effort; non-acceptance of the design(s) shall not constitute reason for non-payment.</span>
		</div>

		<div class="doc-section">
			<span class="doc-section-number">10. </span><span class="doc-section-title">CHANGES.</span>
			<span class="doc-section-body">Client shall pay additional charges for substantial changes requested by Client which are outside the scope of the Services on a time and materials basis, at Designer's Service Rates. Such charges shall be in addition to all other amounts payable, despite any maximum Project Cost. Designer may extend or modify any delivery schedule or deadlines as may be required by such changes, provided, however, that the delivery schedule does not exceed the contract termination date. All changes shall be put in writing and agreed to by both parties.</span>
		</div>

		<div class="doc-section">
			<span class="doc-section-number">11. </span><span class="doc-section-title">SERVICE RATES.</span>
			<div class="doc-section-body">
				<div>If work outside the scope of Services is required, the following service rates will be used:</div>
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
			<span class="doc-section-body">${formatList(agreement.client_responsibilities)}</span>
		</div>

		<div class="doc-section">
			<span class="doc-section-number">13. </span><span class="doc-section-title">TITLE AND ASSIGNMENT.</span>
			<div class="doc-section-body">
				<div class="doc-term-sub"><strong>Client Content,</strong> meaning all materials, information, photography, writings and other creative content provided by Client for use in the preparation of and/or incorporation in the Deliverables, including pre-existing Trademarks, shall remain the sole property of Client or its respective suppliers, and Client or its suppliers shall be the sole owner of all rights in connection therewith. Client hereby grants to Designer a nonexclusive, nontransferable license to use, reproduce, modify, display and publish the Client Content solely in connection with Designer's performance of the Services and limited promotional uses of the Deliverables as authorized in this Agreement.</div>
				<div class="doc-term-sub"><strong>Final Art,</strong> meaning all graphic design, illustration, photography, animation, modifications to Client Content, and Designer's selection, arrangement and coordination of such elements together with Client Content and/or Third Party Materials to create graphic layouts, developed or created by Designer, or commissioned by Designer, exclusively for the Project and incorporated into and delivered as part of the Final Deliverables, shall be deemed works made for hire and all rights pertaining to the Final Art shall belong to and shall be the sole and exclusive property of Client upon full payment for the Services except when prohibited by licensing restrictions of included Third Party Materials.</div>
				<div class="doc-term-sub"><strong>Third Party Materials,</strong> including without limitation stock photography, commissioned illustrations, or fonts, are the exclusive property of their respective owners. If Designer suggests incorporating Third Party Materials into the Final Art and additional licensing considerations are required, Designer shall inform Client of any need to license those Third Party Materials. Client shall obtain the license(s) necessary to permit Client's use of the Third Party Materials consistent with the usage rights granted herein, at Client's expense, or provide suitable alternatives as part of the Client Content. In the event Client fails to properly secure or otherwise arrange for any necessary licenses or instructs the use of Third Party Materials, Client hereby indemnifies, saves and holds harmless Designer from any and all damages, liabilities, costs, losses or expenses arising out of any claim, demand, or action by a third party arising out of Client's failure to obtain copyright, trademark, publicity, privacy, defamation or other releases or permissions with respect to materials included in the Final Art.</div>
				<div class="doc-term-sub"><strong>Preliminary Works,</strong> meaning all artwork including, but not limited to, concepts, sketches, visual presentations, or other alternate or preliminary designs and documents developed by Designer and which may or may not be shown and or delivered to Client for consideration but do not form part of the Final Art, are and shall remain exclusive property of Designer.</div>
				<div class="doc-term-sub"><strong>Designer IP.</strong> All intellectual property rights to all other work from the Project, including without limitation pre-existing and newly developed hardware, inventions, patents, products, exhibit systems, custom display components, and software, are and shall remain exclusive property of Designer. Designer hereby grants to Client a nonexclusive, nontransferable, perpetual, worldwide license to utilize this work solely to the extent necessary to produce the Final Deliverables.</div>
			</div>
		</div>

		<div class="doc-section">
			<span class="doc-section-number">14. </span><span class="doc-section-title">ACCREDITATION/PROMOTIONS.</span>
			<span class="doc-section-body">Either party may reproduce, publish, and display photographs of the Project in portfolios, websites, social media, and other promotional materials.</span>
		</div>

		<div class="doc-section">
			<span class="doc-section-number">15. </span><span class="doc-section-title">WARRANTIES AND REPRESENTATIONS.</span>
			<div class="doc-section-body">
				<div style="margin-bottom:8px">Designer represents, warrants, and covenants to Client that:</div>
				<div class="doc-term-sub">(a) Designer shall provide its Services and meet its obligations under this Agreement in a timely manner consistent with the terms of this Agreement, using knowledge, methods, and recommendations for performing the Services which meet commercially acceptable standards.</div>
				<div class="doc-term-sub">(b) The Project exhibits shall be free from design, manufacture, or production defect for a period of two years from the Agreement completion date, normal wear and tear excepted.</div>
				<div class="doc-term-sub">(c) To the best of Designer's knowledge, the Works do not infringe any copyright, violate any property or other rights of any third party or contain any scandalous, libelous or unlawful matter.</div>
				<div style="margin-top:12px;margin-bottom:8px">Client represents, warrants and covenants to Designer that:</div>
				<div class="doc-term-sub">(a) Client owns all right, title, and interest in, or otherwise has full right and authority to permit the use of all materials, information, photography, writings and other Client Content provided by Client for use in the Project.</div>
				<div class="doc-term-sub">(b) To the best of Client's knowledge, the Client Content does not infringe the rights of any third party, and use of the Client Content as well as any Trademarks in connection with the Project does not and will not violate the rights of any third parties.</div>
			</div>
		</div>

		<div class="doc-section">
			<span class="doc-section-number">16. </span><span class="doc-section-title">CONFIDENTIAL INFORMATION.</span>
			<span class="doc-section-body">Each party acknowledges that in connection with this Agreement it may receive certain confidential or proprietary technical and business information and materials of the other party, including without limitation Preliminary Works ("Confidential Information"). Each party, its agents and employees shall hold and maintain in strict confidence all Confidential Information, shall not disclose Confidential Information to any third party, and shall not share or use any Confidential Information except as may be necessary to perform its obligations under this Agreement, or as may be required by law, or by a court or governmental authority. Notwithstanding the foregoing, Confidential Information shall not include any information that is in the public domain or becomes publicly known through no fault of the receiving party or is otherwise properly received from a third party without an obligation of confidentiality.</span>
		</div>

		<div class="doc-section">
			<span class="doc-section-number">17. </span><span class="doc-section-title">RELATIONSHIP OF THE PARTIES.</span>
			<div class="doc-section-body">
				<div>Designer is an independent contractor, not an employee of Client or any company affiliated with Client. Designer shall provide the Services under the general direction of Client, but Designer shall determine, in Designer's sole discretion, the manner and means by which the Services are accomplished. This Agreement does not create a partnership or joint venture and neither party is authorized to act as agent or bind the other party except as expressly stated in this Agreement. All rights, if any, granted to Client are contractual in nature and are wholly defined by the express written agreement of the parties and the various terms and conditions of this Agreement.</div>
				<div style="margin-top:8px">If applicable, Designer shall contract with and pay all subcontractors used by Designer in the performance of the Services. Client shall in no event have any liability to any subcontractor of Designer, and Designer shall indemnify and hold Client harmless for, and against all damages, losses, and costs directly related to Designer's non-payment of subcontractors, including but not limited to reasonable attorney's fees.</div>
			</div>
		</div>

		<div class="doc-section">
			<span class="doc-section-number">18. </span><span class="doc-section-title">NO EXCLUSIVITY.</span>
			<span class="doc-section-body">Both parties are free to engage in similar agreements with other parties.</span>
		</div>

		<div class="doc-section">
			<span class="doc-section-number">19. </span><span class="doc-section-title">INDEMNIFICATION; HOLD HARMLESS.</span>
			<div class="doc-section-body">
				<div>To the maximum extent permitted by law, Designer agrees to indemnify and hold Client and their officers and employees harmless for, from and against all liabilities, damages, losses and costs, including, but not limited to, reasonable attorneys' fees, to the extent caused by (i) the gross negligence, recklessness, or intentionally wrongful conduct of the Designer and other persons employed or utilized by the Designer, including its consultants, in the performance of the Agreement; or (ii) Designer's breach of any material covenant, term, or provision of this Agreement. Designer further agrees to defend, indemnify and hold harmless Client and/or its licensees against all claims, suits, costs, damages and expenses, including attorneys' fees, that Client and/or its licensees may sustain by reason of any infringing, libelous or otherwise unlawful matter contained in the Works, excluding the Client Content.</div>
				<div style="margin-top:8px">To the maximum extent permitted by law, Client agrees to indemnify and hold Designer and their officers and employees harmless for, from and against all liabilities, damages, losses and costs, including, but not limited to, reasonable attorneys' fees, to the extent caused by (i) the gross negligence, recklessness, or intentionally wrongful conduct of Client and other persons employed by Client, including its consultants, in the performance of the Agreement; or (ii) Client's breach of any material covenant, term, or provision of this Agreement. Client further agrees to indemnify and hold harmless Upland and/or its licensees against any and all claims, costs, damages and expenses, including attorneys' fees, that Upland sustains by reason of any infringing, libelous or otherwise unlawful matter contained in the Client Content.</div>
			</div>
		</div>

		<div class="doc-section">
			<span class="doc-section-number">20. </span><span class="doc-section-title">LIMITATION OF LIABILITY.</span>
			<div class="doc-section-body">
				<div>In all circumstances, Designer's maximum liability to Client for damages for any and all causes whatsoever, and Client's maximum remedy, regardless of the form of action, shall be limited to 50% of the total compensation paid to Designer for the Services rendered.</div>
				<div style="margin-top:8px">In no event shall Designer be liable for any lost data or content, lost profits, business interruption or for any indirect, incidental, special, consequential, exemplary or punitive damages arising out of or relating to the materials or the services provided by Designer or its agents, even if Designer has been advised of the possibility of such damages.</div>
			</div>
		</div>

		<div class="doc-section">
			<span class="doc-section-number">21. </span><span class="doc-section-title">DEFAULT.</span>
			<span class="doc-section-body">If either party is in default with respect to any of the terms or conditions of this Agreement, including, without limitation, Client's failure to pay any invoice in accordance with the terms of this Agreement, the other party may, at its option, defer further performance until the default is remedied, and, without prejudice to any other legal remedy, may terminate this Agreement if the default is not remedied within thirty (30) calendar days (five (5) working days for nonpayment) after written notice is provided to the party in default, specifying the thing or matter in default. Unless waived by the party providing notice, the failure to cure the default(s) within such time period shall result in the automatic termination of this Agreement.</span>
		</div>

		<div class="doc-section">
			<span class="doc-section-number">22. </span><span class="doc-section-title">FORCE MAJEURE.</span>
			<span class="doc-section-body">If performance of this Agreement or any obligation under this Agreement is prevented, restricted, or interfered with by causes beyond either party's reasonable control ("Force Majeure"), and if the party unable to carry out its obligations gives the other party prompt written notice of such event, then the obligations of the party invoking this provision shall be suspended to the extent necessary by such event. The term Force Majeure shall include, without limitation, acts of God, pandemics, fire, explosion, vandalism, storm or other similar occurrence, orders or acts of military or civil authority, or by national emergencies, insurrections, riots, or wars, or strikes, or lock-outs. The excused party shall use reasonable efforts under the circumstances to avoid or remove such causes of non-performance and shall proceed to perform with reasonable dispatch whenever such causes are removed or ceased. An act or omission shall be deemed within the reasonable control of a party if committed, omitted, or caused by such party, or its employees, officers, agents, or affiliates.</span>
		</div>

		<div class="doc-section">
			<span class="doc-section-number">23. </span><span class="doc-section-title">NOTICE.</span>
			<div class="doc-section-body">
				<div>Any notice or communication required or permitted under this Agreement shall be sent via email. A notice shall be deemed received when the recipient confirms receipt by reply, or if no reply is received, on the third business day after sending. All notices shall be sent to:</div>
				<div class="doc-term-sub">Designer: ${esc(agreement.designer_email) || "joel@uplandexhibits.com"}</div>
				<div class="doc-term-sub">Client: ${esc(agreement.client_email) || "_______________"}</div>
			</div>
		</div>

		<div class="doc-section">
			<span class="doc-section-number">24. </span><span class="doc-section-title">ENTIRE AGREEMENT.</span>
			<span class="doc-section-body">This Agreement constitutes the entire agreement between the parties and supersedes all prior agreements, understandings, and communications, whether written or oral.</span>
		</div>

		<div class="doc-section">
			<span class="doc-section-number">25. </span><span class="doc-section-title">AMENDMENT.</span>
			<span class="doc-section-body">This Agreement may only be amended by a written instrument signed by both parties.</span>
		</div>

		<div class="doc-section">
			<span class="doc-section-number">26. </span><span class="doc-section-title">SEVERABILITY.</span>
			<span class="doc-section-body">If any provision of this Agreement shall be held to be invalid or unenforceable for any reason, the remaining provisions shall continue to be valid and enforceable. If a court finds that any provision of this Agreement is invalid or unenforceable, but that by limiting such provision it would become valid and enforceable, then such provision shall be deemed to be written, construed, and enforced as so limited.</span>
		</div>

		<div class="doc-section">
			<span class="doc-section-number">27. </span><span class="doc-section-title">WAIVER OF CONTRACTUAL RIGHT.</span>
			<span class="doc-section-body">The failure of either party to enforce any provision of this Agreement shall not constitute a waiver of such provision or the right to enforce it at a later time.</span>
		</div>

		<div class="doc-section">
			<span class="doc-section-number">28. </span><span class="doc-section-title">APPLICABLE LAW.</span>
			<span class="doc-section-body">This Agreement shall be governed by and construed in accordance with the laws of the State of Kansas.</span>
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
							<div class="signature-underline-label">${esc(agreement.client_contact) || "Client Signature"}${agreement.client_title ? `, ${esc(agreement.client_title)}` : ""}</div>
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
				<div class="signature-line-row" style="margin-top:8px">
					<div class="signature-field">
						<div class="signature-line"></div>
						<div class="signature-underline-label">Print Name and Title</div>
					</div>
					<div class="date-field"></div>
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
			<p style="font-size:0.85rem;color:var(--text-muted);margin-bottom:16px">Please confirm your information below. By clicking "Sign Agreement", you acknowledge that you have read and agree to the terms above.</p>
			${!agreement.client_name ? `
			<div class="form-group" style="margin-bottom:12px">
				<label>Organization / Legal Entity Name</label>
				<input type="text" id="signOrgName" placeholder="e.g., Museum at the Bighorns" required>
			</div>` : ""}
			${!agreement.client_address ? `
			<div class="form-group" style="margin-bottom:12px">
				<label>Organization Address</label>
				<input type="text" id="signOrgAddress" placeholder="e.g., 123 Main St, City, State ZIP">
			</div>` : ""}
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
			const orgNameInput = document.getElementById("signOrgName") as HTMLInputElement | null;
			const orgAddressInput = document.getElementById("signOrgAddress") as HTMLInputElement | null;
			const nameInput = document.getElementById("signName") as HTMLInputElement;
			const titleInput = document.getElementById("signTitle") as HTMLInputElement;

			// Validate required fields
			if (orgNameInput && !orgNameInput.value.trim()) { orgNameInput.focus(); return; }
			if (!nameInput.value.trim()) { nameInput.focus(); return; }

			const name = nameInput.value.trim();
			const title = titleInput?.value.trim() || "";
			const client_name = orgNameInput?.value.trim() || undefined;
			const client_address = orgAddressInput?.value.trim() || undefined;

			(signBtn as HTMLButtonElement).disabled = true;
			signBtn.textContent = "Signing...";

			try {
				const result = (await api.signAgreement(token!, name, title, client_name, client_address)) as { error?: string };

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

	// Overlay hides the layout shift while pdf-rendering styles are applied
	const overlay = document.createElement("div");
	overlay.className = "pdf-overlay";
	overlay.innerHTML = '<div class="pdf-overlay-text">Generating PDF...</div>';
	document.body.appendChild(overlay);

	element.classList.add("pdf-rendering");

	html2pdf()
		.set({
			margin: [0.6, 0.7, 0.75, 0.7],
			filename,
			image: { type: "jpeg", quality: 0.98 },
			html2canvas: { scale: 1.5, useCORS: true },
			jsPDF: { unit: "in", format: "letter", orientation: "portrait" },
			pagebreak: { mode: ["avoid-all", "css"] },
		})
		.from(element)
		.toPdf()
		.get("pdf")
		.then((pdf: any) => {
			const totalPages = pdf.internal.getNumberOfPages();
			for (let i = 1; i <= totalPages; i++) {
				pdf.setPage(i);
				pdf.setFontSize(8);
				pdf.setTextColor(150);
				pdf.text(`Page ${i} of ${totalPages}`, pdf.internal.pageSize.getWidth() / 2, pdf.internal.pageSize.getHeight() - 0.3, { align: "center" });
			}
		})
		.save()
		.then(() => {
			element.classList.remove("pdf-rendering");
			overlay.remove();
			btn.disabled = false;
			btn.textContent = "Download PDF";
		})
		.catch(() => {
			element.classList.remove("pdf-rendering");
			overlay.remove();
			btn.disabled = false;
			btn.textContent = "Download PDF";
			alert("Failed to generate PDF. Try using the Print button instead.");
		});
});

load();
