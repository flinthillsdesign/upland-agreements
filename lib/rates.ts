// The rate card. One source: the Settings row (Settings page). Everything
// that shows, prints or drafts a rate asks here — the new-agreement
// defaults, the editor, the printed contract, the AI drafting prompt — so
// they cannot disagree. (They did: the print fallback said $95 / $75 / $65
// and 15% while the editor said $125 / $100 / $75 and 20%.)
//
// Pure functions, no DOM or DB — imported by the server and the browser.

export interface ServiceRates {
	head_rate: number;
	design_rate: number;
	fab_rate: number;
	materials_markup: number;
	travel_rate: number;
}

export interface RateSettings {
	mou_rate?: unknown;
	head_rate?: unknown;
	design_rate?: unknown;
	fab_rate?: unknown;
	materials_markup?: unknown;
	travel_rate?: unknown;
}

// What a fresh install uses until Settings is saved once. The only typed
// rates in the app; production reads the Settings row.
const STARTING_RATES: ServiceRates = { head_rate: 125, design_rate: 100, fab_rate: 75, materials_markup: 20, travel_rate: 55 };
const STARTING_MOU_RATE = 100;

// Settings: blank or 0 means "not set". On an agreement, a stored 0 is a
// real 0 (materials at cost) and prints as 0.
function num(value: unknown, fallback: number, zeroIsSet = false): number {
	if (value === null || value === undefined || value === "") return fallback;
	const n = typeof value === "number" ? value : parseFloat(String(value));
	if (!Number.isFinite(n) || n < 0) return fallback;
	return n > 0 || zeroIsSet ? n : fallback;
}

// Today's rate card, from Settings.
export function currentRates(settings: RateSettings | null | undefined): ServiceRates {
	const s = settings || {};
	return {
		head_rate: num(s.head_rate, STARTING_RATES.head_rate),
		design_rate: num(s.design_rate, STARTING_RATES.design_rate),
		fab_rate: num(s.fab_rate, STARTING_RATES.fab_rate),
		materials_markup: num(s.materials_markup, STARTING_RATES.materials_markup),
		travel_rate: num(s.travel_rate, STARTING_RATES.travel_rate),
	};
}

// The hourly rate a new MoU starts with.
export function mouRate(settings: RateSettings | null | undefined): number {
	return num(settings?.mou_rate, STARTING_MOU_RATE);
}

// An agreement's own rates: the ones stored on it when it was made, else
// today's card. A field missing from the stored set takes today's value.
export function ratesFor(agreement: { service_rates?: string | ServiceRates | null }, settings: RateSettings | null | undefined): ServiceRates {
	const current = currentRates(settings);
	let stored: Partial<ServiceRates> = {};
	try {
		const raw = agreement.service_rates;
		if (raw) stored = typeof raw === "string" ? JSON.parse(raw) : raw;
	} catch {
		// unreadable stored rates: today's card
	}
	return {
		head_rate: num(stored.head_rate, current.head_rate, true),
		design_rate: num(stored.design_rate, current.design_rate, true),
		fab_rate: num(stored.fab_rate, current.fab_rate, true),
		materials_markup: num(stored.materials_markup, current.materials_markup, true),
		travel_rate: num(stored.travel_rate, current.travel_rate, true),
	};
}
