# Plant ID Starter

A polished Vite + React + Tailwind plant identification demo. Users can upload a plant photo, preview it locally, and send it to a Vercel-compatible serverless endpoint for AI-assisted identification and plant-care guidance.

## What It Does

- Uploads JPG, PNG, or WebP plant images up to 8 MB.
- Shows a local image preview before submission.
- Sends the image to `api/identify-plant.js` as multipart form data.
- Converts the uploaded image to base64 on the server.
- Calls the OpenAI Responses API with vision input.
- Asks for strict JSON matching the app's plant-care schema.
- Validates and normalizes the response before returning it to the frontend.
- Renders a portfolio-ready care card with confidence, alternatives, warnings, trait badges, and expandable care sections.

The app includes a small inline SVG icon system for care traits such as sun exposure, water needs, soil type, pet safety, California suitability, and beginner friendliness.

## Tech Stack

- Vite
- React 18
- Tailwind CSS
- Vercel-style serverless function in `api/identify-plant.js`
- OpenAI Responses API

## Local Setup

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

Add Upstash Redis settings for rate limiting:

```bash
UPSTASH_REDIS_REST_URL=your_upstash_rest_url
UPSTASH_REDIS_REST_TOKEN=your_upstash_rest_token
# Vercel KV/Upstash integrations may provide these names instead:
KV_REST_API_URL=your_kv_rest_api_url
KV_REST_API_TOKEN=your_kv_rest_api_token
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
3. Connect an Upstash/Vercel KV Redis database to the project.
4. Confirm Vercel added either `KV_REST_API_URL` / `KV_REST_API_TOKEN` or `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN`.
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

Local development behavior:

- If Upstash/Vercel KV env vars are missing, requests are allowed.
- The API logs a local warning so development is not blocked.
- To test the `429` UI locally without real Redis credentials or OpenAI usage, temporarily run Vercel dev with `PLANT_ID_FORCE_RATE_LIMIT=1`. This deny-only helper is ignored when `VERCEL_ENV=production`.

Production behavior:

- If `VERCEL_ENV=production` and Upstash/Vercel KV env vars are missing, the API returns a safe `503` response before calling OpenAI.
- Rate-limited requests return `429` and do not call OpenAI.

Recommended Vercel setup:

- Add `OPENAI_API_KEY` plus either `KV_REST_API_URL` / `KV_REST_API_TOKEN` or `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` for both Preview and Production.
- Keep all API keys and Redis tokens server-side only.

## Important Files

- `src/App.jsx`: main flow and state handling
- `src/components/UploadPanel.jsx`: upload, drag/drop, validation hints, preview
- `src/components/ResultPanel.jsx`: loading, empty, warning, result, alternatives, details
- `src/components/CareIcon.jsx`: custom inline SVG icon system
- `src/components/TraitBadge.jsx`: maps care enums to polished badges
- `src/lib/plantSchema.js`: shared frontend schema constants and trait copy
- `api/identify-plant.js`: Vercel-compatible OpenAI vision endpoint

## Safety Note

The result is AI-assisted and may be uncertain. Confirm plant identity before eating or touching unknown plants, treating pests or disease, or exposing pets and children.
