# Agreements — App Specification

## Identity

| | |
|---|---|
| **App name** | Agreements |
| **Domain** | agreements.uplandexhibits.com |
| **Port** | 3005 (local dev) |
| **Repo** | `flinthillsdesign/upland-agreements` |
| **Stack** | TypeScript, Netlify Functions, Turso |

Follows the satellite app conventions: vanilla TypeScript, esbuild, oxlint/oxfmt, single Netlify function with hand-rolled router, dual Turso databases, shared JWT auth.

Uses ODIN's refined dual-database pattern with separate `auth-storage.ts` and `storage.ts` modules. Use the Quotes app (`flinthillsdesign/upland-quotes`) as the closest starting point — it has the most similar workflow (AI-assisted document generation, client-facing shareable views, print-ready output).

---

## What It Does

Agreements is a contract generation and digital signing tool for Upland Exhibits. You pick an agreement type, describe the project, and the AI drafts the variable sections — scope of work, cost, timeframe, payment structure. You review, edit, then send a link for the client to review and sign digitally. PDF generation produces clean, professional documents for archiving and sharing.

### The Three Agreement Types

**1. MoU — Concept**
For design concept exploration. Upland spends a set number of hours developing a concept for an exhibit, delivers a PDF proposal the client can use for fundraising or internal decision-making. Lightweight agreement — scope, timeframe, cost, plus standard IP/title terms.

Typical projects: "200 hours designing a concept for a 2,800 sq ft exhibit on Swedish heritage" or "48 hours designing a helicopter interactive concept." The deliverable is always a concept PDF.

**2. MoU — Small Design**
For small standalone design projects. Same lightweight structure as the Concept MoU, with an additional Final Approval clause. Used when the scope is a discrete design task rather than a concept exploration.

**3. Agreement for Services**
The full contract. Used for design, fabrication, and installation projects. Includes detailed payment structure (initial payment, progress billings, final payment), service rates, client responsibilities, warranties, confidentiality, indemnification, limitation of liability, and the full suite of legal terms. These are the big ones — six-figure projects with multi-year timelines.

### Core Workflow

1. **Select Type** — Pick MoU (Concept), MoU (Small Design), or Agreement for Services
2. **Describe** — Enter client info and describe the project in plain English
3. **Generate** — AI drafts the variable sections (scope, cost, timeframe, payment structure)
4. **Review & Edit** — Every field is editable. The legal boilerplate is standard but can be customized.
5. **Send** — Share a link for client review and digital signature
6. **Sign** — Client reviews and signs digitally. Joel countersigns.
7. **Archive** — Generate PDF for records

### Core Capabilities

1. **AI Section Drafting** — Describe a project and the AI produces the variable content: scope of work, deliverable description, cost calculation, timeframe, payment schedule. It draws from a knowledge base of past agreements to match typical scopes, pricing, and language.

2. **Three Template Types** — Each type has its own structure, required sections, and boilerplate terms. The system enforces the right structure for each type while keeping variable sections editable.

3. **Digital Signatures** — Clients sign via a shareable link. Signature capture records: typed name, timestamp, IP address. Counter-signature by the Upland signer (typically Joel). Both signatures appear on the final document.

4. **PDF Generation** — Professional `@media print` stylesheet that produces clean documents matching the current Word template aesthetic. Browser "Save as PDF" or Cmd+P. The web page IS the document.

5. **Shareable Client Links** — Word-based tokens (like `cedar-river-42`) give clients a view of the agreement where they can review and sign. No login required.

6. **Status Tracking** — Draft, Sent, Viewed, Signed (client), Countersigned (both parties), Declined, Expired. Status updates automatically as client interacts.

7. **Auto-Calculations** — Hours x rate = cost for MoUs. Payment schedule percentages for full agreements. Service rate tables.

---

## Agreement Structures

### MoU — Concept

The variable (AI-drafted) sections:
- **Client** — Organization name and address
- **Project** — Project name
- **Scope of Work / Deliverable** — What Upland will do, hours allocated, what the deliverable PDF will cover (content themes, floorplans, renderings, interactives, casework examples, graphic design samples, schedule & budget, etc.)
- **Timeframe** — Delivery target after signing (e.g., "8 weeks after MoU is signed")
- **Cost** — Hours x hourly rate = total

