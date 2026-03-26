import Anthropic from "@anthropic-ai/sdk";
import type { Agreement, KnowledgeEntry, ChatMessage } from "./storage.js";

const MODEL = "claude-sonnet-4-20250514";

let anthropic: Anthropic | null = null;
function getClient(): Anthropic | null {
	if (!process.env.CLAUDE_API_KEY) return null;
	if (!anthropic) {
		anthropic = new Anthropic({ apiKey: process.env.CLAUDE_API_KEY });
	}
	return anthropic;
}

const SYSTEM_PROMPT = `You are an agreement drafting assistant for Upland Exhibits (Flint Hills Design, LLC dba Upland Exhibits), located at 507 SE 36th St., Newton, Kansas 67114. You help draft professional contracts and memoranda of understanding for exhibit design, fabrication, and installation projects.

## About Upland Exhibits
Upland Exhibits provides: exhibit concept design, exhibit design, panel design & fabrication, interactive display design, installation, and project management. They work with museums, heritage centers, visitor centers, libraries, and similar cultural institutions.

## Agreement Types

### 1. MoU — Concept (mou_concept)
For design concept exploration. Upland spends a set number of hours developing a concept, delivers a PDF proposal. Lightweight agreement — scope, timeframe, cost, plus standard IP/title terms.
Typical: "200 hours designing a concept for a 2,800 sq ft exhibit on Swedish heritage" or "48 hours designing a helicopter interactive concept."
The deliverable is always a concept PDF covering some combination of: exhibit content/themes, loose thematic floorplan, early sketches or renderings, interactive display options, casework/display hardware examples, graphic design samples, project implementation schedule & budget.

### 2. MoU — Small Design (mou_small)
Same as Concept MoU but for small standalone design projects (not concept exploration). Includes a Final Approval clause.

### 3. Agreement for Services (full_services)
Full contract for design, fabrication, and installation. Includes detailed payment structure (initial ~10%, progress billings to 90%, final ~10%), service rates, client responsibilities, warranties, confidentiality, indemnification, limitation of liability, and full legal terms. These are the big ones — six-figure projects with multi-year timelines.

## Your Role
When the user describes a project, draft the VARIABLE sections. Do NOT draft boilerplate legal terms — those are standardized.

For MoUs, draft:
- project_description: Scope of work / deliverable description
- deliverable: What the concept PDF will cover
- hours: Suggested hours based on project complexity
- hourly_rate: Current rate (check knowledge base or settings, typically $85-95/hr)
- total_cost: hours × rate
- timeframe: Delivery target (e.g., "Goal is to deliver PDF within 8 weeks after MoU is signed and returned")

For Agreements for Services, draft:
- project_description: Description of services paragraph
- total_cost: NTE (not-to-exceed) amount
- payment_structure: JSON with {initial_pct, initial_amount, progress_note, final_pct, final_amount}
- service_rates: JSON with current rates {head_rate, design_rate, fab_rate, materials_markup, travel_rate}
- client_responsibilities: Markdown list of what the client must provide
- timeframe: Contract term description
- effective_date: Suggested effective date
- end_date: Suggested end date

## Output Format
Respond with a JSON object containing the fields to update. Wrap it in a \`\`\`json code block.
Include a "message" field with a brief explanation of your choices.
Include a "references" array listing any knowledge base entries you referenced.

Example:
\`\`\`json
{
  "message": "I've drafted the scope based on similar heritage center concepts. The 160 hours accounts for...",
  "references": ["Past Agreement: Heritage Center Concept 2024"],
  "fields": {
    "project_description": "Upland Exhibits will dedicate 160 hours to developing...",
    "deliverable": "The concept PDF will include...",
    "hours": 160,
    "hourly_rate": 85,
    "total_cost": 13600,
    "timeframe": "Goal is to deliver PDF within 10 weeks after MoU is signed and returned"
  }
}
\`\`\`

## Guidelines
- Use professional, specific language matching Upland's existing agreements
- Be precise about deliverables — don't be vague
- Reference similar past projects from the knowledge base when available
- For pricing, base suggestions on comparable past work and current rates
- Client responsibilities should be specific to the project type
- Payment schedules: ~10% initial, progress billings to 90% of NTE, ~10% final
- Kansas law governs all agreements
- Always explain your reasoning in the message field`;

function buildKnowledgeContext(entries: KnowledgeEntry[]): string {
	if (entries.length === 0) return "";

	let context = "\n\n## Knowledge Base\n";
	let charCount = 0;
	const maxChars = 60000;

	// Rate sheets first
	const rateSheets = entries.filter((e) => e.type === "rate_sheet");
	const others = entries.filter((e) => e.type !== "rate_sheet");

	for (const entry of [...rateSheets, ...others]) {
		const block = `\n### ${entry.title} (${entry.type})\n${entry.content}\n`;
		if (charCount + block.length > maxChars) break;
		context += block;
		charCount += block.length;
	}

	return context;
}

