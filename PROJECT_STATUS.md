# Plant ID Project Status

## Current State

Plant ID is a working Vite, React, Tailwind, and Vercel serverless plant-identification app. It supports temporary multi-photo identification and a private My Garden with purpose-aware photos, durable AI records, a readable plant-record layout, recoverable deletion, and printable care sheets.

## What Works

- Up to 5 selected JPG, PNG, or WebP images per AI request, each up to 8 MB.
- Local browser previews with add/remove before identification.
- Multipart public identification with server-side validation and fixed-window rate limiting before OpenAI work.
- Structured OpenAI Responses output, low-confidence warnings, alternatives, care traits, and safety caveats.
- Owner-key unlock with a secure 30-day per-device Garden session.
- Private Garden list, Grow form, individual plant records, photo add/remove, soft delete, editable Plant Type, and separate AI ID.
- An uncapped saved-photo library with identity/reference and observation/problem purposes. Only a bounded, selected set is sent to an AI request.
- Durable AI assessment history and a current personalized care guide with generation provenance and preserved input context.
- Dated observations with optional problem photos and explicit diagnosis using selected observations, their problem photos, and only deliberately selected reference photos.
- Private, server-authorized saved-photo retrieval and throttling for repeated failed unlock attempts.
- A full-width vertical plant record ordered as Identity, Care Guide, Problems/Observations, and Diagnosis/Remediation.
- Recently deleted plants can be reviewed and restored without losing their photos or durable records.
- A print-only two-page Letter care sheet derived from the current plant aggregate, with no duplicate persistence model.
- Larger controls, visible keyboard focus, responsive layouts, semantic alerts, and WCAG A/AA checks on the changed Garden view.
- ESLint, Prettier, Node tests, and Playwright desktop/mobile smoke coverage.
- Debug status panel hidden unless `?debug=1`.

## Verified Commands

Verified during Part 4 on 2026-08-20:

```bash
npm test
npm run lint
npm run format:check
npm run build
npm run test:e2e
git diff --check
```

The local browser suite passed at desktop and mobile widths. A Vercel Preview also passed authenticated Garden checks against the migrated Plant ID schema, including durable reassessment, care-guide v2, observation, diagnosis v2, and reversible multipart photo upload/removal. Final production verification is recorded in the release handoff.

Focused Part 5 verification on 2026-08-20 covered changed behavior only: deleted-plant listing/restoration, vertical record order, desktop/mobile overflow, WCAG A/AA checks, and the two-page print layout. The Vercel Preview built successfully and passed authenticated active/deleted Garden API checks plus a reversible restore/soft-delete cycle. Unchanged paid AI paths were not repeated.

## Environment and Deployment

- Repository: `https://github.com/gavinnesom/plant-care-app.git`
- Local path: `/Users/gavinnesom/Code/plant-id-starter`
- Production: `https://plants.gavinnesom.com`
- Canonical Vercel project: `plant-care-app`

Required server-side environment variables:

```text
OPENAI_API_KEY
OPENAI_MODEL
SUPABASE_DB_URL
PLANT_ID_OWNER_KEY
PLANT_ID_SESSION_SECRET
PLANT_ID_IP_LIMIT
PLANT_ID_IP_WINDOW
PLANT_ID_DAILY_GLOBAL_LIMIT
PLANT_ID_DAILY_GLOBAL_WINDOW
PLANT_ID_FORCE_RATE_LIMIT
```

## Durable Decisions

- My Garden is private and intended only for Gavin.
- Public visitors may use temporary identification but cannot access My Garden.
- My Garden works across Gavin's devices through one fixed server-side owner passphrase and signed device sessions.
- Every private Garden read, write, AI action, and photograph request is authorized server-side.
- Plant ID reuses the GavinApps Supabase project through isolated `plant_id` objects and does not use or modify MemoryEngine data or concepts.
- Plant Name is the required personal label. Plant Type is Gavin's recorded identity. AI ID is an independent model assessment.
- Editing Plant Type must not alter AI ID, and reassessment must not silently overwrite a non-empty Plant Type.
- Saved-photo capacity and per-request AI limits are separate concerns.
- Identity/reference photos answer what the plant is; observation/problem photos answer what is happening to it.
- AI tasks use explicit, purpose-appropriate selections rather than the entire saved library.
- Assessments, care guides, observations, and diagnoses are durable records; plant rows point to current records for efficient display.
- Normal request handlers do not perform schema DDL. Tracked migrations own schema evolution.
- Garden deletion is recoverable through the Recently deleted UI; restoration preserves associated data.

## Known Limitations

- Historical assessments and generated guides persist but do not yet have a dedicated history browser.
- The existing production record used for Part 4 Preview validation had no suitable problem photo. Its diagnosis used observation text and one deliberately selected healthy reference photo; purpose-aware problem-photo behavior is covered by code and tests.
- Search, filtering, permanent deletion, and Miscellany integration remain deferred.
- Recently deleted currently contains 11 old synthetic Codex/Part 2 test records. They remain recoverable until Gavin explicitly authorizes permanent deletion.
- Local end-to-end API behavior requires `npx vercel dev` and valid local secrets.

## Last Implementation Summary

Part 5 reshapes each saved plant into a readable vertical record, adds Recently deleted restoration, and provides a condensed two-page print view derived from the existing aggregate. It also improves focus visibility, contrast, responsive behavior, and focused accessibility/browser coverage without changing the established AI or persistence models.