The fixed boilerplate:
- **Title and Assignment** — IP ownership terms (Client Content stays with client, Final Art transfers to client on payment, Preliminary Works stay with Designer, Third Party Materials licensing, Designer retains IP on systems/hardware/software)
- **Accreditation/Promotions** — Both parties may use project in promotional materials

Signature block: Client signature + date, Joel Gaeddert CEO signature + date.

### MoU — Small Design

Same as Concept MoU, plus:
- **Final Approval** — Client provides final proofreading and approval; errors approved by client are at client's cost

### Agreement for Services

The variable (AI-drafted) sections:
- **Effective Date**
- **Client** — Full legal name and address
- **Term** — Start date through end date (or project completion, whichever is earlier)
- **Description of Services** — What Upland will do (one clear paragraph)
- **Project Cost** — Time-and-material-not-to-exceed basis, NTE amount
- **Initial Payment** — Amount (typically ~10% of NTE), due within 30 days of signing
- **Progress Billings** — Invoiced on percentage of completion, not to exceed 90% of NTE
- **Final Payment** — Remaining ~10%, invoiced upon substantial completion
- **Service Rates** — Labor rates by role (Head of Design/Fab, Design staff, Fab staff), materials markup, travel time rate, mileage/per diem rates
- **Client Responsibilities** — Project-specific list of what the client must provide or arrange
- **Notice** — Email addresses for both parties

The fixed boilerplate (these rarely change):
- **Payment Terms** — NET30, 18% interest on overdue, collection costs
- **Remedies for Non-Payment** — Material breach, cancellation, suspension
- **Best Efforts Basis** — Non-acceptance of design doesn't justify non-payment
- **Changes** — Additional charges for out-of-scope changes, written agreement required
- **Title and Assignment** — Same IP terms as MoU
- **Accreditation/Promotions** — Same as MoU
- **Warranties and Representations** — Designer: timely service, 2-year defect warranty, no infringement. Client: owns provided content, no infringement.
- **Confidential Information** — Mutual NDA on proprietary info
- **Relationship of the Parties** — Independent contractor, not employee
- **No Exclusivity** — Both parties free to work with others
- **Indemnification / Hold Harmless** — Mutual indemnification for negligence, breach, and unlawful content
- **Limitation of Liability** — Designer's max liability = 50% of total compensation, no consequential damages
- **Default** — 30-day cure period (5 business days for non-payment)
- **Force Majeure** — Standard force majeure clause
- **Entire Agreement** — This is the whole deal, supersedes prior agreements
- **Amendment** — Written and signed by both parties
- **Severability** — Invalid provisions don't void the rest
- **Waiver of Contractual Right** — Non-enforcement isn't waiver
- **Applicable Law** — State of Kansas

Signature block: Client officer signature (name + title) + date, Joel Gaeddert CEO signature + date.

---

## The AI Assistant

The AI is accessed via a chat interface on the agreement editing page, similar to the Quotes pattern. It sees the current agreement state and the knowledge base of past agreements.

### What the AI Helps With

The AI's primary job is drafting the **variable sections** — the parts that change per project. The legal boilerplate is standardized and doesn't need AI generation.

For **MoUs** (Concept and Small Design):
- Draft the Scope of Work / Deliverable description from a natural language project description
- Suggest appropriate hours based on project complexity and past agreements
- Suggest deliverable contents (what the concept PDF should cover)
- Calculate cost from hours and rate
- Suggest timeframe

For **Agreements for Services**:
- Draft the Description of Services paragraph
- Suggest NTE amount based on project scope and past agreements
- Calculate payment schedule (initial, progress, final percentages and amounts)
- Fill in current standard service rates
- Draft project-specific Client Responsibilities
- Suggest contract term / end date

For **all types**:
- Suggest the right agreement type based on project description
- Pre-fill client info if the client has appeared in past agreements
- Answer questions about terms, typical scope, pricing rationale
- Flag anything unusual or missing

### System Prompt Emphasis

- Upland Exhibits' services: exhibit concept design, exhibit design, panel fabrication, installation, project management
- The three agreement types and when to use each
- Pricing patterns from the knowledge base (hourly rates for concepts, NTE ranges for full projects)
- Standard deliverable descriptions for concept work
- Typical scope language and phrasing (professional, clear, specific)
- Client responsibility lists for different project types
- Payment schedule conventions (10% initial, progress to 90%, 10% final)
- Current service rates (update these in settings, not hardcoded)
- Kansas law governs all agreements

