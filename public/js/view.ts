import { api } from "./api.js";
import { esc } from "./utils.js";
import { renderAgreementBody, renderAgreementHtml, type AgreementData, type SettingsData } from "../../lib/render-agreement.js";

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
	signed: "Signed by client. Awaiting countersignature from Upland Exhibits to complete execution.",
	countersigned: "Fully executed. Both parties have signed this agreement.",
	declined: "This agreement has been declined.",
	expired: "This agreement has expired.",
};

// Store agreement data for PDF generation
let currentAgreement: AgreementData | null = null;
let currentSettings: SettingsData | null = null;

async function load() {
	if (!token && !previewId) return;

	try {
		const data = isPreview
			? (await api.previewAgreement(previewId!)) as { error?: string; agreement: AgreementData; settings: SettingsData }
			: (await api.viewAgreement(token!)) as { error?: string; agreement: AgreementData; settings: SettingsData };

		if ((data as { error?: string }).error) {
			document.getElementById("documentContent")!.innerHTML = `<p style="text-align:center;padding:40px;color:var(--text-muted)">${esc((data as { error: string }).error)}</p>`;
			return;
		}

		const agreement = data.agreement;
		const settings = data.settings || {};
		currentAgreement = agreement;
		currentSettings = settings;

		document.title = `${agreement.title} — Upland Exhibits`;

		if (isPreview) {
			document.getElementById("statusText")!.textContent = "Preview — this is how the client will see it.";
		} else {
			document.getElementById("statusText")!.textContent = STATUS_TEXT[(agreement as any).status] || "";
		}

		// Render document using shared template
		const docEl = document.getElementById("documentContent")!;
		docEl.innerHTML = renderAgreementBody(agreement, settings);
		if (agreement.type !== "mou_concept" && agreement.type !== "mou_small") docEl.classList.add("doc-full");

		// Append signing form if needed
		const a = agreement as any;
		if (!isPreview && !a.client_signature && (a.status === "sent" || a.status === "viewed")) {
			appendSigningForm(agreement);
		}
	} catch (err) {
		console.error("Failed to load agreement:", err);
		document.getElementById("documentContent")!.innerHTML = '<p style="text-align:center;padding:40px;color:var(--text-muted)">Failed to load agreement.</p>';
	}
}

// === Signing Form (appended to document, interactive) ===

