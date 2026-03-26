import { api, requireAuth } from "./api.js";
import { esc, setupLogout } from "./utils.js";

requireAuth();
setupLogout();

interface KnowledgeEntry {
	id: string;
	type: string;
	title: string;
	content: string;
	metadata: string | null;
	created_at: string;
	updated_at: string;
}

const TYPE_LABELS: Record<string, string> = {
	past_agreement: "Past Agreement",
	rate_sheet: "Rate Sheet",
	scope_template: "Scope Template",
	responsibilities_template: "Responsibilities",
	notes: "Notes",
};

let entries: KnowledgeEntry[] = [];
let currentFilter = "";
let editingId: string | null = null;

// Logout handled by setupLogout()

// Type filters
document.getElementById("typeFilters")!.addEventListener("click", (e) => {
	const btn = (e.target as HTMLElement).closest(".tab") as HTMLElement;
	if (!btn) return;
	document.querySelectorAll("#typeFilters .tab").forEach((t) => t.classList.remove("active"));
	btn.classList.add("active");
	currentFilter = btn.dataset.type || "";
	render();
});

async function loadEntries() {
	entries = (await api.listKnowledge()) as KnowledgeEntry[];
	render();
}

function render() {
	const filtered = currentFilter ? entries.filter((e) => e.type === currentFilter) : entries;
	const container = document.getElementById("knowledgeList")!;

	if (filtered.length === 0) {
		container.innerHTML = '<div class="empty-state">No knowledge base entries. Add past agreements, rate sheets, and templates.</div>';
		return;
	}

	container.innerHTML = filtered
		.map(
			(e) => `
		<div class="knowledge-card" data-id="${e.id}">
			<div class="knowledge-card-header">
				<span class="knowledge-card-title">${esc(e.title)}</span>
				<span class="knowledge-card-type">${TYPE_LABELS[e.type] || e.type}</span>
			</div>
			<div class="knowledge-card-preview">${esc(e.content.slice(0, 120))}</div>
			<div class="knowledge-card-meta">Updated ${new Date(e.updated_at).toLocaleDateString()}</div>
		</div>
	`
		)
		.join("");

	container.querySelectorAll(".knowledge-card").forEach((card) => {
		card.addEventListener("click", () => openEditor((card as HTMLElement).dataset.id!));
	});
}

// Editor modal
const modal = document.getElementById("editorModal")!;

document.getElementById("addBtn")!.addEventListener("click", () => openEditor(null));
document.getElementById("closeEditor")!.addEventListener("click", () => { modal.hidden = true; });
document.getElementById("cancelEntry")!.addEventListener("click", () => { modal.hidden = true; });
modal.querySelector(".modal-backdrop")!.addEventListener("click", () => { modal.hidden = true; });

function openEditor(id: string | null) {
	editingId = id;
	const entry = id ? entries.find((e) => e.id === id) : null;

	document.getElementById("editorTitle")!.textContent = entry ? "Edit Entry" : "Add Entry";
	(document.getElementById("entryTitle") as HTMLInputElement).value = entry?.title || "";
	(document.getElementById("entryType") as HTMLSelectElement).value = entry?.type || "past_agreement";
	(document.getElementById("entryContent") as HTMLTextAreaElement).value = entry?.content || "";
	(document.getElementById("entryMetadata") as HTMLTextAreaElement).value = entry?.metadata || "";

	const deleteBtn = document.getElementById("deleteEntry")!;
	deleteBtn.hidden = !entry;

	modal.hidden = false;
}

document.getElementById("editorForm")!.addEventListener("submit", async (e) => {
	e.preventDefault();
	const data = {
		title: (document.getElementById("entryTitle") as HTMLInputElement).value,
		type: (document.getElementById("entryType") as HTMLSelectElement).value,
		content: (document.getElementById("entryContent") as HTMLTextAreaElement).value,
		metadata: (document.getElementById("entryMetadata") as HTMLTextAreaElement).value || undefined,
	};

	if (editingId) {
		await api.updateKnowledge(editingId, data);
	} else {
		await api.createKnowledge(data);
	}

	modal.hidden = true;
	loadEntries();
});

document.getElementById("deleteEntry")!.addEventListener("click", async () => {
	if (!editingId || !confirm("Delete this entry?")) return;
	await api.deleteKnowledge(editingId);
	modal.hidden = true;
	loadEntries();
});

loadEntries();
