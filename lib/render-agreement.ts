// Shared agreement rendering — used by both client-side view and server-side PDF generation.
// Pure functions, no DOM dependencies.

export interface AgreementData {
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
	designer_email: string | null;
	client_signature: string | null;
	designer_signature: string | null;
}

export interface SettingsData {
	legal_name?: string;
	company_address?: string;
	designer_name?: string;
	designer_title?: string;
}

// === Helpers ===

export function esc(val: string | null | undefined): string {
	if (!val) return "";
	return val.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export function formatDate(dateStr: string | null | undefined, style: "short" | "long" = "short"): string {
	if (!dateStr) return style === "long" ? "_______________" : "";
	return new Date(dateStr + (dateStr.length === 10 ? "T00:00:00" : "")).toLocaleDateString("en-US", {
		month: style === "long" ? "long" : "short",
		day: "numeric",
		year: "numeric",
	});
}

export function formatCurrency(amount: number | null | undefined): string {
	if (amount === null || amount === undefined) return "";
	return "$" + amount.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function formatParagraphs(text: string | null): string {
	if (!text) return "<p>—</p>";
	return text.split(/\n\n+/).map((p) => p.trim()).filter(Boolean).map((p) => `<p style="margin:0 0 8px">${esc(p)}</p>`).join("");
}

function formatMixed(text: string | null): string {
	if (!text) return "";
	const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
	let html = "";
	let listItems: string[] = [];
	for (const line of lines) {
		if (line.startsWith("- ") || line.startsWith("* ")) {
			listItems.push(esc(line.replace(/^[-*]\s*/, "")));
		} else {
			if (listItems.length > 0) {
				html += "<ul style='margin:4px 0 8px;padding-left:24px'>" + listItems.map((li) => `<li>${li}</li>`).join("") + "</ul>";
				listItems = [];
			}
			html += `<p style="margin:0 0 8px">${esc(line)}</p>`;
		}
	}
	if (listItems.length > 0) {
		html += "<ul style='margin:4px 0 8px;padding-left:24px'>" + listItems.map((li) => `<li>${li}</li>`).join("") + "</ul>";
	}
	return html;
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

function renderMouCost(agreement: AgreementData): string {
	const rows: { label: string; amount: string }[] = [];
	if (agreement.hours && agreement.hourly_rate) {
		rows.push({
			label: `Concept design: ${agreement.hours} hours x $${agreement.hourly_rate} / hr`,
			amount: formatCurrency(agreement.hours * agreement.hourly_rate),
		});
	}
	let expenses: { label: string; amount: number }[] = [];
	try { if (agreement.payment_structure) expenses = JSON.parse(agreement.payment_structure); } catch {}
	if (Array.isArray(expenses)) {
		for (const exp of expenses) {
			if (exp.label || exp.amount) rows.push({ label: esc(exp.label), amount: formatCurrency(exp.amount) });
		}
	}
	if (rows.length === 0) return agreement.total_cost ? formatCurrency(agreement.total_cost) : "—";
	if (rows.length === 1) return `${rows[0].label} = ${rows[0].amount}`;
	let html = '<table class="cost-table">';
	for (const row of rows) {
		html += `<tr><td class="cost-label">${row.label}</td><td class="cost-amount">${row.amount}</td></tr>`;
	}
	html += `<tr class="cost-total-row"><td class="cost-label">Total</td><td class="cost-amount">${formatCurrency(agreement.total_cost)}</td></tr>`;
	html += "</table>";
	return html;
}

function isMouType(type: string): boolean {
	return type === "mou_concept" || type === "mou_small";
}

function renderSignedInfo(sig: Record<string, unknown>): string {
	const name = esc(sig.name as string);
	const title = sig.title ? `, ${esc(sig.title as string)}` : "";
	const ts = sig.timestamp as string;
	const date = new Date(ts);
	const tz = "America/Chicago";
	const dateStr = date.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: tz });
	const timeStr = date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: tz, timeZoneName: "short" });
	const ip = sig.ip ? esc(sig.ip as string) : "";

	return `<div class="signed-info">
		<div class="signed-name">${name}${title}</div>
		<div class="signed-meta">Signed ${dateStr} at ${timeStr}${ip ? ` &middot; IP: ${ip}` : ""}</div>
	</div>`;
}

