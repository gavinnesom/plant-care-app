# Plant ID Design

## Architecture Overview

The current app is a small Vite React frontend plus one Vercel-compatible serverless function.

- The frontend owns file selection, local preview, loading/error state, and result rendering.
- The API route owns multipart parsing, image validation, rate limiting, OpenAI calls, JSON extraction, and response normalization.
- There is no current database, authentication, persistent storage, or saved plant model.

## Current Data Flow

1. `src/App.jsx` receives a selected image through `UploadPanel`.
2. Client validation checks image type and size.
3. `App` sends `FormData` with one `image` file to `/api/identify-plant`.
4. `api/identify-plant.js` rate-limits the request before expensive work.
5. The API parses the multipart body, validates the image, calls OpenAI Responses with image input, extracts JSON, validates required fields, and returns `{ result, warning }`.
6. `ResultPanel` renders confidence, alternatives, care traits, warnings, and care sections.

## Module Responsibilities

- `src/App.jsx`: current page shell, request state, upload-to-result flow, warning/error handling, debug panel gating.
- `src/components/UploadPanel.jsx`: file input, drag/drop, preview, client image validation.
- `src/components/ResultPanel.jsx`: empty, loading, and result states for the current care card.
- `src/components/TraitBadge.jsx` and `src/components/CareIcon.jsx`: visual care trait rendering.
- `src/lib/plantSchema.js`: shared frontend constants and trait copy.
- `api/identify-plant.js`: server boundary for validation, rate limiting, OpenAI interaction, and normalized result shape.

## Important Invariants

- The browser never receives OpenAI, Upstash, Vercel KV, Supabase, or owner-passphrase secrets.
- Server-side rate limiting runs before image parsing and before OpenAI calls.
- Production fails closed if rate limiting is not configured.
- AI identification must communicate uncertainty and safety caveats.
- Future recorded identity and AI assessment must not silently overwrite each other.
- Future private My Garden access must be authorized server-side for every garden read, write, and photograph request.

## Future Data Model Direction

The future saved plant record should distinguish:

- garden name: required personal label;
- location: optional place where the individual plant lives;
- recorded identity: optional accepted identity from AI, label, or manual entry;
- identity source: AI-accepted, manually entered, or label-confirmed;
- AI assessment: optional independent best guess from supplied photographs;
- photographs: one or more plant images;
- care and diagnosis guide: personalized to the individual plant and environment;
- timestamps and recoverable deletion state.

Supabase is the expected infrastructure, using separate Plant ID tables and private photograph storage in the existing GavinApps project. MemoryEngine must remain untouched.

## Visual Direction

The current visual design is a dark slate/green shell with cream result cards, botanical care badges, and a compact two-column desktop flow that collapses for smaller screens. Do not change the visual direction during standards or testing work.

Future My Garden screens should favor a browsable card list or grid over search until Gavin's collection is large enough to justify search and filtering.

## Error and Empty States

The current app distinguishes missing image, invalid image type, oversized image, unavailable API route, non-JSON API response, low confidence, rate limiting, and server unavailability. Future My Garden work should similarly distinguish empty garden, locked garden, missing photos, no AI assessment, and recoverable deletion.

## Deliberate Tradeoffs

- The current API uses a small manual multipart parser to avoid an extra dependency.
- Current tests target server-side helper behavior before adding browser-specific tooling.
- Vercel CLI is used for local end-to-end API testing because Vite alone does not serve serverless routes.
