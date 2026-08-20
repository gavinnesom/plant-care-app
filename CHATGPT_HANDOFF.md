# ChatGPT Handoff

## Status

Active.

## Source

ChatGPT review of Codex's blocked production-hotfix work in draft PR #2, followed by Gavin's decision to consolidate Plant ID on the existing Supabase project used by MemoryEngine and Miscellany.

## Objective

Complete the Part 1 production hotfix by replacing the broken Upstash/Vercel KV rate limiter with an isolated Supabase-backed rate limiter in the existing shared Supabase project. Remove Redis and Upstash from Plant ID completely rather than retaining fallback, compatibility, commented, or “just in case” code. Prove the finished hotfix with a real plant identification on the Vercel Preview, then stop for merge authorization.

## Background

Part 1 was released from PR #1 as squash commit `748832ee99a4c2dace8ea0478a332f3805356d53`.

Production identification subsequently failed. Codex diagnosed the actual failing boundary in draft PR #2:

- Branch: `codex/plant-id-production-hotfix`
- Draft PR: `https://github.com/gavinnesom/plant-care-app/pull/2`
- Root cause: the configured Upstash/Vercel KV hostname does not resolve, so rate limiting fails before the OpenAI request.
- `OPENAI_API_KEY` is present; the demonstrated failure was not at the OpenAI boundary.
- The shared core module has already been moved from `api/` to `server/`, removing the unintended Vercel function.
- Sanitized production-safe error logging has been added.
- Unit tests and the frontend build pass, but the real preview identification still returns 500 because of the broken Redis endpoint.

Gavin has chosen not to rebuild Upstash. Plant ID will use the same Supabase project as MemoryEngine and Miscellany because My Garden was already expected to use that project. Plant ID must own clearly isolated database objects and must not alter or depend on MemoryEngine's tables, authentication model, APIs, or domain logic.

Redis contains no valuable Plant ID data; it holds only disposable rate-limit counters. No counter migration or preservation is required.

## Current scope

- Continue on the existing branch `codex/plant-id-production-hotfix` and update draft PR #2; do not create another branch or PR.
- Confirm the working tree and branch are clean and synchronized before continuing. Never discard unexpected work.
- Replace the repository's canonical `CHATGPT_HANDOFF.md` with this handoff. Do not append multiple handoffs or create timestamped repository copies.
- Follow the applicable global, project, and standards instructions naturally.
- Identify the existing Supabase project already used by MemoryEngine and Miscellany through the configured local/project tooling. Do not guess or create a second Supabase project.
- Inspect only enough of the shared project's existing database conventions to avoid collisions and preserve isolation.
- Add a reproducible, tracked Plant ID database migration owned by the Plant ID repository.
- Create the minimum Plant ID-specific table(s), function(s), indexes, grants, and cleanup behavior needed for atomic server-side rate limiting.
- Use a clearly isolated `plant_id` schema when compatible with the current shared-project conventions and API exposure. Otherwise use unmistakably Plant ID-prefixed objects with restrictive grants. Document the chosen boundary.
- Preserve the current externally visible rate-limit policy: per-client protection, a global daily limit, rate-limit responses, retry information, and fail-closed production behavior. Preserve the configured defaults of 15 requests per client per hour and 100 requests globally per day unless an implementation detail requires a documented equivalent.
- Store only the minimum information required for rate limiting. Avoid indefinitely retaining raw client addresses; use bounded retention and cleanup appropriate to the selected design.
- Call the rate-limit operation only from the serverless API using a server-only Supabase secret. Do not expose a Supabase secret or administrative client in the browser bundle.
- Add the required Supabase URL and server-secret variables to the Plant ID Vercel project for Preview and Production, using the current Supabase key convention already supported by the shared project. Do not print or copy secret values into logs, output, source, tests, or documentation.
- Replace the existing Upstash rate-limit implementation completely with the Supabase implementation.
- Remove all active Redis/Upstash packages, imports, initialization, environment-variable fallbacks, configuration examples, tests, and documentation from Plant ID.
- Remove `@upstash/ratelimit` and `@upstash/redis` from both the package manifest and lockfile.
- Remove the obsolete `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`, `KV_REST_API_URL`, and `KV_REST_API_TOKEN` variables from the Plant ID Vercel project after the Supabase preview configuration is in place.
- Disconnect an obsolete Upstash/KV integration from the Plant ID Vercel project if it is clearly scoped to this project and can be disconnected without affecting another application. Do not delete a provider account or shared resource when ownership is uncertain.
- Update tests and project documentation so Supabase is the sole active rate-limit backend and the file map remains accurate.
- Commit and push the completed work to the existing hotfix branch, update draft PR #2, and inspect the resulting Vercel Preview.
- Perform a genuine successful multipart plant-identification POST against the Preview. One OpenAI call for this proof remains authorized.
- Update this handoff's outcome and set its final status to `Implemented` before the final commit or an explicit follow-up documentation commit.
- Stop with a verified draft PR. Do not merge or deploy to production without Gavin's separate authorization.