function parseSig(json: string | null): Record<string, unknown> | null {
	if (!json) return null;
	try { return JSON.parse(json); } catch { return null; }
}

// === Signature Block ===

function renderSignatures(agreement: AgreementData, settings: SettingsData): string {
	const companyName = settings.legal_name || "Flint Hills Design, LLC dba Upland Exhibits";
	const designerName = settings.designer_name || "Joel Gaeddert";
	const designerTitle = settings.designer_title || "CEO";
	const isMou = isMouType(agreement.type);

	const clientSig = parseSig(agreement.client_signature);
	const designerSig = parseSig(agreement.designer_signature);

	return `
		<div style="margin-bottom:16px;font-weight:600;font-size:15px">Agreed and accepted:</div>

		${isMou ? `
		<div class="signature-pairs">
			<div class="signature-pair">
				${clientSig ? renderSignedInfo(clientSig) : `
					<div class="signature-line-row">
						<div class="signature-field">
							<div class="signature-line"></div>
							<div class="signature-underline-label">${esc(agreement.client_contact) || "Client Signature"}${agreement.client_title ? `, ${esc(agreement.client_title)}` : ", Title"}</div>
						</div>
						<div class="date-field">
							<div class="signature-line"></div>
							<div class="signature-underline-label">Date</div>
						</div>
					</div>
				`}
			</div>
			<div class="signature-pair">
				${designerSig ? renderSignedInfo(designerSig) : `
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
		<div class="signature-block">
			<div class="signature-block-label">"Client"</div>
			<div class="signature-block-org">${esc(agreement.client_name) || "_______________"}</div>
			${clientSig ? renderSignedInfo(clientSig) : `
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
			${designerSig ? renderSignedInfo(designerSig) : `
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
	`;
}

// === MoU Template ===

function renderMouBody(agreement: AgreementData, settings: SettingsData): string {
	const isSmall = agreement.type === "mou_small";

	return `
		<div class="doc-header">
			<img src="https://agreements.uplandexhibits.com/upland-logo.svg" alt="Upland Exhibits" class="doc-logo">
			<h1>Memo of Understanding</h1>
			<div class="doc-subtitle">for Design Services</div>
		</div>

		<div class="mou-field">
			<div class="mou-field-label">Client</div>
			<div class="mou-field-value">${esc(agreement.client_name) || "_______________"}</div>
		</div>

		<div class="mou-field">
			<div class="mou-field-label">Project</div>
			<div class="mou-field-value">${esc(agreement.title)}</div>
		</div>

		<div class="mou-field">
			<div class="mou-field-label">Scope of Work / Deliverable</div>
			<div class="mou-field-value">${formatParagraphs(agreement.project_description)}${agreement.deliverable ? formatMixed(agreement.deliverable) : ""}</div>
		</div>

		<div class="mou-field">
			<div class="mou-field-label">Target Delivery</div>
			<div class="mou-field-value">${agreement.end_date ? formatDate(agreement.end_date, "long") : "—"}</div>
		</div>

		<div class="mou-field">
			<div class="mou-field-label">Cost</div>
			<div class="mou-field-value">${renderMouCost(agreement)}</div>
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

		<div class="doc-signature-area">
			${renderSignatures(agreement, settings)}
		</div>
	`;
}

// === Full Agreement Template ===

function renderFullAgreementBody(agreement: AgreementData, settings: SettingsData): string {
	const companyName = settings.legal_name || "Flint Hills Design, LLC dba Upland Exhibits";
	const companyAddress = settings.company_address || "507 SE 36th St., Newton, Kansas 67114";

	let ps = { initial_pct: 10, initial_amount: 0, progress_note: "", final_pct: 10, final_amount: 0 };
	try { if (agreement.payment_structure) ps = JSON.parse(agreement.payment_structure); } catch {}

	let rates = { head_rate: 95, design_rate: 75, fab_rate: 65, materials_markup: 15, travel_rate: 55 };
	try { if (agreement.service_rates) rates = JSON.parse(agreement.service_rates); } catch {}

	return `
		<div class="doc-header">
			<img src="https://agreements.uplandexhibits.com/upland-logo.svg" alt="Upland Exhibits" class="doc-logo">
			<h1>General Agreement for Services</h1>
		</div>

		<div class="doc-preamble">
			This Agreement ("Agreement") is made effective as of ${agreement.effective_date ? formatDate(agreement.effective_date, "long") : "the date of signing"} (the "Effective Date") by and between <strong>${esc(companyName)}</strong>, of ${esc(companyAddress)}, ("Upland" or "Designer"), and <strong>${esc(agreement.client_name) || "_______________"}</strong>, ${esc(agreement.client_address) || "_______________"} ("Client").
		</div>

		<div class="doc-section"><span class="doc-section-number">1. </span><span class="doc-section-title">TERM.</span> <span class="doc-section-body">This Agreement shall begin on the Effective Date and shall end, unless earlier terminated, upon satisfactory completion of the Project as outlined in the Description of Services, but in any event, no later than ${formatDate(agreement.end_date, "long")}.</span></div>

		<div class="doc-section"><span class="doc-section-number">2. </span><span class="doc-section-title">DESCRIPTION OF SERVICES.</span> <span class="doc-section-body">${esc(agreement.project_description) || "—"}</span></div>

		<div class="doc-section"><span class="doc-section-number">3. </span><span class="doc-section-title">PROJECT COST.</span> <span class="doc-section-body">The parties agree that all Services shall be performed on a Time-And-Material-Not-To-Exceed basis. The total compensation to Designer under this Agreement shall not exceed <strong>${formatCurrency(agreement.total_cost)}</strong> ("NTE Amount"). The NTE Amount is based on the Project scope, assumptions, and information available as of the Effective Date. Material changes in scope, assumptions, site conditions, Client direction, code requirements, or other project conditions may require an equitable adjustment to the NTE Amount.</span></div>

		<div class="doc-section"><span class="doc-section-number">4. </span><span class="doc-section-title">INITIAL PAYMENT.</span> <span class="doc-section-body">A payment of <strong>${formatCurrency(ps.initial_amount)}</strong> (equaling approximately ${ps.initial_pct || 10}% of the Project Cost) will be required to retain Upland's services. This payment will be due within 30 days of signing this Agreement. Work shall not commence until the Initial Payment is received.</span></div>

		<div class="doc-section"><span class="doc-section-number">5. </span><span class="doc-section-title">PROGRESS BILLINGS.</span> <span class="doc-section-body">${ps.progress_note || "Progress billings will be invoiced on a percentage of completion basis, not to exceed 90% of the NTE Amount."}</span></div>

		<div class="doc-section"><span class="doc-section-number">6. </span><span class="doc-section-title">FINAL PAYMENT.</span> <span class="doc-section-body">The remaining balance of approximately <strong>${formatCurrency(ps.final_amount)}</strong> (${ps.final_pct || 10}% of the Project Cost) may be invoiced upon Substantial Completion of the Project, defined as installation of the exhibit such that it is suitable for public viewing or intended use, subject only to minor punch list items that do not materially impair use. Final payment shall not be withheld due to minor punch list items, and Client approval shall not be unreasonably withheld.</span></div>

		<div class="doc-section"><span class="doc-section-number">7. </span><span class="doc-section-title">PAYMENT TERMS AND REMEDIES.</span>
			<div class="doc-section-body">
				<div>Upland shall submit all invoices to Client via email, with NET30 terms. Payment shall be made to ${esc(companyName)}, ${esc(companyAddress)}. If any invoice is not paid when due, interest will be added to and payable on all overdue amounts at 18 percent per year, or the maximum percentage allowed under applicable laws, whichever is less. Client shall pay all costs of collection, including without limitation, reasonable attorney fees.</div>
				<div style="margin-top:8px">In addition to any other right or remedy provided by law, if Client fails to pay for the Services when due, Upland has the option to treat such failure to pay as a material breach of this Agreement, and may cancel this Agreement, suspend further services, and/or seek legal remedies.</div>
			</div>
		</div>

		<div class="doc-section"><span class="doc-section-number">8. </span><span class="doc-section-title">BEST EFFORTS BASIS.</span> <span class="doc-section-body">Services are provided on a "best effort" basis, meaning Designer will apply professional training, experience, and judgment. Non-acceptance of a design direction shall not constitute reason for non-payment.</span></div>

		<div class="doc-section"><span class="doc-section-number">9. </span><span class="doc-section-title">CHANGES.</span> <span class="doc-section-body">Out-of-scope changes shall be billed on a time and materials basis at Designer's Service Rates, in addition to all other amounts payable, despite any maximum Project Cost. Designer may extend the delivery schedule as required by such changes. Changes shall be documented in writing and may be approved by signed instrument or email. Rework of previously approved work shall be treated as Additional Services and billed accordingly.</span></div>

		<div class="doc-section"><span class="doc-section-number">10. </span><span class="doc-section-title">SERVICE RATES.</span>
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

		<div class="doc-section"><span class="doc-section-number">11. </span><span class="doc-section-title">CLIENT RESPONSIBILITIES.</span>
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

		<div class="doc-section"><span class="doc-section-number">12. </span><span class="doc-section-title">SCHEDULE; CLIENT DELAYS.</span> <span class="doc-section-body">The Project schedule assumes timely Client decisions, approvals, content, site access, and other required inputs. Delays caused by Client or its representatives shall automatically extend the schedule. If delays result in additional costs to Designer, Client shall pay such costs as Additional Services.</span></div>

		<div class="doc-section"><span class="doc-section-number">13. </span><span class="doc-section-title">SUBSTITUTIONS.</span> <span class="doc-section-body">Designer may substitute materials, components, finishes, or methods of comparable quality and design intent when required by availability, lead times, field conditions, code requirements, or other circumstances beyond Designer's reasonable control. Substitutions that materially affect design intent or functionality shall be communicated to Client.</span></div>

		<div class="doc-section"><span class="doc-section-number">14. </span><span class="doc-section-title">TITLE AND ASSIGNMENT.</span>
			<div class="doc-section-body">
				<div class="doc-term-sub"><strong>Client Content.</strong> All materials, information, photography, writings, and other content provided by Client, including pre-existing Trademarks, shall remain Client's sole property. Client grants Designer a nonexclusive, nontransferable license to use the Client Content solely to perform the Services and for limited promotional use as authorized in this Agreement.</div>
				<div class="doc-term-sub"><strong>Final Art.</strong> All design, illustration, photography, animation, and graphic layouts created by Designer exclusively for the Project shall be works made for hire and become Client's sole property upon full payment, except where restricted by Third Party Material licensing.</div>
				<div class="doc-term-sub"><strong>Third Party Materials.</strong> Stock photography, commissioned illustrations, fonts, and similar third-party assets remain property of their respective owners. Client is responsible for obtaining any necessary licenses at Client's expense. Client indemnifies Designer against any claims arising from Client's failure to secure required licenses for materials included in the Final Art.</div>
				<div class="doc-term-sub"><strong>Preliminary Works.</strong> All concepts, sketches, visual presentations, and preliminary designs not selected as Final Art shall remain exclusive property of Designer.</div>
				<div class="doc-term-sub"><strong>Designer IP.</strong> All intellectual property rights to exhibit systems, hardware, custom components, software, and fabrication methods shall remain exclusive property of Designer. Designer grants Client a nonexclusive, nontransferable, perpetual, worldwide license to use such work solely in connection with the Final Deliverables.</div>
			</div>
		</div>

		<div class="doc-section"><span class="doc-section-number">15. </span><span class="doc-section-title">ACCREDITATION/PROMOTIONS.</span> <span class="doc-section-body">Either party may reproduce, publish and display photographs of the Project, may describe its role in relation to the Project and, if applicable, the services provided to the other party on its website and in other promotional materials.</span></div>

		<div class="doc-section"><span class="doc-section-number">16. </span><span class="doc-section-title">WARRANTIES AND REPRESENTATIONS.</span>
			<div class="doc-section-body">
				<div style="margin-bottom:8px">Designer represents and warrants that:</div>
				<div class="doc-term-sub">(a) Services will be performed in a timely, professional manner meeting commercially acceptable standards.</div>
				<div class="doc-term-sub">(b) Project exhibits shall be free from design, manufacture, or production defects for two years from completion, normal wear and tear excepted.</div>
				<div class="doc-term-sub">(c) To the best of Designer's knowledge, the Works do not infringe any third-party rights or contain unlawful matter.</div>
				<div style="margin-top:12px;margin-bottom:8px">Client represents and warrants that:</div>
				<div class="doc-term-sub">(a) Client has full right and authority to provide the Client Content for use in the Project.</div>
				<div class="doc-term-sub">(b) The Client Content does not infringe the rights of any third party.</div>
			</div>
		</div>

		<div class="doc-section"><span class="doc-section-number">17. </span><span class="doc-section-title">CONFIDENTIAL INFORMATION.</span> <span class="doc-section-body">Each party may receive confidential information from the other, including Preliminary Works ("Confidential Information"). Both parties shall keep Confidential Information in strict confidence and use it only to perform under this Agreement, unless required by law. This does not apply to information already public, made public through no fault of the receiving party, or received from a third party without confidentiality obligations.</span></div>

		<div class="doc-section"><span class="doc-section-number">18. </span><span class="doc-section-title">RELATIONSHIP OF THE PARTIES.</span>
			<div class="doc-section-body">
				<div>Designer is an independent contractor, not an employee of Client. Designer determines the manner and means by which Services are accomplished. This Agreement does not create a partnership, joint venture, or agency, and neither party may bind the other except as expressly stated herein.</div>
				<div style="margin-top:8px">Designer is responsible for all subcontractors and shall indemnify Client against any claims related to subcontractor non-payment.</div>
			</div>
		</div>

		<div class="doc-section"><span class="doc-section-number">19. </span><span class="doc-section-title">NO EXCLUSIVITY.</span> <span class="doc-section-body">Both parties are free to engage in similar agreements with other parties.</span></div>

		<div class="doc-section"><span class="doc-section-number">20. </span><span class="doc-section-title">INDEMNIFICATION; HOLD HARMLESS.</span> <span class="doc-section-body">Each party shall indemnify and hold harmless the other from all liabilities, damages, losses, and costs (including reasonable attorneys' fees) arising from (i) the indemnifying party's gross negligence, recklessness, or intentional misconduct; or (ii) breach of any material term of this Agreement. Client additionally indemnifies Designer against claims arising from the Client Content.</span></div>

		<div class="doc-section"><span class="doc-section-number">21. </span><span class="doc-section-title">LIMITATION OF LIABILITY.</span> <span class="doc-section-body">Designer's maximum liability under this Agreement shall not exceed 50% of the total compensation paid to Designer. In no event shall Designer be liable for lost profits, business interruption, or any indirect, incidental, special, consequential, or punitive damages, even if advised of the possibility of such damages.</span></div>

		<div class="doc-section"><span class="doc-section-number">22. </span><span class="doc-section-title">DEFAULT, SUSPENSION, AND TERMINATION.</span> <span class="doc-section-body">If either party defaults, the other may suspend performance and, if the default is not cured within thirty (30) days of written notice (five (5) working days for non-payment), may terminate this Agreement. If the Project is suspended for more than thirty (30) days for reasons not caused by Designer, Designer may invoice all work to date and require a restart fee. Upon termination for any reason, Client shall pay for all Services performed, materials ordered, and non-cancelable commitments through the date of termination.</span></div>

		<div class="doc-section"><span class="doc-section-number">23. </span><span class="doc-section-title">FORCE MAJEURE.</span> <span class="doc-section-body">If performance is prevented or delayed by causes beyond either party's reasonable control ("Force Majeure"), the affected party shall give prompt written notice and its obligations shall be suspended to the extent necessary. Force Majeure includes acts of God, pandemics, fire, explosion, vandalism, storms, government action, national emergencies, insurrections, riots, wars, strikes, or lock-outs. The excused party shall use reasonable efforts to resume performance when the cause is removed.</span></div>

		<div class="doc-section"><span class="doc-section-number">24. </span><span class="doc-section-title">NOTICE.</span>
			<div class="doc-section-body">
				<div>Any notice or communication required or permitted under this Agreement shall be sent via email. A notice shall be deemed received when the recipient confirms receipt by reply, or if no reply is received, on the third business day after sending. All notices shall be sent to:</div>
				<div class="doc-term-sub">Designer: ${esc(agreement.designer_email) || "joel@uplandexhibits.com"}</div>
				<div class="doc-term-sub">Client: ${esc(agreement.client_email) || "_______________"}</div>
			</div>
		</div>

		<div class="doc-section"><span class="doc-section-number">25. </span><span class="doc-section-title">GENERAL PROVISIONS.</span>
			<div class="doc-section-body">
				<div class="doc-term-sub">(a) <strong>Entire Agreement.</strong> This Agreement constitutes the entire agreement between the parties and supersedes all prior agreements, understandings, and communications, whether written or oral.</div>
				<div class="doc-term-sub">(b) <strong>Amendment.</strong> This Agreement may only be amended by a written instrument signed by both parties.</div>
				<div class="doc-term-sub">(c) <strong>Severability.</strong> If any provision is held invalid or unenforceable, the remaining provisions remain in effect, and any invalid provision shall be modified to the minimum extent necessary to make it enforceable.</div>
				<div class="doc-term-sub">(d) <strong>Waiver.</strong> The failure of either party to enforce any provision of this Agreement shall not constitute a waiver of such provision or the right to enforce it at a later time.</div>
				<div class="doc-term-sub">(e) <strong>Applicable Law.</strong> This Agreement shall be governed by and construed in accordance with the laws of the State of Kansas.</div>
			</div>
		</div>

		<div class="doc-signature-area">
			${renderSignatures(agreement, settings)}
		</div>
	`;
}

// === Main Export ===

export function renderAgreementBody(agreement: AgreementData, settings: SettingsData): string {
	if (isMouType(agreement.type)) {
		return renderMouBody(agreement, settings);
	}
	return renderFullAgreementBody(agreement, settings);
}

export function renderAgreementHtml(agreement: AgreementData, settings: SettingsData): string {
	const body = renderAgreementBody(agreement, settings);
	return `<!DOCTYPE html>
<html><head>
<meta charset="UTF-8">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Caveat:wght@600&family=Instrument+Sans:wght@400;500;600;700&display=swap" rel="stylesheet">
<link rel="stylesheet" href="https://agreements.uplandexhibits.com/css/shared.css">
<link rel="stylesheet" href="https://agreements.uplandexhibits.com/css/view.css">
<style>
	@page { size: letter; margin: 1in 1in 1.2in 1in; @bottom-center { content: "Page " counter(page) " of " counter(pages); font-size: 9px; color: #999; } }
	body { background: white; margin: 0; padding: 0; }
	.document { border: none; border-radius: 0; box-shadow: none; padding: 0; max-width: none; }
	.view-status-bar, .view-actions, .sign-area, .pdf-overlay, #verifyStep, #confirmStep { display: none !important; }
</style>
</head><body>
<div class="document">${body}</div>
</body></html>`;
}
