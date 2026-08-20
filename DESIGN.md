# Plant ID Design

## Architecture Overview

The current app is a Vite React frontend plus Vercel-compatible serverless functions.

- The frontend owns file selection, local preview, loading/error state, and result rendering.
- The identification API route owns request orchestration, image validation, rate limiting, OpenAI calls, and response handling. `server/plant-identification-core.js` owns multipart image extraction, model JSON extraction, and result normalization. `server/rate-limit.js` owns the server-only Supabase rate-limit boundary.
- Garden APIs own private owner-session checks, Garden reads/writes, and private photo serving. `server/garden-session.js` owns signed session cookies; `server/garden-store.js` owns Garden persistence and photo storage.
- Individual Garden deletion is a server-authorized soft delete that sets `deleted_at`; normal lists and photo reads exclude deleted records.

## Current Data Flow

1. `src/App.jsx` receives a selected image set through `UploadPanel`.
2. Client validation checks image type, size, and the 5-photo count limit.
3. `App` sends `FormData` with the selected image files to `/api/identify-plant`.
4. `api/identify-plant.js` rate-limits the request before expensive work.
5. The API uses `server/plant-identification-core.js` to extract multipart images, validate the image set, call OpenAI Responses with all selected images, normalize the model JSON, and return `{ result, warning }`.
6. `ResultPanel` renders confidence, alternatives, care traits, warnings, and care sections.
7. If Gavin chooses Add to Garden, the app unlocks My Garden if necessary and opens the Grow form with the current photo set, AI ID, and initial Plant Type.
8. Saved plants can later add/remove private photos and explicitly request Garden AI identification through `api/garden-identify-plant.js`, which loads selected private photo bytes server-side and persists the current AI ID.

## Module Responsibilities

- `src/App.jsx`: current page shell, request state, upload-to-result flow, warning/error handling, debug panel gating.
- `src/components/UploadPanel.jsx`: file input, drag/drop, preview, client image validation.
- `src/components/ResultPanel.jsx`: empty, loading, and result states for the current care card.
- `src/components/TraitBadge.jsx` and `src/components/CareIcon.jsx`: visual care trait rendering.
- `src/lib/plantSchema.js`: shared frontend constants and trait copy.
- `api/identify-plant.js`: server boundary for public request orchestration, image-set validation, rate limiting, OpenAI interaction, and response handling.
- `api/garden-identify-plant.js`: authorized private Garden AI identification/re-identification from selected saved photos.
- `server/plant-identification-core.js`: testable server-side parsing, OpenAI vision call, and normalization for multipart image input and OpenAI JSON output.
- `api/garden-session.js`: owner-key unlock and session status.
- `api/garden-plants.js`: authorized Garden list/create.
- `api/garden-plants/[id].js`: authorized plant read/edit/add photos/soft delete.
- `api/garden-photos/[id].js`: authorized private photo bytes and photo removal.
- `server/garden-session.js`: signed 30-day session cookie creation/verification.
- `server/garden-store.js`: saved plant/photo persistence.

## Important Invariants

- The browser never receives OpenAI, Supabase database, or owner-passphrase secrets.
- Server-side rate limiting runs before image parsing and before OpenAI calls.
- Production fails closed if rate limiting is not configured.
- Plant ID database objects must stay isolated in the `plant_id` schema and must not alter MemoryEngine or Miscellany objects.
- AI identification must communicate uncertainty and safety caveats.
- Recorded identity and AI assessment must not silently overwrite each other.
- Private My Garden access must be authorized server-side for every garden read, write, AI reassessment, and photograph request.
- AI ID and Plant Type are separate persisted fields; editing Plant Type must not alter AI ID.
- Saved photos are private and must be served only through authorized API routes.

## Future Data Model Direction

The saved plant record distinguishes:

- plant name: required personal label;
- location: optional place where the individual plant lives;
- recorded identity: optional accepted identity from AI, label, or manual entry;
- identity source: AI-accepted, manually entered, or label-confirmed;
- AI assessment: optional independent best guess from supplied photographs;
- photographs: zero or more plant images, with Part 3 limiting selected/saved sets to 5 photos for now;
- care and diagnosis guide: personalized to the individual plant and environment;
- timestamps and recoverable deletion state.

Supabase is the infrastructure, using separate Plant ID schema objects in the existing GavinApps project. MemoryEngine must remain untouched.

## Visual Direction

The current visual design is a warmer garden shell with off-whites, bark, moss, leaf, and plum accents. My Garden uses a simple tiled gallery rather than search or filtering.

## Error and Empty States

The current app distinguishes missing image, invalid image type, oversized image, unavailable API route, non-JSON API response, low confidence, rate limiting, and server unavailability. Future My Garden work should similarly distinguish empty garden, locked garden, missing photos, no AI assessment, and recoverable deletion.

## Deliberate Tradeoffs

- The current API uses a small manual multipart parser to avoid an extra dependency.
- Current tests target server-side helper behavior before adding browser-specific tooling.
- Vercel CLI is used for local end-to-end API testing because Vite alone does not serve serverless routes.
