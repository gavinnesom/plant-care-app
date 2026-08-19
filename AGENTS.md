# Plant ID Agent Notes

Plant ID is a Vite, React, Tailwind, and Vercel serverless app. The current app identifies one uploaded plant photo; the approved direction is a private personal garden field guide where Gavin can save individual plants later.

## Required Reading

- For product direction, read `README.md`, `PROJECT.md`, and `DESIGN.md`.
- For implementation work, read `PROJECT_STATUS.md`, `CODEMAP.md`, and relevant source files.
- For a ChatGPT handoff, use `CHATGPT_HANDOFF.md` as the active scope and update its Codex implementation outcome.
- Use `TODO.md` for intentionally deferred work.

## Commands

```bash
npm install
npm test
npm run build
npx vercel dev
```

Use `npx vercel dev` for end-to-end identification because plain `npm run dev` serves only the Vite frontend and not `/api/identify-plant`.

## Invariants

- Keep OpenAI and Redis credentials server-side only.
- Do not implement My Garden, Supabase persistence, owner unlocking, multi-photo identification, printing, or Miscellany integration without explicit scope.
- Preserve the distinction between temporary AI identification, recorded identity, identity source, and future saved plant records.
- Do not modify MemoryEngine tables, APIs, authentication, or domain model.
- Do not push to `main`, merge PRs, deploy production, or change production environment variables without explicit authority.