### Knowledge Base

Seeded with past agreement data. The AI references this when drafting new agreements.

The knowledge base stores:
- Past agreements (client, type, scope, hours, pricing, project size)
- Standard rate sheets (current hourly rates by role, materials markup, travel rates)
- Scope of work examples organized by project type (concept, small design, full D&F)
- Client responsibility templates for different project types
- Deliverable description templates (what concept PDFs typically cover)
- Notes on scoping and pricing patterns

Over time, every agreement created in the system enriches the knowledge base.

---

## Data Model

### `agreements`

| Column | Type | Notes |
|--------|------|-------|
| id | TEXT PK | nanoid |
| type | TEXT NOT NULL | mou_concept, mou_small, full_services |
| title | TEXT NOT NULL | Project name / agreement title |
| status | TEXT NOT NULL | draft, sent, viewed, signed, countersigned, declined, expired |
| client_name | TEXT | Organization / legal entity name |
| client_address | TEXT | Full address |
| client_contact | TEXT | Contact person name |
| client_title | TEXT | Contact person title (for full agreements signature block) |
| client_email | TEXT | Contact email (for notice clause and sharing) |
| effective_date | TEXT | ISO date — when the agreement takes effect |
| end_date | TEXT | ISO date — contract end date (full agreements only) |
| project_description | TEXT | Scope of Work / Description of Services |
| deliverable | TEXT | What will be delivered (MoUs: description of concept PDF contents) |
| timeframe | TEXT | Delivery target (MoUs: "8 weeks after signing") |
| hours | REAL | Hours allocated (MoUs) |
| hourly_rate | REAL | Rate per hour (MoUs) |
| total_cost | REAL | Total cost / NTE amount |
| payment_structure | TEXT | JSON — initial_pct, initial_amount, progress details, final details (full agreements) |
| service_rates | TEXT | JSON — labor rates by role, materials markup, travel rates (full agreements) |
| client_responsibilities | TEXT | Markdown/text list of client responsibilities (full agreements) |
| custom_terms | TEXT | JSON — any overrides to the standard boilerplate |
| designer_email | TEXT | Designer's email for notice clause (default: joel@uplandexhibits.com) |
| prompt | TEXT | The original AI prompt that generated this agreement |
| notes | TEXT | Internal notes (not shown to client) |
| share_token | TEXT | Word-based token for client link |
| viewed_at | TEXT | ISO timestamp — first client view |
| view_count | INTEGER | Times client has viewed |
| client_signature | TEXT | JSON — {name, timestamp, ip} |
| designer_signature | TEXT | JSON — {name, timestamp, ip} |
| valid_until | TEXT | ISO date — when the unsigned agreement expires |
| created_by | TEXT | User ID (FK to auth DB) |
| created_at | TEXT | ISO timestamp |
| updated_at | TEXT | ISO timestamp |

### `conversations`

| Column | Type | Notes |
|--------|------|-------|
| id | TEXT PK | nanoid |
| agreement_id | TEXT NOT NULL | FK to agreements |
| messages | TEXT NOT NULL | JSON array of {role, content, timestamp} |
| created_at | TEXT | ISO timestamp |

### `knowledge_base`

| Column | Type | Notes |
|--------|------|-------|
| id | TEXT PK | nanoid |
| type | TEXT NOT NULL | past_agreement, rate_sheet, scope_template, responsibilities_template, notes |
| title | TEXT NOT NULL | Descriptive name |
| content | TEXT NOT NULL | The actual content (text, JSON, or markdown) |
| metadata | TEXT | JSON — tags, agreement_type, client, project_size, date, etc. |
| created_at | TEXT | ISO timestamp |
| updated_at | TEXT | ISO timestamp |

### `settings`

| Column | Type | Notes |
|--------|------|-------|
| id | INTEGER PK | Always 1 |
| data | TEXT NOT NULL | JSON singleton — default rates, company info, designer name/title, Upland legal name and address, default terms text for each agreement type |

---

## API Surface

### Auth (public)
- `POST /api/login` — username + password -> JWT
- `POST /api/forgot-password` — send reset email
- `POST /api/reset-password` — token + new password

### Agreements (authenticated)
- `GET /api/agreements` — list agreements (filterable by type, status)
- `POST /api/agreements` — create agreement (manual or from AI prompt)
- `GET /api/agreements/:id` — get full agreement with all fields
- `PUT /api/agreements/:id` — update agreement fields
- `DELETE /api/agreements/:id` — archive/delete agreement
- `POST /api/agreements/:id/duplicate` — deep copy as new draft