## Implementation strategy

Keep this as a focused completion of the existing hotfix:

1. Resolve the correct existing Supabase project and its migration/object conventions.
2. Design the smallest atomic PostgreSQL rate-limit operation that preserves the current policy and provides the handler with allowed/denied state, remaining allowance, and reset/retry timing.
3. Commit the schema/function definition as a reproducible Plant ID-owned migration and apply only those Plant ID objects to the shared Supabase project.
4. Replace the handler's Redis rate-limit boundary with the Supabase boundary.
5. Remove Redis/Upstash code, dependencies, variables, compatibility paths, and active documentation completely.
6. Verify unit behavior and the production build.
7. Configure the Plant ID Preview safely and prove a real end-to-end identification.
8. Remove the obsolete Plant ID Redis variables/integration and verify that Redis is no longer required anywhere in the deployed Preview.

Use a single atomic database function or equivalent transaction-safe operation rather than a read-then-write sequence that can exceed limits under concurrency. Keep database-specific code behind a small server-side responsibility boundary rather than spreading Supabase calls through the request handler.

Do not keep Redis as a fallback. If Supabase rate limiting is unavailable in production, fail closed with the existing service-unavailable behavior and sanitized logging.

## Constraints and non-goals

- Do not begin the My Garden feature work beyond the minimal database and server configuration required for rate limiting.
- Do not create saved-plant, photograph, identity, care, unlock-session, or user-account tables in this hotfix.
- Do not alter MemoryEngine or Miscellany tables, migrations, functions, storage, authentication, RLS policies, APIs, code repositories, or application configuration.
- Do not modify the shared Supabase project's existing objects except where a narrowly scoped grant or exposure setting is strictly necessary for the new Plant ID objects. Document any such setting before applying it.
- Do not create another Supabase project.
- Do not retain Redis packages, fallback code, commented code, dormant adapters, unused environment-variable support, or “temporary” compatibility branches.
- Do not change the OpenAI prompt, identification response schema, UI, styling, or product direction.
- Do not weaken or remove rate limiting merely to make the preview succeed.
- Do not expose database secrets, OpenAI credentials, raw environment values, or unnecessarily retained client identifiers.
- Do not delete an Upstash account, database, or possibly shared external resource. Removing Plant ID's obsolete code, variables, and clearly scoped project connection is authorized; broader provider deletion is not.
- Do not push directly to `main`.
- Do not merge PR #2 or trigger a production deployment in this handoff.

## Acceptance criteria

