# Plant ID Codemap

## Start Here

- Product direction: `README.md`
- Current status and verified commands: `PROJECT_STATUS.md`
- Architecture and invariants: `DESIGN.md`
- Active handoff: `CHATGPT_HANDOFF.md`
- Main UI flow: `src/App.jsx`
- Serverless identification API: `api/identify-plant.js`

## Primary Flow

```mermaid
flowchart TD
  A[UploadPanel selects one image] --> B[App validates file]
  B --> C[FormData POST to /api/identify-plant]
  C --> D[API checks rate limits]
  D --> E[API parses multipart image]
  E --> F[OpenAI Responses vision call]
  F --> G[Extract and validate plant JSON]
  G --> H[ResultPanel renders care card]
  H --> I[Add to Garden opens unlock/Grow flow]
  I --> J[Authorized Garden API saves plant/photo]
```

## Repository Map

| Path | Responsibility |
|---|---|
| `README.md` | Current purpose, approved product direction, setup, Vercel, rate limiting, safety |
| `AGENTS.md` | Project-specific Codex rules and commands |
| `PROJECT.md` | Vision, current milestone, users, principles, non-goals |
| `DESIGN.md` | Architecture, data flow, invariants, future model direction |
| `PROJECT_STATUS.md` | Durable verified state and limitations |
| `TODO.md` | Deferred work and decisions |
| `CHATGPT_HANDOFF.md` | Ignored local ChatGPT-to-Codex coordination scope and outcome |
| `src/App.jsx` | Page shell and upload-to-result state machine |
| `src/components/UploadPanel.jsx` | File input, drag/drop, client image validation, preview |
| `src/components/ResultPanel.jsx` | Loading, empty, warning, result, alternatives, care details |
| `src/components/TraitBadge.jsx` | Care enum display metadata |
| `src/components/CareIcon.jsx` | Inline SVG care icons |
| `src/lib/plantSchema.js` | Frontend schema constants and trait copy |
| `src/index.css` | Tailwind import and app color variables |
| `api/identify-plant.js` | Serverless API orchestration, rate limiting, OpenAI call, response |
| `api/garden-session.js` | Owner unlock and Garden session status |
| `api/garden-plants.js` | Authorized Garden list/create |
| `api/garden-plants/[id].js` | Authorized individual plant read/edit |
| `api/garden-photos/[id].js` | Authorized private photo bytes |
| `server/plant-identification-core.js` | Multipart image extraction, model JSON extraction, normalized result validation |
| `server/db.js` | Shared Postgres pool |
| `server/garden-session.js` | Server-only owner key and signed 30-day session cookie boundary |
| `server/garden-store.js` | Garden plant and private photo persistence |
| `server/rate-limit.js` | Server-only Supabase-backed rate-limit boundary |
| `supabase/migrations/202608200001_plant_id_rate_limits.sql` | Isolated Plant ID schema, table, cleanup index, and atomic rate-limit function |
| `supabase/migrations/202608200002_plant_id_private_garden.sql` | Isolated Garden plant and photo tables |
| `tests/identify-plant.test.cjs` | Unit tests for identification helper behavior |
| `tests/garden.test.cjs` | Unit tests for Garden session and storage helper behavior |

## How To Change

| If you want to... | Start in... | Then inspect... | Verify with... |
|---|---|---|---|
| Change current upload validation | `src/components/UploadPanel.jsx` | `src/lib/plantSchema.js`, `api/identify-plant.js` | `npm test`, `npm run build` |
| Change result fields or care sections | `server/plant-identification-core.js` | `api/identify-plant.js`, `src/components/ResultPanel.jsx`, `src/lib/plantSchema.js` | `npm test`, `npm run build` |
| Change OpenAI prompt or model behavior | `api/identify-plant.js` | `README.md`, `DESIGN.md` | `npm test`, manual `npx vercel dev` check with credentials |
| Change rate limiting | `server/rate-limit.js` | `api/identify-plant.js`, `supabase/migrations/` | `npm test`, `npm run build`, Vercel preview POST |
| Change My Garden persistence or saved-photo behavior | `server/garden-store.js` | `api/garden-plants.js`, `api/garden-plants/[id].js`, `api/garden-photos/[id].js`, Supabase migrations | `npm test`, `npm run build`, preview Garden smoke |
| Add project-specific browser tests | new `playwright.config.*` | `tests/e2e/`, README commands | project Playwright command |
| Update deployment setup | `README.md` | `PROJECT_STATUS.md`, `.env.example` | `npm run build` and Vercel preview checks |

## Verification Entry Points

```bash
npm test
npm run build
npx vercel dev
```

`npx vercel dev` requires local environment variables for real identification and serves the serverless API route. `npm run dev` is frontend-only.