### AI (authenticated)
- `POST /api/agreements/:id/generate` — generate/regenerate variable sections from prompt
- `POST /api/agreements/:id/chat` — conversational AI (modify, suggest, explain)
- `GET /api/agreements/:id/conversation` — get conversation history

### Sharing (authenticated)
- `POST /api/agreements/:id/share` — generate share token, optionally email client
- `DELETE /api/agreements/:id/share` — revoke share token

### Client View (token-authenticated)
- `GET /api/agreements/view/:token` — get agreement data for client view
- `POST /api/agreements/view/:token/sign` — client signs (records name, timestamp, IP)

### Counter-Signature (authenticated)
- `POST /api/agreements/:id/countersign` — designer signs (records name, timestamp, IP)

### Knowledge Base (authenticated)
- `GET /api/knowledge` — list knowledge base entries
- `POST /api/knowledge` — add entry
- `PUT /api/knowledge/:id` — update entry
- `DELETE /api/knowledge/:id` — delete entry

### Users (superadmin only)
- `GET /api/users` — list users
- `POST /api/users` — create user
- `PUT /api/users/:id` — update user
- `DELETE /api/users/:id` — delete user

---

## Frontend Structure

### Pages

- `index.html` — Login
- `dashboard.html` — Agreement list with type/status filters
- `editor.html` — Agreement editor (the main workspace — form fields + AI chat)
- `view.html` — Client-facing agreement view (shareable, token-auth, signable, print-optimized)
- `knowledge.html` — Knowledge base management
- `settings.html` — App settings, default rates, company info, boilerplate text
- `forgot.html` / `reset.html` — Password reset flow

### The Dashboard (dashboard.html)

Agreement list with:
- Type filter tabs (All, MoU — Concept, MoU — Small Design, Agreement for Services)
- Status filter (All, Draft, Sent, Awaiting Signature, Signed, etc.)
- Search by client name or project title
- Sort by date, client, type, status
- Quick-create button (opens type picker + prompt modal)
- Each agreement card shows: title, client, type, total cost, status, date

### The Editor (editor.html)

Two main regions:

1. **Agreement Form** (main area) — The agreement rendered as an editable form, structured according to the agreement type. Variable fields are directly editable. Boilerplate sections are shown collapsed by default (expandable to review or customize). The document preview shows how it will look to the client.

2. **AI Chat** (right panel, collapsible) — Conversation with the AI. Shows context (current agreement state, type). Can generate variable sections from scratch, modify scope, suggest pricing, answer questions. Responses produce structured changes that can be applied with one click.

Top bar shows: agreement title, type badge, client, status, share button, print button.

### The Client View (view.html)

The agreement as the client sees it. Professional, formal document layout:

- Upland Exhibits header (Flint Hills Design, LLC dba Upland Exhibits)
- Agreement type title and effective date
- Full agreement text rendered as a formal document (not a form)
- All sections in the correct order for the agreement type
- Signature area at the bottom:
  - Client: typed name field, "Sign" button, shows timestamp after signing
  - Designer signature area (shows after countersigning)
- Status indicator (awaiting signature, signed by client, fully executed)
- Print stylesheet for clean paper output matching the current Word template aesthetic

The view page must render the agreement in a way that looks like a real contract — paragraph numbers, proper heading hierarchy, professional typography. Not a web form or card layout. Think: the Word documents you already send, but rendered as HTML.

### Print Layout

The client view page doubles as the print layout via `@media print`:
- Clean formal document typography (Instrument Sans)
- Proper heading hierarchy and paragraph numbering for legal sections
- Page breaks between major sections
- Signature lines render as underscores (traditional signature line look)
- No UI chrome (buttons, navigation, status badges hidden)
- Upland Exhibits header on first page
- Professional margins matching legal document conventions
- If digitally signed, signatures and timestamps render inline

---

## Digital Signature Flow

1. **Upland creates agreement** — Fills in details (AI-assisted), reviews, marks as ready
2. **Share with client** — Generates share link, optionally emails it via Postmark
3. **Client reviews** — Opens link, reads full agreement, scrolls through
4. **Client signs** — Types their name in the signature field, clicks "Sign Agreement"
   - System records: typed name, timestamp (ISO), IP address
   - Status updates to `signed`
   - Upland gets notified (email via Postmark)
