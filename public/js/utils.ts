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
