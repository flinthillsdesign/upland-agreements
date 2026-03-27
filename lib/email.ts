import postmark from "postmark";

let client: postmark.ServerClient | null = null;

function getClient(): postmark.ServerClient | null {
	if (!process.env.POSTMARK_API_TOKEN) return null;
	if (!client) {
		client = new postmark.ServerClient(process.env.POSTMARK_API_TOKEN);
	}
	return client;
}

const FROM = process.env.POSTMARK_FROM_EMAIL || "info@uplandexhibits.com";

function escHtml(val: string): string {
	return val.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function wrap(content: string): string {
	return `<div style="font-family:'Instrument Sans',system-ui,-apple-system,sans-serif;max-width:520px;margin:0 auto;padding:32px 0">
	<div style="margin-bottom:24px"><img src="https://assets.uplandexhibits.com/media/img/logos/Upland-Exhibits-logo-dark.svg" alt="Upland Exhibits" style="height:32px;width:auto"></div>
	${content}
	<div style="margin-top:32px;padding-top:16px;border-top:1px solid #e2dfd9;font-size:12px;color:#6b6560">Upland Exhibits &mdash; info@uplandexhibits.com</div>
</div>`;
}

function btn(href: string, label: string): string {
	return `<a href="${href}" style="display:inline-block;padding:12px 24px;background:#2c5530;color:#fff;text-decoration:none;border-radius:6px;font-weight:600;font-size:14px">${label}</a>`;
}

async function send(to: string, subject: string, html: string, text: string, attachments?: { Name: string; Content: string; ContentType: string }[]): Promise<boolean> {
	const pm = getClient();
	if (!pm) {
		console.log(`[email] Would send to ${to}: ${subject}`);
		return true;
	}
	try {
		const msg: Record<string, unknown> = { From: FROM, To: to, Subject: subject, HtmlBody: html, TextBody: text, MessageStream: "outbound" };
		if (attachments?.length) msg.Attachments = attachments;
		await pm.sendEmail(msg as any);
		return true;
	} catch (err) {
		console.error("[email] Send failed:", err);
		return false;
	}
}

export async function sendResetEmail(to: string, token: string, baseUrl: string): Promise<boolean> {
	const url = `${baseUrl}/reset.html?token=${encodeURIComponent(token)}`;
	return send(to,
		"Password Reset — Upland Agreements",
		wrap(`
			<p style="font-size:14px;color:#1a1a1a;margin-bottom:16px">You requested a password reset for your Upland Agreements account.</p>
			<p style="margin-bottom:24px">${btn(url, "Reset Password")}</p>
			<p style="font-size:12px;color:#6b6560">This link expires in 1 hour. If you didn't request this, ignore this email.</p>
		`),
		`You requested a password reset.\n\nReset your password: ${url}\n\nThis link expires in 1 hour.`,
	);
}

export async function sendAgreementSharedEmail(to: string, agreementTitle: string, viewUrl: string): Promise<boolean> {
	return send(to,
		`Agreement from Upland Exhibits: ${agreementTitle}`,
		wrap(`
			<p style="font-size:14px;color:#1a1a1a;margin-bottom:8px">Upland Exhibits has prepared an agreement for your review:</p>
			<p style="font-size:18px;font-weight:600;color:#1a1a1a;margin-bottom:20px">${escHtml(agreementTitle)}</p>
			<p style="margin-bottom:24px">${btn(viewUrl, "Review Agreement")}</p>
			<p style="font-size:13px;color:#6b6560">If you have questions, reply to this email or contact us directly.</p>
		`),
		`Upland Exhibits has prepared an agreement for your review.\n\n${agreementTitle}\n\nReview it here: ${viewUrl}`,
	);
}

export async function sendAgreementViewedEmail(to: string, agreementTitle: string, clientName: string, editorUrl: string): Promise<boolean> {
	return send(to,
		`Agreement viewed: ${agreementTitle}`,
		wrap(`
			<p style="font-size:14px;color:#1a1a1a;margin-bottom:8px"><strong>${escHtml(clientName || "A client")}</strong> just opened your agreement:</p>
			<p style="font-size:16px;font-weight:600;color:#1a1a1a;margin-bottom:20px">${escHtml(agreementTitle)}</p>
			<p style="margin-bottom:24px">${btn(editorUrl, "Open in Editor")}</p>
		`),
		`${clientName || "A client"} just opened your agreement: ${agreementTitle}\n\nOpen in editor: ${editorUrl}`,
	);
}

export async function sendAgreementSignedEmail(to: string, agreementTitle: string, clientName: string, editorUrl: string): Promise<boolean> {
	return send(to,
		`Agreement signed: ${agreementTitle}`,
		wrap(`
			<div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:16px;margin-bottom:20px">
				<p style="font-size:14px;color:#15803d;font-weight:600;margin:0">Agreement Signed by Client</p>
			</div>
			<p style="font-size:14px;color:#1a1a1a;margin-bottom:8px"><strong>${escHtml(clientName || "Your client")}</strong> signed the agreement:</p>
			<p style="font-size:16px;font-weight:600;color:#1a1a1a;margin-bottom:20px">${escHtml(agreementTitle)}</p>
			<p style="margin-bottom:24px">${btn(editorUrl, "Review & Countersign")}</p>
		`),
		`${clientName || "Your client"} signed the agreement: ${agreementTitle}\n\nReview & countersign: ${editorUrl}`,
	);
}

export async function sendAgreementCountersignedEmail(to: string, agreementTitle: string, viewUrl: string, pdfBuffer?: ArrayBuffer | null): Promise<boolean> {
	const attachments = pdfBuffer ? [{
		Name: `${agreementTitle.replace(/[^a-zA-Z0-9 ]/g, "").replace(/\s+/g, "_")}.pdf`,
		Content: Buffer.from(pdfBuffer).toString("base64"),
		ContentType: "application/pdf",
	}] : undefined;

	return send(to,
		`Agreement fully executed: ${agreementTitle}`,
		wrap(`
			<div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:16px;margin-bottom:20px">
				<p style="font-size:14px;color:#15803d;font-weight:600;margin:0">Agreement Fully Executed</p>
			</div>
			<p style="font-size:14px;color:#1a1a1a;margin-bottom:8px">Both parties have signed the agreement:</p>
			<p style="font-size:18px;font-weight:600;color:#1a1a1a;margin-bottom:20px">${escHtml(agreementTitle)}</p>
			<p style="margin-bottom:24px">${btn(viewUrl, "View & Download PDF")}</p>
			<p style="font-size:13px;color:#6b6560">Your fully executed agreement is ready. Click above to view it and download a PDF copy for your records.</p>
		`),
		`Both parties have signed: ${agreementTitle}\n\nView and download your PDF: ${viewUrl}`,
		attachments,
	);
}

export async function sendVerificationCode(to: string, code: string, agreementTitle: string): Promise<boolean> {
	return send(to,
		`Your verification code — ${escHtml(agreementTitle)}`,
		wrap(`
			<p style="font-size:14px;color:#1a1a1a;margin-bottom:8px">You're signing an agreement with Upland Exhibits:</p>
			<p style="font-size:16px;font-weight:600;color:#1a1a1a;margin-bottom:20px">${escHtml(agreementTitle)}</p>
			<p style="font-size:14px;color:#1a1a1a;margin-bottom:8px">Your verification code is:</p>
			<div style="background:#f8f7f5;border:2px solid #e2dfd9;border-radius:8px;padding:16px;text-align:center;margin-bottom:20px">
				<span style="font-size:32px;font-weight:700;letter-spacing:6px;color:#1a1a1a">${code}</span>
			</div>
			<p style="font-size:13px;color:#6b6560">This code expires in 1 hour. If you did not request this, ignore this email.</p>
		`),
		`Your verification code for signing "${agreementTitle}" is: ${code}\n\nThis code expires in 1 hour.`,
	);
}