5. **Upland countersigns** — Joel reviews the client-signed agreement, countersigns
   - System records: typed name, timestamp, IP
   - Status updates to `countersigned` (fully executed)
   - Client gets notified (email via Postmark)
6. **Both parties have a fully executed agreement** — Accessible via the share link and printable as PDF

Signatures are NOT drawn/handwritten. They're typed names with recorded metadata (timestamp + IP). This is sufficient for the agreements Upland uses. If legally binding e-signature (DocuSign-style) is ever needed, that's a future enhancement.

---

## Integrations

| System | Method | Purpose |
|--------|--------|---------|
| Turso Auth DB | `TURSO_AUTH_URL` | Shared user authentication |
| Turso App DB | `TURSO_URL` | App-specific data (agreements, knowledge base) |
| Claude API | `CLAUDE_API_KEY` | AI section drafting and chat |
| Postmark | `POSTMARK_API_TOKEN` | Password reset, share notifications, signature notifications |

---

## Environment Variables

```bash
# Auth (shared across satellite apps)
JWT_SECRET=<shared-secret>
TURSO_AUTH_URL=file:./data/auth.db
TURSO_AUTH_TOKEN=<token>

# App database
TURSO_URL=file:./data/local.db
TURSO_TOKEN=<token>

# AI
CLAUDE_API_KEY=<anthropic-key>

# Email
POSTMARK_API_TOKEN=<token>
POSTMARK_FROM_EMAIL=info@uplandexhibits.com

# Local dev
PORT=3005
```

---

## Directory Structure

```
upland-agreements/
├── netlify/functions/
│   └── api.ts                 # Single function, hand-rolled router
├── lib/
│   ├── auth.ts                # JWT + bcrypt utilities
│   ├── auth-storage.ts        # Shared auth DB (TURSO_AUTH_URL)
│   ├── storage.ts             # App DB (TURSO_URL) — agreements, knowledge
│   ├── ai.ts                  # Claude API — agreement drafting system prompt
│   ├── email.ts               # Postmark
│   └── share-tokens.ts        # Word-based token generation
├── public/
│   ├── index.html             # Login
│   ├── dashboard.html         # Agreement list
│   ├── editor.html            # Agreement editor (main workspace)
│   ├── view.html              # Client-facing agreement view + signing
│   ├── knowledge.html         # Knowledge base management
│   ├── settings.html          # App settings
│   ├── forgot.html            # Password reset request
│   ├── reset.html             # Password reset form
│   ├── js/
│   │   ├── api.ts             # API client
│   │   ├── login.ts
│   │   ├── dashboard.ts
│   │   ├── editor.ts          # Agreement editor logic + AI chat
│   │   ├── view.ts            # Client view + signature logic
│   │   ├── knowledge.ts       # Knowledge base management
│   │   └── settings.ts
│   └── css/
│       ├── shared.css         # Global styles
│       ├── editor.css         # Editor workspace
│       ├── view.css           # Client view + print styles (the critical one)
│       └── knowledge.css      # Knowledge base styles
├── data/                      # Local SQLite databases
│   ├── auth.db
│   └── local.db
├── server.ts                  # Express dev server
├── build.js                   # esbuild config
├── bootstrap.js               # Seed initial users
├── package.json
├── tsconfig.json
├── netlify.toml
├── .env
├── .oxlintrc.json
└── .gitignore
```

---

## MVP Scope

### Phase 1: Core Agreement Engine

Build these first. The goal is describe-project-to-signable-agreement as fast as possible.

1. **Agreement CRUD** — Create, list, view, edit, archive agreements
2. **Three Agreement Types** — Each with its correct structure and boilerplate
3. **AI Drafting** — Prompt produces the variable sections (scope, cost, timeframe, payment structure)
4. **Knowledge Base** — Seed with past agreement data; AI references it during drafting
5. **Inline Editing** — Edit any variable field after generation. Boilerplate expandable and editable.
6. **Auto-Calculations** — Hours x rate for MoUs. Payment schedule math for full agreements.
7. **Client View** — Professional formal document rendering with print stylesheet
8. **Print / PDF** — `@media print` on the client view produces a clean legal document
9. **Settings** — Default rates, company info, designer name, boilerplate text for each type

