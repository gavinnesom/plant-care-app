# Plant ID Project Status

## Current State

Plant ID is a working Vite, React, Tailwind, and Vercel serverless plant-identification app. The current implementation supports one uploaded image at a time, local preview, server-side rate limiting, OpenAI vision identification, structured response validation, low-confidence warnings, and a rendered care card.

The approved product direction is now a private personal garden field guide with optional saved individual plants, but that direction has not been implemented.

## What Works

- Single JPG, PNG, or WebP upload up to 8 MB.
- Local browser preview.
- Multipart POST to `/api/identify-plant`.
- Server-side image parsing and validation.
- OpenAI Responses API call with image input.
- Strict JSON extraction and normalization through a testable server-side core module outside the Vercel API route directory.
- Care card rendering with confidence, alternatives, trait badges, warnings, expandable sections, and fun fact.
- Supabase-backed rate limiting before OpenAI calls using isolated Plant ID database objects.
- Debug status panel hidden unless `?debug=1`.

## Verified Commands

Verified during the standards foundation pass on 2026-08-19:

```bash
npm test
npm run build
```

`npx vercel dev` remains the correct local command for end-to-end identification, but it requires local credentials and was not reverified during the foundation pass.

## Environment and Deployment

- Repository: `https://github.com/gavinnesom/plant-care-app.git`
- Local path: `/Users/gavinnesom/Code/plant-id-starter`
- Production custom domain recorded in legacy notes: `https://plants.gavinnesom.com`
- Canonical Vercel project recorded in legacy notes: `plant-care-app`
- A separate `plant-id-starter` Vercel project may also exist and should be treated as non-canonical unless Gavin decides otherwise.

Required server-side environment variables:

```text
OPENAI_API_KEY
OPENAI_MODEL
SUPABASE_DB_URL
PLANT_ID_IP_LIMIT
PLANT_ID_IP_WINDOW
PLANT_ID_DAILY_GLOBAL_LIMIT
PLANT_ID_DAILY_GLOBAL_WINDOW
PLANT_ID_FORCE_RATE_LIMIT
```

## Durable Decisions

- My Garden is private and intended only for Gavin.
- Public visitors may use temporary identification but cannot access My Garden.
- My Garden should work on Gavin's MacBook and phone.
- Future private access should use one fixed owner passphrase, no usernames, no registration, and no account-management interface.
- The passphrase must be a server-side secret.
- Unlocking should create a long-lived secure device session.
- Every private garden read, write, and photograph request must be authorized server-side.
- Future Plant ID persistence should reuse the existing GavinApps Supabase project with separate Plant ID tables and private photograph storage.
- Plant ID must not use or modify MemoryEngine tables, API, authentication, or domain model.
- Garden deletion should initially be recoverable with useful timestamps retained.

## Known Limitations

- No saved plants, My Garden, persistence, authentication, multi-photo identification, print/PDF output, search, filtering, or Miscellany integration exists yet.
- No project-specific browser tests exist yet.
- The current API schema is care-card oriented rather than saved-plant oriented.
- Local end-to-end identification depends on `npx vercel dev` and valid local secrets.

## Last Implementation Summary

The production hotfix replaced Redis/Upstash rate limiting with an isolated Supabase/Postgres limiter in the shared GavinApps Supabase project. Plant ID owns only the `plant_id` schema objects from `supabase/migrations/202608200001_plant_id_rate_limits.sql`; MemoryEngine and Miscellany objects remain untouched.
