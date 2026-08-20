# Plant ID Starter

A polished Vite + React + Tailwind plant identification app. The current implementation identifies a single uploaded plant photo and returns AI-assisted plant-care guidance; the intended product direction is a personal garden field guide built around saved individual plants.

## Purpose

Plant ID identifies plants from one or more photographs and can save selected plants in My Garden, where Gavin can record what each individual plant is called, where it lives, and its personalized care and problem-diagnosis guide.

An identification does not automatically save a plant. A user can identify a plant temporarily and add it to My Garden only when they explicitly choose to.

## Product Direction

### Identification

- A plant can be identified using one or more photographs.
- The user should be able to add and remove photographs from the identification set.
- AI may return a best guess, uncertainty, alternatives, or no confident guess.
- An identification can remain temporary unless the user explicitly chooses **Add to My Garden**.

### My Garden

My Garden is a persistent collection of individual plants, not merely a list of species. Two orange trees can have separate records, locations, photographs, histories, and care needs.

There are two valid ways to create a saved plant:

1. After adding one or more photographs, select **Add to My Garden**. AI identification may happen before or after the plant is saved.
2. Select **Add Plant** directly from My Garden, enter its required garden name, and add other information or photographs later.

A saved plant requires only a garden name. Search and filtering are deferred until the collection becomes large enough to justify them; for Gavin's current collection of fewer than 25 plants, a simple browsable card list or grid is enough.

### Plant Records

Keep these plant-record concepts distinct:

- **Garden name — required:** Gavin's personal label, such as `Big Green` or `Orange Tree`.
- **Location — optional:** where the individual plant lives, such as `Patio` or `By the shed`.
- **Recorded identity — optional:** the accepted plant identity, which may come from an AI result, nursery label, or manual entry.
- **Identity source:** indicates whether the recorded identity was AI-accepted, manually entered, or confirmed from a label.
- **AI assessment — optional:** the AI's independent best guess based on the available photographs.

A manual or nursery-supplied identity must not prevent the user from requesting an AI assessment. The AI assessment must remain visibly distinct from the recorded identity and must never silently overwrite it. If no photographs have been supplied, show that there is no AI assessment rather than pretending that an identification was attempted.

### Care and Problem Diagnosis

Each saved plant can maintain a practical, personalized care and problem-diagnosis guide based on the individual plant and its actual environment, not just generic species information.

For example, a Festival™ Raspberry Cordyline record may need to account for container growing, wet compost, frequent watering, heat exposure, browning, and wilting while distinguishing heat stress, transplant shock, poor root oxygen, and rot.

A longer-term possibility is for each useful plant guide to become a corresponding entry in Gavin's Miscellany.

### Output Formats

Desktop and mobile should present the complete plant record, adapted appropriately to each screen size. PDF/print does not require complete content parity.

The printable version should be a deliberately condensed, dense, two-sided care sheet designed to be laminated and kept near the plant. It should prioritize everyday care, seasonal adjustments, warnings, symptoms, likely causes, corrective actions, feeding, pruning, and repotting. It may omit secondary explanations and identification history, but it must not contradict the full record.

## Current Implementation

- Uploads JPG, PNG, or WebP plant images up to 8 MB.
- Shows a local image preview before submission.
- Sends the image to `api/identify-plant.js` as multipart form data.
- Converts the uploaded image to base64 on the server.
- Calls the OpenAI Responses API with vision input.
- Asks for strict JSON matching the app's plant-care schema.
- Validates and normalizes the response before returning it to the frontend.
- Renders a portfolio-ready care card with confidence, alternatives, warnings, trait badges, and expandable care sections.

The app includes a small inline SVG icon system for care traits such as sun exposure, water needs, soil type, pet safety, California suitability, and beginner friendliness.

The current app is still a one-photo identification flow. My Garden, multi-photo identification sets, saved plant records, personalized per-plant histories, and printable care sheets are planned product direction, not current implementation.

## Tech Stack

- Vite
- React 18
- Tailwind CSS
- Vercel-style serverless function in `api/identify-plant.js`
- OpenAI Responses API

## Local Setup

Prerequisites:

- Node.js and npm
- Vercel CLI access through `npx vercel` or an installed `vercel` command

Install dependencies:

```bash
npm install
```

Create a local environment file:

```bash
cp .env.example .env.local
```

Add your API key:

```bash
OPENAI_API_KEY=your_openai_api_key_here
```

Optional model override:

```bash
OPENAI_MODEL=gpt-4.1-mini
```

Add Supabase settings for server-side rate limiting:

```bash
SUPABASE_URL=your_supabase_project_url
SUPABASE_DB_URL=your_server_only_supabase_database_url
PLANT_ID_IP_LIMIT=15
PLANT_ID_IP_WINDOW=1 h
PLANT_ID_DAILY_GLOBAL_LIMIT=100
PLANT_ID_DAILY_GLOBAL_WINDOW=1 d
PLANT_ID_FORCE_RATE_LIMIT=0
```

Run the full app, including the API route:

```bash
npx vercel dev
```

Do not use plain `npm run dev` when testing identification. It only starts the Vite frontend, so image preview will work but `/api/identify-plant` will not be served and no real identification can happen.

The app is only working end-to-end when clicking `Identify plant` sends a multipart POST to `/api/identify-plant` and the result panel is populated from the API response.

## Vercel Deployment Notes

1. Connect the repo to Vercel.
2. Add `OPENAI_API_KEY` in Vercel project settings.
3. Add `SUPABASE_URL` and the server-only `SUPABASE_DB_URL` used by the shared GavinApps Supabase project.
4. Apply the tracked Plant ID migration in `supabase/migrations/202608200001_plant_id_rate_limits.sql`.
5. Optionally add `OPENAI_MODEL` and rate-limit override values.
6. Deploy.

If `OPENAI_API_KEY` is missing locally or in Vercel, the UI will show:

```text
Missing OPENAI_API_KEY. Add it to .env.local and restart the dev server.
```

For production on Vercel, add the key in the Vercel dashboard and redeploy.

The frontend never receives the OpenAI API key. The browser sends the image to `/api/identify-plant`, and the serverless route calls OpenAI.

## Rate Limiting

`/api/identify-plant` has server-side rate limiting before image parsing and before the OpenAI vision call. The default limits are:

- 15 identification attempts per client IP per hour
- 100 total demo identification attempts per day

These can be adjusted with:

```bash
PLANT_ID_IP_LIMIT=15
PLANT_ID_IP_WINDOW=1 h
PLANT_ID_DAILY_GLOBAL_LIMIT=100
PLANT_ID_DAILY_GLOBAL_WINDOW=1 d
```

The rate limiter stores bounded fixed-window counters in the isolated `plant_id` schema. It hashes client identifiers before storage and removes expired counter rows during normal checks.

Local development behavior:

- If `SUPABASE_DB_URL` is missing, requests are allowed.
- The API logs a local warning so development is not blocked.
- To test the `429` UI locally without real Supabase credentials or OpenAI usage, temporarily run Vercel dev with `PLANT_ID_FORCE_RATE_LIMIT=1`. This deny-only helper is ignored when `VERCEL_ENV=production`.

Production behavior:

- If Vercel has a deployment environment and `SUPABASE_DB_URL` is missing, the API returns a safe `503` response before calling OpenAI.
- Rate-limited requests return `429` and do not call OpenAI.

Recommended Vercel setup:

- Add `OPENAI_API_KEY`, `SUPABASE_URL`, and `SUPABASE_DB_URL` for both Preview and Production.
- Keep all API keys and database credentials server-side only.

## Important Files

- `src/App.jsx`: main flow and state handling
- `src/components/UploadPanel.jsx`: upload, drag/drop, validation hints, preview
- `src/components/ResultPanel.jsx`: loading, empty, warning, result, alternatives, details
- `src/components/CareIcon.jsx`: custom inline SVG icon system
- `src/components/TraitBadge.jsx`: maps care enums to polished badges
- `src/lib/plantSchema.js`: shared frontend schema constants and trait copy
- `api/identify-plant.js`: Vercel-compatible OpenAI vision endpoint
- `server/rate-limit.js`: server-only Supabase-backed rate-limit boundary
- `supabase/migrations/202608200001_plant_id_rate_limits.sql`: isolated Plant ID rate-limit schema and function

## Safety Note

The result is AI-assisted and may be uncertain. Confirm plant identity before eating or touching unknown plants, treating pests or disease, or exposing pets and children.
