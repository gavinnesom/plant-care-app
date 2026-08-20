# Plant ID Project Status

## Current State

Plant ID is a working Vite, React, Tailwind, and Vercel serverless plant-identification app. The current implementation supports selected photo sets of up to 5 uploaded images, local previews, server-side rate limiting, OpenAI vision identification, structured response validation, low-confidence warnings, a rendered care card, and a private My Garden foundation.

## What Works

- Up to 5 JPG, PNG, or WebP uploads, each up to 8 MB.
- Local browser previews with add/remove before identification.
- Multipart POST to `/api/identify-plant`.
- Server-side image-set parsing and validation, including max count and aggregate size.
- OpenAI Responses API call with all selected images in one request.
- Strict JSON extraction and normalization through a testable server-side core module outside the Vercel API route directory.
- Care card rendering with confidence, alternatives, trait badges, warnings, expandable sections, and fun fact.
- Supabase-backed rate limiting before OpenAI calls using isolated Plant ID database objects.
- Owner-key unlock with a secure 30-day per-device Garden session.
- Private My Garden list, Grow form with zero/one/multiple optional photos, individual plant page with multiple saved photos, photo add/remove, explicit saved-plant AI identification/re-identification, detail-page soft delete, editable Plant Type, and separate AI ID.
- Server-side throttling for repeated failed owner-key unlock attempts.
- Private server-authorized saved photo retrieval from isolated Plant ID Supabase/Postgres objects.
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
- My Garden should work on Gavin's MacBook and phone.
- Future private access should use one fixed owner passphrase, no usernames, no registration, and no account-management interface.
- The passphrase must be a server-side secret.
- Unlocking should create a long-lived secure device session.
- Every private garden read, write, and photograph request must be authorized server-side.
- Future Plant ID persistence should reuse the existing GavinApps Supabase project with separate Plant ID tables and private photograph storage.
- Plant ID must not use or modify MemoryEngine tables, API, authentication, or domain model.
- Garden deletion is recoverable at the data-model level with useful timestamps retained; full trash/restore UI remains deferred.

## Known Limitations

- No multi-photo identification, AI reassessment history, full personalized care guide, diagnosis workflow, print/PDF output, search, filtering, or Miscellany integration exists yet.
- No project-specific browser tests exist yet.
- AI reassessment history is not user-facing yet; saved plants retain the current/latest useful AI ID only.
- Local end-to-end identification depends on `npx vercel dev` and valid local secrets.

## Last Implementation Summary

Part 3 added multiple-photo identification sets, multiple private saved photos per plant, explicit saved-plant AI identification/re-identification, photo removal, and fixed the manual Grow-with-photo save boundary by increasing bounded JSON body handling and correcting empty AI assessment normalization.