function appendSigningForm(agreement: AgreementData) {
	const docEl = document.getElementById("documentContent")!;
	const form = document.createElement("div");
	form.innerHTML = `
		<div class="sign-area" id="signArea">
			<h3>Sign This Agreement</h3>
			<p style="font-size:0.85rem;color:var(--text-muted);margin-bottom:16px">Please confirm your information below. By clicking "Request Verification Code", a code will be sent to your email to verify your identity.</p>
			<div class="form-group" style="margin-bottom:12px">
				<label>Organization / Legal Entity Name</label>
				<input type="text" id="signOrgName" value="${esc(agreement.client_name)}" placeholder="e.g., Museum at the Bighorns" required>
			</div>
			<div class="form-group" style="margin-bottom:12px">
				<label>Organization Address</label>
				<input type="text" id="signOrgAddress" value="${esc(agreement.client_address)}" placeholder="e.g., 123 Main St, City, State ZIP" required>
			</div>
			<div class="form-group" style="margin-bottom:12px">
				<label>Your Full Name</label>
				<input type="text" id="signName" placeholder="Type your full legal name" required>
			</div>
			<div class="form-row" style="margin-bottom:12px">
				<div class="form-group">
					<label>Your Title</label>
					<input type="text" id="signTitle" placeholder="e.g., Executive Director" required>
				</div>
				<div class="form-group">
					<label>Your Email (verification code will be sent here)</label>
					<input type="email" id="signEmail" value="${esc(agreement.client_email)}" placeholder="you@organization.org" required>
				</div>
			</div>
			<label style="display:flex;align-items:flex-start;gap:8px;font-size:0.85rem;color:var(--text);margin-bottom:16px;cursor:pointer">
				<input type="checkbox" id="signConsent" style="margin-top:3px;flex-shrink:0" required>
				<span>I agree to sign this agreement electronically. I understand that my electronic signature has the same legal effect as a handwritten signature.</span>
			</label>
			<button class="btn btn-primary btn-lg" id="signBtn">Request Verification Code</button>
			<div id="verifyStep" hidden style="margin-top:16px">
				<p style="font-size:0.85rem;color:var(--text-muted);margin-bottom:12px">A verification code has been sent to your email. Enter it below. The code is valid for 1 hour.</p>
				<div class="form-group" style="margin-bottom:12px">
					<label>Verification Code</label>
					<input type="text" id="verifyCode" placeholder="000000" maxlength="6" inputmode="numeric" pattern="[0-9]*" style="letter-spacing:6px;font-size:18px;text-align:center;width:140px">
				</div>
				<button class="btn btn-primary" id="verifyBtn">Verify Code</button>
			</div>
			<div id="confirmStep" hidden style="margin-top:16px">
				<div class="form-success" style="margin-bottom:16px">Email verified. Click below to sign this agreement.</div>
				<button class="btn btn-primary btn-lg" id="confirmSignBtn">Sign Agreement</button>
			</div>
		</div>
	`;
	docEl.appendChild(form);

	// Step 1: Send verification code
	const signBtn = document.getElementById("signBtn")!;
	signBtn.addEventListener("click", async () => {
		const orgNameInput = document.getElementById("signOrgName") as HTMLInputElement;
		const orgAddressInput = document.getElementById("signOrgAddress") as HTMLInputElement;
		const nameInput = document.getElementById("signName") as HTMLInputElement;
		const titleInput = document.getElementById("signTitle") as HTMLInputElement;
		const emailInput = document.getElementById("signEmail") as HTMLInputElement;

		if (!orgNameInput.value.trim()) { orgNameInput.focus(); return; }
		// Address completeness check
		const addr = orgAddressInput.value.trim();
		if (!addr) { orgAddressInput.focus(); return; }
		const addrWarning = document.getElementById("addrWarning");
		if ((!addr.includes(",") || addr.length < 15) && !addrWarning?.dataset.acknowledged) {
			if (!addrWarning) {
				const warn = document.createElement("div");
				warn.id = "addrWarning";
				warn.style.cssText = "font-size:0.82rem;color:#ca8a04;margin-top:4px;display:flex;align-items:center;gap:8px";
				warn.innerHTML = 'This doesn\'t look like a complete address — please include city, state, and ZIP. <button class="btn btn-sm" style="flex-shrink:0" id="addrOk">It\'s correct</button>';
				orgAddressInput.parentElement!.appendChild(warn);
				document.getElementById("addrOk")!.addEventListener("click", () => { warn.dataset.acknowledged = "1"; warn.remove(); });
			}
			orgAddressInput.focus();
			return;
		}
		if (!nameInput.value.trim()) { nameInput.focus(); return; }
		if (!titleInput.value.trim()) { titleInput.focus(); return; }
		if (!emailInput.value.trim()) { emailInput.focus(); return; }
		const consentBox = document.getElementById("signConsent") as HTMLInputElement;
		if (!consentBox?.checked) { consentBox.focus(); return; }

		(signBtn as HTMLButtonElement).disabled = true;
		signBtn.textContent = "Sending code...";

		try {
			const result = await fetch(`/api/agreements/view/${token}/send-code`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ email: emailInput.value.trim() }),
			}).then((r) => r.json()) as { error?: string };

			if (result.error) {
				alert(result.error);
				(signBtn as HTMLButtonElement).disabled = false;
				signBtn.textContent = "Request Verification Code";
				return;
			}

			signBtn.style.display = "none";
			document.getElementById("verifyStep")!.hidden = false;
			document.getElementById("verifyCode")!.focus();
		} catch {
			alert("Failed to send code. Please try again.");
			(signBtn as HTMLButtonElement).disabled = false;
			signBtn.textContent = "Request Verification Code";
		}
	});

	// Step 2: Verify code
	let verifiedCode = "";
	document.getElementById("verifyBtn")!.addEventListener("click", async () => {
		const codeInput = document.getElementById("verifyCode") as HTMLInputElement;
		const code = codeInput.value.trim();
		if (!code || code.length < 6) { codeInput.focus(); return; }

		const verifyBtn = document.getElementById("verifyBtn") as HTMLButtonElement;
		verifyBtn.disabled = true;
		verifyBtn.textContent = "Verifying...";

		const emailInput = document.getElementById("signEmail") as HTMLInputElement;

		try {
			const result = await fetch(`/api/agreements/view/${token}/verify-code`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ email: emailInput.value.trim(), code }),
			}).then((r) => r.json()) as { error?: string; verified?: boolean };

			if (result.error) {
				alert(result.error);
				verifyBtn.disabled = false;
				verifyBtn.textContent = "Verify Code";
				return;
			}

			verifiedCode = code;
			document.getElementById("verifyStep")!.hidden = true;
			document.getElementById("confirmStep")!.hidden = false;
		} catch {
			alert("Verification failed. Please try again.");
			verifyBtn.disabled = false;
			verifyBtn.textContent = "Verify Code";
		}
	});

	// Step 3: Sign
	document.getElementById("confirmSignBtn")!.addEventListener("click", async () => {
		const confirmBtn = document.getElementById("confirmSignBtn") as HTMLButtonElement;
		confirmBtn.disabled = true;
		confirmBtn.textContent = "Signing...";

		const consentBox = document.getElementById("signConsent") as HTMLInputElement;

		try {
			const result = (await api.signAgreement(token!, {
				name: (document.getElementById("signName") as HTMLInputElement).value.trim(),
				title: (document.getElementById("signTitle") as HTMLInputElement).value.trim(),
				client_name: (document.getElementById("signOrgName") as HTMLInputElement).value.trim(),
				client_address: (document.getElementById("signOrgAddress") as HTMLInputElement).value.trim(),
				consent_text: consentBox.parentElement?.querySelector("span")?.textContent || "",
				email: (document.getElementById("signEmail") as HTMLInputElement).value.trim(),
				code: verifiedCode,
			})) as { error?: string };

			if (result.error) {
				alert(result.error);
				confirmBtn.disabled = false;
				confirmBtn.textContent = "Sign Agreement";
				return;
			}

			load();
		} catch {
			alert("Failed to sign. Please try again.");
			confirmBtn.disabled = false;
			confirmBtn.textContent = "Sign Agreement";
		}
	});
}

