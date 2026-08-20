# Plant ID Agent Notes

Plant ID is a Vite, React, Tailwind, and Vercel serverless app. The current app identifies one uploaded plant photo and includes the private My Garden foundation for saved individual plants.

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

- Keep OpenAI and Supabase database credentials server-side only.
- Do not implement multi-photo identification, full care/diagnosis generation, printing, or Miscellany integration without explicit scope.
- Preserve the distinction between temporary AI identification, recorded identity, identity source, and future saved plant records.
- Do not modify MemoryEngine tables, APIs, authentication, or domain model.
- Do not push to `main`, merge PRs, deploy production, or change production environment variables without explicit authority.