- Supabase is the only active Plant ID rate-limit backend.
- The rate-limit database objects are clearly Plant ID-owned, reproducible from the Plant ID repository, and isolated from MemoryEngine and Miscellany.
- The server-side rate-limit operation is atomic and preserves per-client and global limits with useful remaining/reset information.
- Rate-limit rows have bounded retention or an explicit safe cleanup strategy.
- The Vercel API uses a server-only Supabase secret that is absent from frontend output and repository files.
- `@upstash/ratelimit` and `@upstash/redis` are absent from `package.json` and the lockfile.
- No runtime code supports `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`, `KV_REST_API_URL`, or `KV_REST_API_TOKEN`.
- No Redis fallback, adapter, commented implementation, unused abstraction, or active Redis setup documentation remains.
- The obsolete Redis/KV variables are removed from the Plant ID Vercel Preview and Production configurations after the Supabase variables are configured.
- The intended `api/identify-plant` function remains the only Plant ID API function deployed by Vercel; `/api/plant-identification-core` remains absent.
- Existing tests pass and focused tests cover the new rate-limit boundary and fail-closed behavior without calling the live shared database during the unit suite.
- The frontend production build passes.
- A real multipart identification POST to the Vercel Preview returns HTTP 200 with a valid plant result.
- Draft PR #2 contains the completed hotfix, is pushed and clean, and remains unmerged.
- No MemoryEngine/Miscellany object or behavior changes, main push, or production deployment occur.
- The final handoff status is `Implemented` with an unambiguous outcome.

## Verification

- Record initial and final branch, commit, and `git status --short`.
- Record the Plant ID database objects created and confirm no existing shared-project objects were modified unexpectedly.
- Verify the migration can be applied reproducibly and does not depend on manually created hidden database state.
- Run `npm test`.
- Run `npm run build`.
- Run `git diff --check origin/main...HEAD` after committing.
- Search the manifest, lockfile, runtime source, examples, and active documentation for Redis/Upstash dependencies and configuration. Historical outcome text may state that Redis was removed; no executable or setup path may remain.
- Confirm the built frontend contains no Supabase server secret.
- Inspect the Vercel Preview's functions and routes.
- Confirm the Preview homepage returns 200.
- Confirm a non-POST request to `/api/identify-plant` returns the expected 405.
- Confirm `/api/plant-identification-core` returns 404 and is not deployed as a function.
- Make one real multipart POST with a non-sensitive plant image and confirm HTTP 200 with a valid `result`.
- Verify the database rate-limit counters were updated by that request without printing a raw client identifier.
- Confirm the obsolete Redis/KV variables are absent from the Plant ID Vercel project and the Supabase variables have the intended Preview/Production scopes.
- Confirm final `git status --short` is clean after committing and pushing.
- Report the commit SHA, changed files, exact check results, draft PR URL, Preview URL, database objects, environment-variable names/scopes, deployed functions, and real POST result.

## Assumptions and open questions

- The existing shared Supabase project is active and accessible through Gavin's configured tooling.
- The shared project has enough free-plan capacity for this negligible additional rate-limit traffic.
- The Plant ID Vercel project can receive server-only Supabase configuration without changing MemoryEngine or Miscellany deployments.
- A current Supabase server secret can be used or created without rotating keys used by other projects. If doing so would require rotating or revoking an existing shared key, stop and request authorization.
- If the existing shared project has no safe migration ownership convention, choose and document a minimal Plant ID-owned migration location rather than editing another repository.
- If applying the migration or configuring Vercel requires broader changes than the Plant ID-specific objects and variables authorized here, stop and report the exact blocker.

## Codex implementation outcome

To be completed by Codex. Include:

- final status and date;
- branch, commit SHA, draft PR URL, and Preview URL;
- Plant ID database objects created and migration path;
- confirmation that MemoryEngine and Miscellany objects were not modified;
- Redis/Upstash packages, code, variables, documentation, and project connection removed;
- Supabase environment-variable names and scopes, without values;
- test, build, diff, secret-scan, and Git-status results;
- deployed route/function inspection;
- real Preview identification status and high-level result;
- confirmation that no merge, main push, production deployment, provider-account deletion, or unauthorized shared-project change occurred;
- any warnings or blockers remaining.