function buildAgreementContext(agreement: Agreement): string {
	const typeLabels: Record<string, string> = {
		mou_concept: "MoU — Concept",
		mou_small: "MoU — Small Design",
		full_services: "Agreement for Services",
	};

	let ctx = `\n\n## Current Agreement\n- Type: ${typeLabels[agreement.type] || agreement.type}\n- Title: ${agreement.title}\n- Status: ${agreement.status}`;
	if (agreement.client_name) ctx += `\n- Client: ${agreement.client_name}`;
	if (agreement.client_address) ctx += `\n- Address: ${agreement.client_address}`;
	if (agreement.project_description) ctx += `\n- Current Scope: ${agreement.project_description}`;
	if (agreement.total_cost) ctx += `\n- Current Cost: $${agreement.total_cost.toLocaleString()}`;
	if (agreement.hours) ctx += `\n- Hours: ${agreement.hours}`;
	if (agreement.hourly_rate) ctx += `\n- Rate: $${agreement.hourly_rate}/hr`;
	if (agreement.timeframe) ctx += `\n- Timeframe: ${agreement.timeframe}`;
	if (agreement.payment_structure) ctx += `\n- Payment Structure: ${agreement.payment_structure}`;
	if (agreement.service_rates) ctx += `\n- Service Rates: ${agreement.service_rates}`;
	if (agreement.client_responsibilities) ctx += `\n- Client Responsibilities: ${agreement.client_responsibilities}`;
	return ctx;
}

export interface AiResponse {
	message: string;
	fields?: Partial<Agreement>;
	references?: string[];
}

function parseResponse(text: string): AiResponse {
	// Extract JSON from code block
	const jsonMatch = text.match(/```json\s*([\s\S]*?)```/);
	if (jsonMatch) {
		try {
			const parsed = JSON.parse(jsonMatch[1]);
			return {
				message: parsed.message || "Updated agreement fields.",
				fields: parsed.fields || undefined,
				references: parsed.references || [],
			};
		} catch {
			// Fall through
		}
	}

	// Try parsing the whole response as JSON
	try {
		const parsed = JSON.parse(text);
		return {
			message: parsed.message || "Updated agreement fields.",
			fields: parsed.fields || undefined,
			references: parsed.references || [],
		};
	} catch {
		// Plain text response
		return { message: text };
	}
}

export async function generateAgreement(
	prompt: string,
	agreement: Agreement,
	knowledge: KnowledgeEntry[],
): Promise<AiResponse> {
	const client = getClient();
	if (!client) {
		return mockGenerate(prompt, agreement);
	}

	const systemPrompt = SYSTEM_PROMPT + buildKnowledgeContext(knowledge) + buildAgreementContext(agreement);

	const response = await client.messages.create({
		model: MODEL,
		max_tokens: 4096,
		system: systemPrompt,
		messages: [{ role: "user", content: prompt }],
	});

	const text = response.content.map((b) => (b.type === "text" ? b.text : "")).join("");
	return parseResponse(text);
}

export async function chat(
	messages: ChatMessage[],
	agreement: Agreement,
	knowledge: KnowledgeEntry[],
): Promise<AiResponse> {
	const client = getClient();
	if (!client) {
		return { message: "AI is not configured. Set CLAUDE_API_KEY in your environment." };
	}

	const systemPrompt = SYSTEM_PROMPT + buildKnowledgeContext(knowledge) + buildAgreementContext(agreement);

	const apiMessages = messages.map((m) => ({
		role: m.role as "user" | "assistant",
		content: m.content,
	}));

	const response = await client.messages.create({
		model: MODEL,
		max_tokens: 4096,
		system: systemPrompt,
		messages: apiMessages,
	});

	const text = response.content.map((b) => (b.type === "text" ? b.text : "")).join("");
	return parseResponse(text);
}

function mockGenerate(prompt: string, agreement: Agreement): AiResponse {
	if (agreement.type === "full_services") {
		return {
			message: "AI is not configured. Here's a template structure for an Agreement for Services. Set CLAUDE_API_KEY to enable AI drafting.",
			fields: {
				project_description: `Upland Exhibits will provide exhibit design, fabrication, and installation services for ${agreement.client_name || "the Client"}'s project as described: ${prompt}`,
				total_cost: 150000,
				payment_structure: JSON.stringify({
					initial_pct: 10,
					initial_amount: 15000,
					progress_note: "Progress billings invoiced on percentage of completion, not to exceed 90% of NTE",
					final_pct: 10,
					final_amount: 15000,
				}),
				service_rates: JSON.stringify({
					head_rate: 95,
					design_rate: 75,
					fab_rate: 65,
					materials_markup: 15,
					travel_rate: 55,
				}),
				client_responsibilities: "- Coordinate internal decision-making and provide timely approvals\n- Provide all text content, photographs, and artifacts\n- Provide architectural drawings and site plans\n- Arrange for electrical and structural work\n- Prepare installation site\n- Provide final proofreading and approval",
			},
			references: [],
		};
	}

	return {
		message: "AI is not configured. Here's a template structure for an MoU. Set CLAUDE_API_KEY to enable AI drafting.",
		fields: {
			project_description: `Upland Exhibits will dedicate hours to developing a design concept for ${agreement.client_name || "the Client"}'s project: ${prompt}`,
			deliverable: "The concept PDF will include: exhibit content themes and narrative approach, loose thematic floorplan, early sketches and renderings, interactive display options, casework and display hardware examples, graphic design samples, and a project implementation schedule and budget.",
			hours: 120,
			hourly_rate: 85,
			total_cost: 10200,
			timeframe: "Goal is to deliver PDF within 8 weeks after MoU is signed and returned",
		},
		references: [],
	};
}
