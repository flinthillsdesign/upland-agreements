# Agreements

The contract tool (agreements.uplandexhibits.com): AI-assisted drafting of Upland's
agreements, client-facing share links with digital signature capture, and PDF
generation attached to countersignature emails.

Standard satellite stack — see the workspace `CLAUDE.md` for the shared spine
(dual Turso DBs, single Netlify function + hand-rolled router in
`netlify/functions/api.ts`, `ensureSchema()`, vanilla-TS frontend via esbuild,
`@upland/auth`).

## Commands

```bash
npm run dev          # local dev server, port 3005
npm run build        # build.js
npm run bootstrap    # seed a local DB (bootstrap.js)
npm run lint         # oxlint
npm run fmt          # oxfmt
```

## App-specific notes

- Client share links use human-friendly word-pair tokens (`lib/share-tokens.ts`).
  They are short on purpose (Joel, 2026-09-28: no long links), so **the limit on
  tries is the wall**: every token route goes through `openShareToken`, a wrong
  link or wrong signing code is a miss (`link_misses`), 5 misses an hour closes
  that address out and 60 an hour overall closes every share link for the hour.
  A new route that takes a token must use it.
- `lib/render-agreement.ts` renders agreement HTML for both the client view and
  the PDF.
- DocRaptor generates PDFs (`DOCRAPTOR_API_KEY`; runs in test mode when unset).
  `POST /api/pdf` renders the agreement on the server and never takes HTML
  from the caller: a client names it by share link (through `openShareToken`),
  a signed-in preview by id.
- **Who gets in is decided by the shared library**: staff routes go through
  `@upland/auth`'s `checkAccess` (`staffGate` in the router) — valid token,
  the person still exists, not logged out since it was minted, holds an
  `agreements` grant. Don't hand-write those checks. The four client routes
  under `/api/agreements/view/:token` are deliberately outside it.
- **No users or passwords here.** `lib/auth-storage.ts` is read-only — ODIN
  owns the auth DB's schema and writes. This app's own user admin and
  password reset were removed 2026-10-01 (they wrote columns the shared table
  no longer has); "Forgot password?" goes to ODIN. `npm run bootstrap` seeds
  the LOCAL file DB only.
- **One rate card: the Settings row, read through `lib/rates.ts`**
  (`currentRates`, `mouRate`, `ratesFor`). New-agreement defaults, the editor,
  the printed contract and the AI drafting prompt all ask there. Never type a
  rate anywhere else: the print used to fall back to $95 / $75 / $65 and 15%
  while the editor showed $125 / $100 / $75 and 20%. A stored rate on an
  agreement always wins over Settings (a stored 0 is a real 0).
- AI drafting calls go through `@upland/shared/ai` (`createAi`): retries on
  a transient failure, and a reply cut off at the token cap or refused
  changes nothing on the agreement and tells the person, instead of showing
  half a JSON object. Read replies with `firstText`, never `content[0]`.
- Mail (share links, signing codes, countersigned PDFs) goes out through
  `@upland/shared/mail`'s `sendMail` — link tracking off, so a signing link is
  the link we wrote. `lib/email.ts` holds only the words. A send that fails
  is reported: the share route returns `failed`, and a signing code that
  can't be mailed is an error to the client, never a silent "sent".
- **Days are Kansas days** (`@upland/shared/dates`): the effective date
  stamped at signing, the 30-day sign-by date and every printed date. Never
  take a day from `toISOString()` — after about 7 pm Central that is tomorrow.