### Phase 2: Sign & Share (fast follow)

1. **Shareable Client Links** — Word-based tokens, no login required
2. **Digital Signatures** — Client types name to sign, system records metadata
3. **Counter-Signature** — Designer signs after client
4. **Signature Notifications** — Email via Postmark when agreement is shared, signed, countersigned
5. **View Tracking** — Record when client opens, how many times
6. **Duplicate Agreement** — Deep copy as new draft (for similar projects)

---

## What's Intentionally Deferred

- **Server-side PDF generation** — Print CSS and browser "Save as PDF" handle this for MVP. Server-side PDF (Puppeteer, etc.) only if a real need emerges for automated PDF delivery.
- **Drawn/handwritten signatures** — Typed name + timestamp + IP is sufficient. DocuSign-style signature pads come later if legally required.
- **Legally binding e-signature compliance** — ESIGN Act and UETA compliance (audit trails, certificate of completion) is a future enhancement. Current approach is equivalent to what Upland does today with Word docs and email.
- **Version history / redlining** — No diff tracking between revisions. Duplicate + edit covers revisions.
- **Client-side editing / negotiation** — Clients can only view and sign, not propose changes. Negotiation happens offline.
- **Multi-signer support** — One client signature + one designer signature. Multi-party agreements are future.
- **Integration with Quotes** — Converting an approved quote into an Agreement for Services is a natural future connection, but not for MVP.
- **ODIN integration** — ODIN reading agreement data comes after the app is stable.
- **Template versioning** — If the boilerplate terms change, old agreements keep their original text. No formal template version tracking yet.
- **Automated expiration** — Agreements don't auto-expire or send reminders. Manual status management for now.

---

## Building This App

This spec is designed to be handed to a fresh repo. To build:

1. Clone the satellite app scaffolding from Quotes (`flinthillsdesign/upland-quotes`) — it has the most similar workflow (AI-assisted document generation, shareable client views, print output)
2. Strip Quotes-specific code (sections, line items, quote-specific logic), keep the scaffolding (auth, storage pattern, dev server, build, netlify config, share tokens, email, AI integration pattern)
3. Implement the data model (ensureSchema pattern) — agreements is simpler than quotes (single table with rich fields instead of parent + sections + line items)
4. Build the API routes per the surface above
5. Build the frontend pages — the editor is a structured form (not a free-form document builder like Quotes), the client view is a formal document renderer
6. Write the AI system prompt with agreement drafting domain knowledge
7. Seed the knowledge base with past agreement data
8. Build the client view as a formal legal document — this is the most design-critical page. It needs to look like a real contract, not a web app.

The **client view / print layout** is the most important thing to get right visually. These are real contracts that clients sign. The rendered HTML must look as professional and formal as the Word documents Upland currently sends. Study the structure of the three agreement types carefully — the hierarchy, numbering, indentation, and tone are all established and should be preserved.

The **AI system prompt** needs domain knowledge about Upland's exhibit work: types of projects, typical scopes, pricing patterns, deliverable descriptions, and the specific language conventions used in past agreements.

---

## Agreement Text Reference

The following are the actual agreement templates currently used by Upland Exhibits. The AI system prompt and rendering logic should reproduce this structure and language faithfully. Variable sections are marked with `[brackets]`.

### MoU — Concept Template

```
Memo of Understanding
for Design Services


Client
[Client Name and Address]

Project
[Project Name]

Scope of Work / Deliverable
[AI-drafted: Description of work, hours allocated, what the deliverable PDF will
cover. Typical contents: exhibit content/themes, loose thematic floorplan, early
sketches or renderings, interactive display options, casework/display hardware
examples, graphic design sample, project implementation schedule & budget.]

Timeframe
[e.g., "Goal is to deliver PDF within 8 weeks after MoU is signed and returned"]

Cost
[e.g., "200 hours x $85 / hr = $17,000"]


----- PROJECT TERMS -----

TITLE AND ASSIGNMENT.
  - Client Content [...remains sole property of Client...]
  - Final Art [...works made for hire, property of Client upon full payment...]
  - Third Party Materials [...exclusive property of their respective owners...]
  - Preliminary Works [...exclusive property of Designer...]
  - All intellectual property rights to all other work [...exclusive property of
    Designer, with license granted to Client...]

ACCREDITATION/PROMOTIONS. Either party may reproduce, publish and display
photographs of the Project [...]


Agreed and accepted:

____________________________    _____    ____________________________    _____
Client Signature                Date     Joel Gaeddert, CEO              Date
```

