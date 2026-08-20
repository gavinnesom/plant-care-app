# Plant ID Design

## Architecture

Plant ID is a Vite/React frontend with Vercel serverless routes and private PostgreSQL persistence in the isolated `plant_id` schema.

The frontend is split by workflow. `App.jsx` owns only mode and unlock transitions. Identify owns temporary photo selection and its abortable request. Garden owns saved-record state and API transitions; its view module renders Garden, Grow, plant identity, care, observations, and diagnosis.

Server ownership follows the domain:

- identification core: public/saved plant vision and validated identification shape;
- Garden AI core: structured care and diagnosis generation;
- plant store: plant metadata and current aggregate;
- photo store: purpose-aware private image bytes;
- record store: durable assessments, care guides, observations, and diagnoses;
- migrations: all schema evolution.

## Photo Model

A photo belongs to one plant and has a purpose:

- `identity_reference`: evidence for “What plant is this?”;
- `observation_problem`: evidence for “What is happening to this plant?”;
- `progress_history`: reserved so a future history feature does not require another role-model rewrite.

There is no five-photo lifetime cap on a saved plant. Five is the maximum selected for one AI request.

Identify/Re-identify accepts only explicitly selected identity/reference photos. Diagnosis prioritizes photos linked to the selected observations and fills any remaining request slots only with deliberately selected identity/reference photos. Care may use deliberately selected identity/reference photos. No AI task receives the entire saved library automatically.

Only identity/reference photos can become the plant’s primary list/detail image.

## Durable Records

The plant row retains current identity fields for efficient display and points to the latest AI assessment, care guide, and diagnosis. Each generation is also an immutable domain record with a timestamp, structured result, context snapshot, model, schema version, prompt version, and associated photos where applicable.

Observations are distinct dated records. A diagnosis may reference one or more observations and the bounded photo set actually sent. Historical records persist even though Part 4 exposes only current results in the main UI.

## Identity Truth

Plant Type is Gavin’s recorded identity. AI ID is the model’s current assessment. `identity_source` distinguishes `manual`, `ai_accepted`, and `label_confirmed`.

AI may initialize an empty Plant Type but never overwrites a non-empty Plant Type during reassessment. A manual Plant Type change changes provenance to manual unless Gavin explicitly selects another truthful source.

## Request Boundaries

- Public identification is multipart, rate-limited before expensive work, and bounded by member count, member size, and aggregate size.
- Saved photo persistence uploads one bounded multipart image at a time; metadata JSON remains small.
- All Garden routes and private photo bytes require the signed owner session.
- Relevant photo controls are disabled while Garden AI work is active.
- Temporary identification uses abort and sequence identity so a late result cannot attach to a changed photo set.
- Normal request paths contain no DDL.

## Rate Limiting

Public fixed-window counters live in `plant_id.rate_limit_buckets`. A request increments and checks its client bucket first. A client already over its own limit returns before the global bucket is incremented. Production fails closed if the database limit boundary is unavailable.

## Safety

Plant identification and diagnosis are advisory. Structured prompts require uncertainty, alternatives, reversible actions, and relevant pet/child/toxicity or urgent safety notes. The UI keeps confidence visible without making normal garden guidance alarmist.

## Plant Record and Print

The saved-plant screen is one vertical record ordered as Identity, Care Guide, Problems/Observations, then Diagnosis/Remediation. Section styling may differ, but reading order and semantics remain stable across desktop and mobile.

The print view reads Plant Name, Plant Type/AI ID, current reference photos, current care guide, observations, and current diagnosis from the same plant aggregate. It renders a condensed two-page Letter portrait care sheet: identity and care on the front, problems and actions on the back. It does not create a second care or diagnosis model.

## Recovery

Plant deletion is a soft delete. Recently deleted records are listed separately and can be restored without changing their photos or durable records. Permanent deletion is intentionally not exposed in the current UI.
