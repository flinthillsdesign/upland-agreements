import { clearAuth } from "./api.js";

// === HTML escaping ===

export function esc(val: string | null | undefined): string {
	if (!val) return "";
	return val.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export function escHtml(text: string): string {
	return esc(text).replace(/\n/g, "<br>");
}

// === Agreement types & statuses ===

export type AgreementType = "mou_concept" | "mou_small" | "full_services";
export type AgreementStatus = "draft" | "sent" | "viewed" | "signed" | "countersigned" | "declined" | "expired";

export const TYPE_LABELS: Record<AgreementType, string> = {
	mou_concept: "MoU — Concept",
	mou_small: "MoU — Small Design",
	full_services: "Agreement for Services",
};

export const STATUS_LABELS: Record<AgreementStatus, string> = {
	draft: "Draft",
	sent: "Sent",
	viewed: "Viewed",
	signed: "Signed",
	countersigned: "Countersigned",
	declined: "Declined",
	expired: "Expired",
};

// === Formatting ===

export function formatCurrency(amount: number | null | undefined): string {
	if (amount === null || amount === undefined) return "";
	return "$" + amount.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

export function formatDate(dateStr: string | null | undefined, style: "short" | "long" = "short"): string {
	if (!dateStr) return style === "long" ? "_______________" : "";
	return new Date(dateStr).toLocaleDateString("en-US", {
		month: style === "long" ? "long" : "short",
		day: "numeric",
		year: "numeric",
	});
}

export function isMouType(type: string): boolean {
	return type === "mou_concept" || type === "mou_small";
}

// === Shared UI ===

export function setupLogout() {
	document.getElementById("logoutBtn")?.addEventListener("click", () => {
		clearAuth();
		window.location.href = "/";
	});
}

// === AI Thinking Animation ===

const AI_THINKING_MESSAGES = [
	// Legal process
	"Reviewing the precedents...",
	"Consulting the Kansas Statutes...",
	"Checking the force majeure clause for typos...",
	"Confirming the party of the first part...",
	"Heretofore, hitherto, and notwithstanding...",
	"Adding whereases and therefores...",
	"Dotting the i's and crossing the t's...",
	"Ensuring severability of all provisions...",
	"Per the terms and conditions herein...",
	"Whereas the party of the second part...",
	"Drafting indemnification language with feeling...",
	"Making liability limitations sound friendly...",
	"Nervously double-checking the governing law...",
	"The boilerplate writes itself. Just kidding...",

	// Contract humor
	"This agreement shall be binding upon...",
	"IN WITNESS WHEREOF, the AI has drafted...",
	"Subject to the terms below (way below)...",
	"Adding a clause about adding clauses...",
	"Defining 'reasonable' reasonably...",
	"Making NET30 sound generous...",
	"Calculating not-to-exceed with great precision...",
	"Time is of the essence (especially right now)...",
	"No waiver of contractual right to make jokes...",
	"This scope of work shall include scope of work...",
	"Wordsmithing the deliverables section...",
	"Ensuring mutual indemnification is actually mutual...",

	// Exhibit-specific
	"Pricing exhibit hours like a seasoned pro...",
	"Estimating fabrication costs with optimism...",
	"Remembering that travel time is billable...",
	"Imagining the ribbon cutting ceremony...",
	"Factoring in the interactive displays...",
	"Accounting for that one tricky casework piece...",
	"Adding a line item for museum-grade dust...",
	"Concept PDFs don't write themselves. Well...",

	// Process & confidence
	"Almost there, just making it airtight...",
	"Drafting with extreme professionalism...",
	"This is going to be a beautiful agreement...",
	"Channeling the spirit of contract law...",
	"One moment, perfecting the payment schedule...",
	"Hold on, I'm in the zone...",
	"Making this look like a real lawyer wrote it...",
	"Trust the process (and the 18% interest clause)...",
	"You're going to love this scope of work...",
	"Wait till you see these client responsibilities...",
	"Applying Kansas law with great enthusiasm...",
	"Drafting something Joel would be proud of...",
];

let _thinkingInterval: number | null = null;

export function startThinkingAnimation(el: HTMLElement) {
	stopThinkingAnimation();
	const used = new Set<number>();
	el.innerHTML = `<div class="chat-thinking"><span class="chat-thinking-text">Thinking...</span></div>`;
	_thinkingInterval = window.setInterval(() => {
		if (!el.isConnected) { stopThinkingAnimation(); return; }
		if (used.size >= AI_THINKING_MESSAGES.length) used.clear();
		let idx: number;
		do { idx = Math.floor(Math.random() * AI_THINKING_MESSAGES.length); } while (used.has(idx));
		used.add(idx);
		const textEl = el.querySelector(".chat-thinking-text");
		if (textEl) textEl.textContent = AI_THINKING_MESSAGES[idx];
	}, 2200);
}

export function stopThinkingAnimation() {
	if (_thinkingInterval) {
		clearInterval(_thinkingInterval);
		_thinkingInterval = null;
	}
}