// === PDF Download via DocRaptor ===

document.getElementById("pdfBtn")?.addEventListener("click", async () => {
	const parts = document.title.split(" — ");
	const filename = (parts[0] || "Agreement").replace(/[^a-zA-Z0-9 ]/g, "").replace(/\s+/g, "_");

	const btn = document.getElementById("pdfBtn") as HTMLButtonElement;
	btn.disabled = true;
	btn.textContent = "Generating...";

	const overlay = document.createElement("div");
	overlay.className = "pdf-overlay";
	overlay.innerHTML = '<div class="pdf-overlay-text">Generating PDF...</div>';
	document.body.appendChild(overlay);

	try {
		// Use server-side rendered HTML from shared module if we have the data,
		// otherwise fall back to DOM scraping
		let html: string;
		if (currentAgreement && currentSettings) {
			html = renderAgreementHtml(currentAgreement, currentSettings);
		} else {
			const element = document.getElementById("documentContent")!;
			const styles = Array.from(document.querySelectorAll('link[rel="stylesheet"], style')).map((el) => el.outerHTML).join("\n");
			const fonts = Array.from(document.querySelectorAll('link[href*="fonts"]')).map((el) => el.outerHTML).join("\n");
			html = `<!DOCTYPE html><html><head><meta charset="UTF-8">${fonts}${styles}
				<style>@page { size: letter; margin: 1in 1in 1.2in 1in; @bottom-center { content: "Page " counter(page) " of " counter(pages); font-size: 9px; color: #999; } }
				body { background: white; margin: 0; padding: 0; } .document { border: none; border-radius: 0; box-shadow: none; padding: 0; max-width: none; }
				.view-status-bar, .view-actions, .sign-area, .pdf-overlay, #verifyStep, #confirmStep { display: none !important; }</style>
				</head><body><div class="document">${element.innerHTML}</div></body></html>`;
		}

		const response = await fetch("/api/pdf", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ html, filename }),
		});

		if (!response.ok) throw new Error("PDF generation failed");

		const blob = await response.blob();
		const url = URL.createObjectURL(blob);
		const a = document.createElement("a");
		a.href = url;
		a.download = `${filename}.pdf`;
		a.click();
		URL.revokeObjectURL(url);
	} catch {
		alert("Failed to generate PDF. Try using the Print button instead.");
	}

	overlay.remove();
	btn.disabled = false;
	btn.textContent = "Download PDF";
});

load();
