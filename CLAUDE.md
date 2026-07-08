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
- `lib/render-agreement.ts` renders agreement HTML for both the client view and
  the PDF.
- DocRaptor generates PDFs (`DOCRAPTOR_API_KEY`; runs in test mode when unset).
- Postmark sends signature and countersignature emails.
