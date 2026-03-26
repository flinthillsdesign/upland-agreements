import { api, requireAuth, getUser } from "./api.js";
import { esc, setupLogout } from "./utils.js";

requireAuth();
setupLogout();

const user = getUser();

// Load settings
async function loadSettings() {
	try {
		const settings = (await api.getSettings()) as Record<string, unknown>;
		if (settings.legal_name) (document.getElementById("legalName") as HTMLInputElement).value = settings.legal_name as string;
		if (settings.company_address) (document.getElementById("companyAddress") as HTMLInputElement).value = settings.company_address as string;
		if (settings.designer_name) (document.getElementById("designerName") as HTMLInputElement).value = settings.designer_name as string;
		if (settings.designer_title) (document.getElementById("designerTitle") as HTMLInputElement).value = settings.designer_title as string;
		if (settings.designer_email) (document.getElementById("designerEmail") as HTMLInputElement).value = settings.designer_email as string;
		if (settings.mou_rate) (document.getElementById("mouRate") as HTMLInputElement).value = String(settings.mou_rate);
		if (settings.head_rate) (document.getElementById("headRate") as HTMLInputElement).value = String(settings.head_rate);
		if (settings.design_rate) (document.getElementById("designRate") as HTMLInputElement).value = String(settings.design_rate);
		if (settings.fab_rate) (document.getElementById("fabRate") as HTMLInputElement).value = String(settings.fab_rate);
		if (settings.materials_markup) (document.getElementById("materialsMarkup") as HTMLInputElement).value = String(settings.materials_markup);
		if (settings.travel_rate) (document.getElementById("travelRate") as HTMLInputElement).value = String(settings.travel_rate);
	} catch (err) {
		// 403 expected for non-admins; log others
		console.error("Failed to load settings:", err);
	}
}

// Company form
document.getElementById("companyForm")!.addEventListener("submit", async (e) => {
	e.preventDefault();
	await api.updateSettings({
		legal_name: (document.getElementById("legalName") as HTMLInputElement).value,
		company_address: (document.getElementById("companyAddress") as HTMLInputElement).value,
		designer_name: (document.getElementById("designerName") as HTMLInputElement).value,
		designer_title: (document.getElementById("designerTitle") as HTMLInputElement).value,
		designer_email: (document.getElementById("designerEmail") as HTMLInputElement).value,
	});
	alert("Company info saved.");
});

// Rates form
document.getElementById("ratesForm")!.addEventListener("submit", async (e) => {
	e.preventDefault();
	const rates = {
		mou_rate: parseFloat((document.getElementById("mouRate") as HTMLInputElement).value),
		head_rate: parseFloat((document.getElementById("headRate") as HTMLInputElement).value),
		design_rate: parseFloat((document.getElementById("designRate") as HTMLInputElement).value),
		fab_rate: parseFloat((document.getElementById("fabRate") as HTMLInputElement).value),
		materials_markup: parseFloat((document.getElementById("materialsMarkup") as HTMLInputElement).value),
		travel_rate: parseFloat((document.getElementById("travelRate") as HTMLInputElement).value),
	};
	await api.updateSettings(rates);

	// Also sync to knowledge base so the AI always has current rates
	const rateSheetContent = [
		`Current Upland Exhibits Service Rates (updated ${new Date().toLocaleDateString()})`,
		"",
		`MoU Hourly Rate (concept work): $${rates.mou_rate}/hr`,
		`Head of Design & Head of Fabrication: $${rates.head_rate}/hr`,
		`Design Staff: $${rates.design_rate}/hr`,
		`Fabrication Staff: $${rates.fab_rate}/hr`,
		`Materials Markup: ${rates.materials_markup}%`,
		`Travel Time: $${rates.travel_rate}/hr`,
		"Travel Mileage & Per Diem: Current IRS or GSA rates",
	].join("\n");

	// Try to update existing rate sheet, or create one
	try {
		const entries = (await api.listKnowledge()) as { id: string; type: string }[];
		const existing = entries.find((e) => e.type === "rate_sheet");
		if (existing) {
			await api.updateKnowledge(existing.id, { content: rateSheetContent, title: "Current Service Rates" });
		} else {
			await api.createKnowledge({ type: "rate_sheet", title: "Current Service Rates", content: rateSheetContent });
		}
	} catch {
		// Non-critical — rates are saved to settings regardless
	}

	alert("Rates saved.");
});

// Users section (read-only — managed via ODIN)
const usersSection = document.getElementById("usersSection")!;
if (user?.role !== "superadmin") {
	usersSection.style.display = "none";
} else {
	loadUsers();
}

async function loadUsers() {
	try {
		const users = (await api.listUsers()) as { id: string; email: string; name: string; role: string }[];
		const container = document.getElementById("usersList")!;
		container.innerHTML = users
			.map(
				(u) => `
			<div class="user-row">
				<div class="user-info">
					<strong>${esc(u.name)}</strong>
					<span>${esc(u.email)} &middot; ${u.role}</span>
				</div>
			</div>
		`
			)
			.join("");
	} catch {
		// Non-admin or no access
	}
}

loadSettings();
