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
				<div class="doc-term-sub"><strong>Client Content.</strong> All materials, information, photography, writings, and other content provided by Client, including pre-existing Trademarks, shall remain Client's sole property. Client grants Designer a nonexclusive, nontransferable license to use the Client Content solely to perform the Services and for limited promotional use as authorized in this Agreement.</div>
				<div class="doc-term-sub"><strong>Final Art.</strong> All design, illustration, photography, animation, and graphic layouts created by Designer exclusively for the Project shall be works made for hire and become Client's sole property upon full payment, except where restricted by Third Party Material licensing.</div>
				<div class="doc-term-sub"><strong>Third Party Materials.</strong> Stock photography, commissioned illustrations, fonts, and similar third-party assets remain property of their respective owners. Client is responsible for obtaining any necessary licenses at Client's expense. Client indemnifies Designer against any claims arising from Client's failure to secure required licenses for materials included in the Final Art.</div>
				<div class="doc-term-sub"><strong>Preliminary Works.</strong> All concepts, sketches, visual presentations, and preliminary designs not selected as Final Art shall remain exclusive property of Designer.</div>
				<div class="doc-term-sub"><strong>Designer IP.</strong> All intellectual property rights to exhibit systems, hardware, custom components, software, and fabrication methods shall remain exclusive property of Designer. Designer grants Client a nonexclusive, nontransferable, perpetual, worldwide license to use such work solely in connection with the Final Deliverables.</div>
			</div>
		</div>

		<div class="doc-term">
			<div class="doc-term-title">ACCREDITATION/PROMOTIONS.</div>
			<div class="doc-term-body">Either party may reproduce, publish and display photographs of the Project, may describe its role in relation to the Project and, if applicable, the services provided to the other party on its website and in other promotional materials.</div>
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
			This Agreement ("Agreement") is made effective as of ${agreement.effective_date ? formatDate(agreement.effective_date, "long") : "the date of signing"} (the "Effective Date") by and between <strong>${esc(companyName)}</strong>, of ${esc(companyAddress)}, ("Upland" or "Designer"), and <strong>${esc(agreement.client_name) || "_______________"}</strong>, ${esc(agreement.client_address) || "_______________"} ("Client").
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
			<span class="doc-section-body">The parties agree that all Services shall be performed on a Time-And-Material-Not-To-Exceed basis. The total compensation to Designer under this Agreement shall not exceed <strong>${formatCurrency(agreement.total_cost)}</strong> ("NTE Amount"). The NTE Amount is based on the Project scope, assumptions, and information available as of the Effective Date. Material changes in scope, assumptions, site conditions, Client direction, code requirements, or other project conditions may require an equitable adjustment to the NTE Amount.</span>
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
			<span class="doc-section-body">The remaining balance of approximately <strong>${formatCurrency(paymentStructure.final_amount)}</strong> (${paymentStructure.final_pct || 10}% of the Project Cost) may be invoiced upon Substantial Completion of the Project, defined as installation of the exhibit such that it is suitable for public viewing or intended use, subject only to minor punch list items that do not materially impair use. Final payment shall not be withheld due to minor punch list items, and Client approval shall not be unreasonably withheld.</span>
		</div>

		<div class="doc-section">
			<span class="doc-section-number">7. </span><span class="doc-section-title">PAYMENT TERMS AND REMEDIES.</span>
			<div class="doc-section-body">
				<div>Upland shall submit all invoices to Client via email, with NET30 terms. Payment shall be made to ${esc(companyName)}, ${esc(companyAddress)}. If any invoice is not paid when due, interest will be added to and payable on all overdue amounts at 18 percent per year, or the maximum percentage allowed under applicable laws, whichever is less. Client shall pay all costs of collection, including without limitation, reasonable attorney fees.</div>
				<div style="margin-top:8px">In addition to any other right or remedy provided by law, if Client fails to pay for the Services when due, Upland has the option to treat such failure to pay as a material breach of this Agreement, and may cancel this Agreement, suspend further services, and/or seek legal remedies.</div>
			</div>
		</div>

		<div class="doc-section">
			<span class="doc-section-number">8. </span><span class="doc-section-title">BEST EFFORTS BASIS.</span>
			<span class="doc-section-body">Services are provided on a "best effort" basis, meaning Designer will apply professional training, experience, and judgment. Non-acceptance of a design direction shall not constitute reason for non-payment.</span>
		</div>

		<div class="doc-section">
			<span class="doc-section-number">9. </span><span class="doc-section-title">CHANGES.</span>
			<div class="doc-section-body">
				<div>Client shall pay additional charges for substantial changes requested by Client which are outside the scope of the Services on a time and materials basis, at Designer's Service Rates. Such charges shall be in addition to all other amounts payable, despite any maximum Project Cost. Designer may extend or modify any delivery schedule or deadlines as may be required by such changes, provided, however, that the delivery schedule does not exceed the contract termination date. All changes shall be documented in writing and may be approved by signed instrument or by email confirmation from Client.</div>
				<div style="margin-top:8px">Revisions, modifications, or rework resulting from changes to previously approved work, including approved designs, drawings, text, graphic layouts, material selections, fabrication details, or installation conditions, shall be treated as Additional Services and billed accordingly.</div>
			</div>
		</div>

		<div class="doc-section">
			<span class="doc-section-number">10. </span><span class="doc-section-title">SERVICE RATES.</span>
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
			<span class="doc-section-number">11. </span><span class="doc-section-title">CLIENT RESPONSIBILITIES.</span>
			<div class="doc-section-body">
				<div>Client acknowledges that it shall be responsible for performing the following in a reasonable and timely manner, so as not to cause delays in the delivery of the Project by Upland:</div>
				<div class="doc-term-sub">(a) <strong>Decision-making.</strong> Coordinate any decision-making with parties other than Upland;</div>
				<div class="doc-term-sub">(b) <strong>Client Content.</strong> Provide to Upland upon request all needed Client Content, including material specifications, photographs, exhibit text, and other creative content in a form suitable for reproduction or incorporation into the Project without further preparation, unless otherwise expressly provided;</div>
				<div class="doc-term-sub">(c) <strong>Site information.</strong> Provide to Upland all needed site plans, building and elevation plans, utility locations, color/material samples, and all applicable codes, rules, and regulation information that Upland is expected to adhere to;</div>
				<div class="doc-term-sub">(d) <strong>Naming approvals.</strong> Provide and/or secure all necessary approvals for naming nomenclature which shall include, but not be limited to, end users or donors as may be necessary;</div>
				<div class="doc-term-sub">(e) <strong>Electrical and structural.</strong> Arrange and pay contractors directly for the documentation, permissions, licensing, and implementation of all electrical, structural, or mechanical elements needed to support or power signage or casework;</div>
				<div class="doc-term-sub">(f) <strong>Existing displays.</strong> If applicable, remove existing casework and displays that will not be incorporated into the Project;</div>
				<div class="doc-term-sub">(g) <strong>Space preparation.</strong> If applicable, prepare space for new exhibit ahead of installation, including, but not limited to, repairing or replacing and painting walls, doors and trim, installing or repairing floors, modifying or installing new ceiling lights;</div>
				<div class="doc-term-sub">(h) <strong>Final approval.</strong> Provide final proofreading and approval of all project documents including, but not limited to, exhibit plans, production design drawings, and the Final Art, before their release for fabrication or installation. If the Client approves work containing errors or omissions, such as, by way of example, not limitation, typographic errors or misspellings, Client shall incur the cost of correcting such errors; and</div>
				<div class="doc-term-sub">(i) <strong>Compliance.</strong> Assume all responsibility for compliance, with respect to the Project, with any and all applicable laws, regulations, and building codes governing non-discrimination and public accommodation laws, including without limitation the Americans with Disabilities Act (42 U.S.C. 12010 et. seq.) and all other public accommodation laws.</div>
				${agreement.client_responsibilities ? `<div style="margin-top:8px">${formatList(agreement.client_responsibilities)}</div>` : ""}
			</div>
		</div>

		<div class="doc-section">
			<span class="doc-section-number">12. </span><span class="doc-section-title">SCHEDULE; CLIENT DELAYS.</span>
			<span class="doc-section-body">The Project schedule assumes timely Client decisions, approvals, content, site access, and other required inputs. Delays caused by Client or its representatives shall automatically extend the schedule. If delays result in additional costs to Designer, Client shall pay such costs as Additional Services.</span>
		</div>

		<div class="doc-section">
			<span class="doc-section-number">13. </span><span class="doc-section-title">SUBSTITUTIONS.</span>
			<span class="doc-section-body">Designer may substitute materials, components, finishes, or methods of comparable quality and design intent when required by availability, lead times, field conditions, code requirements, or other circumstances beyond Designer's reasonable control. Substitutions that materially affect design intent or functionality shall be communicated to Client.</span>
		</div>

		<div class="doc-section">
			<span class="doc-section-number">14. </span><span class="doc-section-title">TITLE AND ASSIGNMENT.</span>
			<div class="doc-section-body">
				<div class="doc-term-sub"><strong>Client Content.</strong> All materials, information, photography, writings, and other content provided by Client, including pre-existing Trademarks, shall remain Client's sole property. Client grants Designer a nonexclusive, nontransferable license to use the Client Content solely to perform the Services and for limited promotional use as authorized in this Agreement.</div>
				<div class="doc-term-sub"><strong>Final Art.</strong> All design, illustration, photography, animation, and graphic layouts created by Designer exclusively for the Project shall be works made for hire and become Client's sole property upon full payment, except where restricted by Third Party Material licensing.</div>
				<div class="doc-term-sub"><strong>Third Party Materials.</strong> Stock photography, commissioned illustrations, fonts, and similar third-party assets remain property of their respective owners. Client is responsible for obtaining any necessary licenses at Client's expense. Client indemnifies Designer against any claims arising from Client's failure to secure required licenses for materials included in the Final Art.</div>
				<div class="doc-term-sub"><strong>Preliminary Works.</strong> All concepts, sketches, visual presentations, and preliminary designs not selected as Final Art shall remain exclusive property of Designer.</div>
				<div class="doc-term-sub"><strong>Designer IP.</strong> All intellectual property rights to exhibit systems, hardware, custom components, software, and fabrication methods shall remain exclusive property of Designer. Designer grants Client a nonexclusive, nontransferable, perpetual, worldwide license to use such work solely in connection with the Final Deliverables.</div>
			</div>
		</div>

		<div class="doc-section">
			<span class="doc-section-number">15. </span><span class="doc-section-title">ACCREDITATION/PROMOTIONS.</span>
			<span class="doc-section-body">Either party may reproduce, publish and display photographs of the Project, may describe its role in relation to the Project and, if applicable, the services provided to the other party on its website and in other promotional materials.</span>
		</div>

		<div class="doc-section">
			<span class="doc-section-number">16. </span><span class="doc-section-title">WARRANTIES AND REPRESENTATIONS.</span>
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
			<span class="doc-section-number">17. </span><span class="doc-section-title">CONFIDENTIAL INFORMATION.</span>
			<span class="doc-section-body">Each party may receive confidential information from the other, including Preliminary Works ("Confidential Information"). Both parties shall keep Confidential Information in strict confidence and use it only to perform under this Agreement, unless required by law. This does not apply to information already public, made public through no fault of the receiving party, or received from a third party without confidentiality obligations.</span>
		</div>

		<div class="doc-section">
			<span class="doc-section-number">18. </span><span class="doc-section-title">RELATIONSHIP OF THE PARTIES.</span>
			<div class="doc-section-body">
				<div>Designer is an independent contractor, not an employee of Client. Designer determines the manner and means by which Services are accomplished. This Agreement does not create a partnership, joint venture, or agency, and neither party may bind the other except as expressly stated herein.</div>
				<div style="margin-top:8px">Designer shall contract with and pay all subcontractors. Client has no liability to Designer's subcontractors, and Designer shall indemnify Client for any costs related to subcontractor non-payment.</div>
			</div>
		</div>

		<div class="doc-section">
			<span class="doc-section-number">19. </span><span class="doc-section-title">NO EXCLUSIVITY.</span>
			<span class="doc-section-body">Both parties are free to engage in similar agreements with other parties.</span>
		</div>

		<div class="doc-section">
			<span class="doc-section-number">20. </span><span class="doc-section-title">INDEMNIFICATION; HOLD HARMLESS.</span>
			<div class="doc-section-body">
				<div>To the maximum extent permitted by law, Designer agrees to indemnify and hold Client and their officers and employees harmless for, from and against all liabilities, damages, losses and costs, including, but not limited to, reasonable attorneys' fees, to the extent caused by (i) the gross negligence, recklessness, or intentionally wrongful conduct of the Designer and other persons employed or utilized by the Designer, including its consultants, in the performance of the Agreement; or (ii) Designer's breach of any material covenant, term, or provision of this Agreement. Designer further agrees to defend, indemnify and hold harmless Client and/or its licensees against all claims, suits, costs, damages and expenses, including attorneys' fees, that Client and/or its licensees may sustain by reason of any infringing, libelous or otherwise unlawful matter contained in the Works, excluding the Client Content.</div>
				<div style="margin-top:8px">To the maximum extent permitted by law, Client agrees to indemnify and hold Designer and their officers and employees harmless for, from and against all liabilities, damages, losses and costs, including, but not limited to, reasonable attorneys' fees, to the extent caused by (i) the gross negligence, recklessness, or intentionally wrongful conduct of Client and other persons employed by Client, including its consultants, in the performance of the Agreement; or (ii) Client's breach of any material covenant, term, or provision of this Agreement. Client further agrees to indemnify and hold harmless Upland and/or its licensees against any and all claims, costs, damages and expenses, including attorneys' fees, that Upland sustains by reason of any infringing, libelous or otherwise unlawful matter contained in the Client Content.</div>
			</div>
		</div>

		<div class="doc-section">
			<span class="doc-section-number">21. </span><span class="doc-section-title">LIMITATION OF LIABILITY.</span>
			<div class="doc-section-body">
				<div>In all circumstances, Designer's maximum liability to Client for damages for any and all causes whatsoever, and Client's maximum remedy, regardless of the form of action, shall be limited to 50% of the total compensation paid to Designer for the Services rendered.</div>
				<div style="margin-top:8px">In no event shall Designer be liable for any lost data or content, lost profits, business interruption or for any indirect, incidental, special, consequential, exemplary or punitive damages arising out of or relating to the materials or the services provided by Designer or its agents, even if Designer has been advised of the possibility of such damages.</div>
			</div>
		</div>

		<div class="doc-section">
			<span class="doc-section-number">22. </span><span class="doc-section-title">DEFAULT, SUSPENSION, AND TERMINATION.</span>
			<div class="doc-section-body">
				<div>If either party is in default with respect to any of the terms or conditions of this Agreement, including, without limitation, Client's failure to pay any invoice in accordance with the terms of this Agreement, the other party may, at its option, defer further performance until the default is remedied, and, without prejudice to any other legal remedy, may terminate this Agreement if the default is not remedied within thirty (30) calendar days (five (5) working days for nonpayment) after written notice is provided to the party in default, specifying the thing or matter in default. Unless waived by the party providing notice, the failure to cure the default(s) within such time period shall result in the automatic termination of this Agreement.</div>
				<div style="margin-top:8px">If the Project is paused, delayed, or suspended for more than thirty (30) days for reasons not caused by Designer, Designer may invoice Client for all Services performed and costs incurred to date, whether or not previously invoiced, and may require a reasonable restart fee before resuming Services. Designer may also revise the Project schedule and pricing to reflect then-current conditions.</div>
				<div style="margin-top:8px">Upon termination of this Agreement for any reason, Client shall pay Designer for all Services performed, materials ordered, commitments made, non-cancelable costs incurred, and reimbursable expenses through the effective date of termination. If termination occurs after Designer has allocated scheduling, staffing, fabrication capacity, or subcontractor commitments to the Project, Client shall also pay any reasonable demobilization, cancellation, restocking, or administrative close-out costs.</div>
			</div>
		</div>

		<div class="doc-section">
			<span class="doc-section-number">23. </span><span class="doc-section-title">FORCE MAJEURE.</span>
			<span class="doc-section-body">If performance is prevented or delayed by causes beyond either party's reasonable control ("Force Majeure"), the affected party shall give prompt written notice and its obligations shall be suspended to the extent necessary. Force Majeure includes acts of God, pandemics, fire, explosion, vandalism, storms, government action, national emergencies, insurrections, riots, wars, strikes, or lock-outs. The excused party shall use reasonable efforts to resume performance when the cause is removed.</span>
		</div>

		<div class="doc-section">
			<span class="doc-section-number">24. </span><span class="doc-section-title">NOTICE.</span>
			<div class="doc-section-body">
				<div>Any notice or communication required or permitted under this Agreement shall be sent via email. A notice shall be deemed received when the recipient confirms receipt by reply, or if no reply is received, on the third business day after sending. All notices shall be sent to:</div>
				<div class="doc-term-sub">Designer: ${esc(agreement.designer_email) || "joel@uplandexhibits.com"}</div>
				<div class="doc-term-sub">Client: ${esc(agreement.client_email) || "_______________"}</div>
			</div>
		</div>

		<div class="doc-section">
			<span class="doc-section-number">25. </span><span class="doc-section-title">GENERAL PROVISIONS.</span>
			<div class="doc-section-body">
				<div class="doc-term-sub">(a) <strong>Entire Agreement.</strong> This Agreement constitutes the entire agreement between the parties and supersedes all prior agreements, understandings, and communications, whether written or oral.</div>
				<div class="doc-term-sub">(b) <strong>Amendment.</strong> This Agreement may only be amended by a written instrument signed by both parties.</div>
				<div class="doc-term-sub">(c) <strong>Severability.</strong> If any provision of this Agreement shall be held to be invalid or unenforceable for any reason, the remaining provisions shall continue to be valid and enforceable. If a court finds that any provision of this Agreement is invalid or unenforceable, but that by limiting such provision it would become valid and enforceable, then such provision shall be deemed to be written, construed, and enforced as so limited.</div>
				<div class="doc-term-sub">(d) <strong>Waiver.</strong> The failure of either party to enforce any provision of this Agreement shall not constitute a waiver of such provision or the right to enforce it at a later time.</div>
				<div class="doc-term-sub">(e) <strong>Applicable Law.</strong> This Agreement shall be governed by and construed in accordance with the laws of the State of Kansas.</div>
			</div>
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
			<div class="form-group" style="margin-bottom:12px">
				<label>Organization / Legal Entity Name</label>
				<input type="text" id="signOrgName" value="${esc(agreement.client_name)}" placeholder="e.g., Museum at the Bighorns" required>
			</div>
			<div class="form-group" style="margin-bottom:12px">
				<label>Organization Address</label>
				<input type="text" id="signOrgAddress" value="${esc(agreement.client_address)}" placeholder="e.g., 123 Main St, City, State ZIP">
			</div>
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
			const client_name = orgNameInput?.value.trim() || "";
			const client_address = orgAddressInput?.value.trim() || "";

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
	// Force a narrow width so content reflows to fit the PDF page
	// Letter = 8.5in, minus margins and buffer for rendering tolerance
	element.style.width = "6.8in";

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
			element.style.width = "";
			overlay.remove();
			btn.disabled = false;
			btn.textContent = "Download PDF";
		})
		.catch(() => {
			element.classList.remove("pdf-rendering");
			element.style.width = "";
			overlay.remove();
			btn.disabled = false;
			btn.textContent = "Download PDF";
			alert("Failed to generate PDF. Try using the Print button instead.");
		});
});

load();
