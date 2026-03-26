import { api, requireAuth, clearAuth, getUser } from "./api.js";

requireAuth();

interface Agreement {
	id: string;
	type: string;
	title: string;
	status: string;
	client_name: string | null;
	total_cost: number | null;
	updated_at: string;
}

const TYPE_LABELS: Record<string, string> = {
	mou_concept: "MoU — Concept",
	mou_small: "MoU — Small Design",
	full_services: "Agreement for Services",
};

const STATUS_LABELS: Record<string, string> = {
	draft: "Draft",
	sent: "Sent",
	viewed: "Viewed",
	signed: "Signed",
	countersigned: "Countersigned",
	declined: "Declined",
	expired: "Expired",
};

let currentType = "";
let currentStatus = "";

// Settings link visibility
const user = getUser();
const settingsLink = document.getElementById("settingsLink");
if (settingsLink && user?.role !== "superadmin") {
	settingsLink.style.display = "none";
}

// Logout
document.getElementById("logoutBtn")!.addEventListener("click", () => {
	clearAuth();
	window.location.href = "/";
});

// Filters
function setupTabs(containerId: string, paramKey: "type" | "status") {
	const container = document.getElementById(containerId)!;
	container.addEventListener("click", (e) => {
		const btn = (e.target as HTMLElement).closest(".tab") as HTMLElement;
		if (!btn) return;
		container.querySelectorAll(".tab").forEach((t) => t.classList.remove("active"));
		btn.classList.add("active");
		if (paramKey === "type") currentType = btn.dataset.type || "";
		else currentStatus = btn.dataset.status || "";
		loadAgreements();
	});
}

setupTabs("typeTabs", "type");
setupTabs("statusTabs", "status");

// Search
let searchTimeout: ReturnType<typeof setTimeout>;
document.getElementById("searchInput")!.addEventListener("input", () => {
	clearTimeout(searchTimeout);
	searchTimeout = setTimeout(loadAgreements, 300);
});

// Load agreements
async function loadAgreements() {
	const search = (document.getElementById("searchInput") as HTMLInputElement).value;
	const params: Record<string, string> = {};
	if (currentType) params.type = currentType;
	if (currentStatus) params.status = currentStatus;
	if (search) params.search = search;

	const agreements = (await api.listAgreements(params)) as Agreement[];
	renderAgreements(agreements);
}

function formatCurrency(amount: number | null): string {
	if (amount === null || amount === undefined) return "";
	return "$" + amount.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function formatDate(dateStr: string): string {
	return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function renderAgreements(agreements: Agreement[]) {
	const container = document.getElementById("agreementsList")!;

	if (agreements.length === 0) {
		container.innerHTML = '<div class="empty-state">No agreements found. Create one to get started.</div>';
		return;
	}

	container.innerHTML = agreements
		.map(
			(a) => `
		<div class="agreement-card" data-id="${a.id}">
			<div class="agreement-card-left">
				<div class="agreement-card-title">${a.title}</div>
				<div class="agreement-card-meta">
					${a.client_name || "No client"} &middot; ${TYPE_LABELS[a.type] || a.type} &middot; ${formatDate(a.updated_at)}
				</div>
			</div>
			<div class="agreement-card-right">
				<span class="agreement-card-total">${formatCurrency(a.total_cost)}</span>
				<span class="status-badge status-${a.status}">${STATUS_LABELS[a.status] || a.status}</span>
			</div>
		</div>
	`
		)
		.join("");

	container.querySelectorAll(".agreement-card").forEach((card) => {
		card.addEventListener("click", () => {
			const id = (card as HTMLElement).dataset.id;
			window.location.href = `/editor.html?id=${id}`;
		});
	});
}

// Create modal
const createModal = document.getElementById("createModal")!;
document.getElementById("createBtn")!.addEventListener("click", () => { createModal.hidden = false; });
document.getElementById("closeModal")!.addEventListener("click", () => { createModal.hidden = true; });
document.getElementById("cancelCreate")!.addEventListener("click", () => { createModal.hidden = true; });
createModal.querySelector(".modal-backdrop")!.addEventListener("click", () => { createModal.hidden = true; });

document.getElementById("createForm")!.addEventListener("submit", async (e) => {
	e.preventDefault();
	const type = (document.getElementById("createType") as HTMLSelectElement).value;
	const title = (document.getElementById("createTitle") as HTMLInputElement).value;
	const client_name = (document.getElementById("createClient") as HTMLInputElement).value || undefined;

	const agreement = (await api.createAgreement({ type, title, client_name })) as { id: string };
	window.location.href = `/editor.html?id=${agreement.id}`;
});

// Initial load
loadAgreements();