### MoU — Small Design Template

Same as Concept MoU, with the addition of:

```
FINAL APPROVAL. Client shall provide final proofreading and approval of all
Final Art before its release for production. If the Client approves work
containing errors or omissions, such as, by way of example, not limitation,
typographic errors or misspellings, Client shall incur the cost of correcting
such errors.
```

### Agreement for Services Template

```
GENERAL AGREEMENT FOR SERVICES

This Agreement ("Agreement") is made effective as of [Effective Date] by and
between Flint Hills Design, LLC dba Upland Exhibits, of 507 SE 36th St.,
Newton, Kansas 67114, ("Upland" or "Designer"), and [Client Legal Name],
[Client Address] ("Client").

1. TERM. This Agreement shall begin on the Effective Date and shall end, unless
   earlier terminated, upon satisfactory completion of the Project [...] but in
   any event, no later than [End Date].

2. DESCRIPTION OF SERVICES. [AI-drafted: One clear paragraph describing the
   full scope of work.]

3. PROJECT COST. The parties agree that all Services shall be performed on a
   Time-And-Material-Not-To-Exceed basis. [...] total compensation [...] shall
   not exceed [NTE Amount].

4. INITIAL PAYMENT. A payment of [Amount] (equaling approximately [X]% of the
   Project Cost) will be required to retain Upland's services. This payment will
   be due within 30 days of signing this Agreement. Work shall not commence
   until the Initial Payment is received.

5. PROGRESS BILLINGS. [Standard: invoiced on percentage of completion, not to
   exceed 90% of NTE.]

6. FINAL PAYMENT. [Standard: remaining ~10%, invoiced upon Substantial
   Completion.]

7. PAYMENT TERMS. [Standard: NET30, 18% interest, collection costs.]

8. REMEDIES FOR NON-PAYMENT. [Standard boilerplate.]

9. BEST EFFORTS BASIS. [Standard boilerplate.]

10. CHANGES. [Standard: additional charges for out-of-scope changes, written
    agreement required.]

11. SERVICE RATES. [Current rates — variable, pulled from settings:]
    - Head of Design & Head of Fabrication: $[X]/hour
    - Design staff: $[X]/hour
    - Fabrication staff: $[X]/hour
    - All project materials billed at cost plus [X]%.
    - Travel time: $[X]/hour
    - Travel mileage and per diem: current IRS or GSA rates

12. CLIENT RESPONSIBILITIES. [AI-drafted: Project-specific list. Typical items
    include: coordinate decision-making, provide materials/photos/text, provide
    site plans and codes, provide naming approvals, arrange electrical/structural
    work, remove existing displays, prepare space, provide final proofreading,
    assume ADA compliance responsibility.]

13. TITLE AND ASSIGNMENT. [Same as MoU — standard IP terms.]

14. ACCREDITATION/PROMOTIONS. [Same as MoU.]

15. WARRANTIES AND REPRESENTATIONS. [Standard: Designer warrants timely service,
    2-year defect warranty, no infringement. Client warrants ownership of
    provided content.]

16. CONFIDENTIAL INFORMATION. [Standard mutual NDA.]

17. RELATIONSHIP OF THE PARTIES. [Standard independent contractor.]

18. NO EXCLUSIVITY. [Standard.]

19. INDEMNIFICATION; HOLD HARMLESS. [Standard mutual indemnification.]

20. LIMITATION OF LIABILITY. [Standard: 50% of total compensation, no
    consequential damages.]

21. DEFAULT. [Standard: 30-day cure, 5 business days for non-payment.]

22. FORCE MAJEURE. [Standard.]

23. NOTICE. [Email addresses for both parties.]

24. ENTIRE AGREEMENT. [Standard.]

25. AMENDMENT. [Standard.]

26. SEVERABILITY. [Standard.]

27. WAIVER OF CONTRACTUAL RIGHT. [Standard.]

28. APPLICABLE LAW. [State of Kansas.]


"CLIENT"
[Client Organization Name]

Signed: __________________________________      Date: ________________
By: _____________________________________________________
[Client Officer name & title]


"DESIGNER"
Flint Hills Design, LLC dba Upland Exhibits

Signed: __________________________________      Date: ________________
     Joel Gaeddert, CEO
```
