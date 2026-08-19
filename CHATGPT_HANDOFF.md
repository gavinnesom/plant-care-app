# ChatGPT Handoff

## Status

Active.

## Source

ChatGPT product planning with Gavin, following Codex's read-only Plant ID standards audit on 2026-08-18.

## Objective

Adopt Gavin's standard project structure, record the approved Plant ID direction, and fix small foundational audit gaps without implementing My Garden or other new product features.

## Background

The working tree contains Gavin's approved, uncommitted `README.md` update describing Plant ID's move from a one-shot identification demo toward an optional personal garden field guide. Preserve that change.

The audit found that the current identification flow is coherent and the server-side validation, OpenAI handling, uncertainty handling, and rate limiting are sensible. It also found missing standard project documents, no project-local tests, an unclear Vercel CLI prerequisite, and some current logic that may benefit from limited factoring to become testable.

Additional approved direction not yet recorded in the project:

- My Garden is private and intended only for Gavin.
- The same garden must be available on Gavin's MacBook and phone.
- Public visitors may use temporary identification but cannot view or modify My Garden.
- My Garden will use one fixed owner passphrase, with no username, registration, or account-management interface.
- The passphrase must be a server-side secret, never repository or frontend code.
- Unlocking will create a long-lived secure device session.
- Every private garden read, write, and photograph request must be authorized server-side.
- Plant ID will reuse the existing GavinApps Supabase project as infrastructure, while owning separate Plant ID tables and private photograph storage.
- Plant ID must not use or modify MemoryEngine's tables, API, authentication, or domain model.
- Garden deletion should initially be recoverable, with useful creation and modification timestamps retained.

These are architectural intentions for the project documents, not authorization to implement them in this handoff.

## Current scope

- Work only in `/Users/gavinnesom/Code/plant-id-starter`.
- Follow the applicable Codex and project instructions naturally.
- Preserve the expected starting change: ` M README.md`. If other unexpected working-tree changes exist, stop and report them.
- Create a dedicated branch while carrying the README change forward; suggested name: `codex/plant-id-standards-foundation`.
- Adopt and truthfully populate the canonical project documents using repository evidence and the completed audit.
- Use this file as the active `CHATGPT_HANDOFF.md` and record the implementation outcome below.
- Preserve useful information from the ignored legacy `HANDOFF.md`; do not discard it silently.
- Clarify verified setup, run, verification, and Vercel CLI prerequisite information.
- Add a small project-local unit-test setup and meaningful tests for existing validation, schema normalization, or API helper behavior where practical.
- Make only limited, behavior-preserving factoring required for coherent testing and readability.
- Apply Gavin's narrative commenting and responsibility-boundary standards only to code materially touched.
- Run appropriate tests and the production build.
- Commit the scoped work, push the branch, and open a draft pull request.

## Implementation strategy

Use the audit as evidence, then verify facts against the repository before documenting or changing them. Keep the current technology stack and user-visible behavior intact.

Prefer small coherent extractions of existing logic over speculative abstractions. Add only the minimum useful test tooling. Do not add project-specific browser tests unless a concrete current behavior justifies them in this pass.

Create sensible commits on the dedicated branch. A Vercel Preview deployment triggered automatically by the branch push is allowed. Stop after opening the draft pull request; do not merge it.

## Constraints and non-goals

- Do not implement My Garden, Supabase persistence, database migrations, photograph storage, owner unlocking, secure cookies, multiple-image identification, saved plant records, PDF output, Miscellany integration, search, or filtering.
- Do not migrate frameworks or perform broad architectural refactoring.
- Do not create future-feature abstractions merely to resemble the planned design.
- Do not change the current visual design or intended user behavior.
- Do not modify MemoryEngine, Gavin's standards repository, or anything outside the Plant ID repository.
- Do not push directly to `main`, merge the pull request, deploy to production, or change production environment variables or external data.
- Do not add comments or formatting churn to otherwise untouched code.

## Acceptance criteria

- The approved README change is preserved.
- All canonical project documents exist and accurately distinguish current reality, approved direction, current milestone, and deferred work.
- The active handoff contains Codex's completed implementation outcome.
- Setup and verification instructions are accurate and copyable.
- A small useful unit-test foundation exists and passes.
- The production build passes.
- Any code factoring is limited, justified, tested, and behavior-preserving.
- No My Garden, Supabase, authentication, multiple-image, or print feature implementation has begun.
- The work is committed on a dedicated branch, pushed, and presented in a draft pull request.
- No merge or production deployment occurs.

## Verification

- Record starting and ending `git status --short`.
- Run the new unit-test command.
- Run `npm run build`.
- Run any additional existing non-destructive checks that become relevant, and report exact results.
- Confirm the final diff contains only authorized project changes.
- Report the branch, commits, draft PR URL, changed files, check results, deferred work, and any automatically created Vercel Preview.

## Assumptions and open questions

- The only expected starting working-tree change is `README.md`; stop if that assumption is false.
- Exact Supabase schema, session lifetime, photograph retention, and AI-assessment history remain undecided and must not be invented or implemented here.
- If a proposed audit fix would change product behavior or require a broad refactor, defer it to `TODO.md` with a reason and verification approach.

## Codex implementation outcome

Implemented by Codex on 2026-08-19.

Branch: `codex/plant-id-standards-foundation`

Draft PR: `https://github.com/gavinnesom/plant-care-app/pull/1`

Starting `git status --short` was:

```text
 M README.md
```

Changed files:

- `README.md`: preserved the approved product direction and clarified the Vercel CLI prerequisite.
- `AGENTS.md`: added project-specific Codex rules, commands, invariants, and scope boundaries.
- `PROJECT.md`: recorded vision, users, current milestone, non-goals, principles, and approved future direction.
- `DESIGN.md`: documented current architecture, data flow, module responsibilities, invariants, and future data-model direction.
- `CODEMAP.md`: documented entry points, primary flow, repository map, change map, and verification commands.
- `PROJECT_STATUS.md`: recorded durable current state, verified commands, environment/deployment facts, decisions, and limitations.
- `TODO.md`: recorded deferred My Garden, persistence, owner session, photo storage, browser testing, and Vercel cleanup work.
- `CHATGPT_HANDOFF.md`: added this active handoff and implementation outcome.
- `.gitignore`: stopped ignoring canonical `CHATGPT_HANDOFF.md` while preserving ignored legacy `HANDOFF.md`.
- `package.json`: added `npm test`.
- `api/identify-plant.js`: kept behavior unchanged and exposed a small `_test` helper surface for existing API helper tests.
- `tests/identify-plant.test.cjs`: added Node unit tests for JSON extraction, multipart image parsing, result normalization, and required-section rejection.

Verification:

```text
npm test
```

Passed: 4 tests, 0 failures.

```text
npm run build
```

Passed. Vite reported two warnings: its CJS Node API build is deprecated, and Browserslist/caniuse-lite data is 13 months old.

```text
git diff --check
```

Passed with no whitespace errors.

No My Garden, Supabase, owner unlocking, multi-photo identification, saved plant records, print/PDF output, search, filtering, MemoryEngine changes, production environment changes, merge, or production deployment was performed.

Deferred work and undecided product/architecture choices were moved into `TODO.md`; durable verified facts were moved into `PROJECT_STATUS.md`.

Ending `git status --short` after the scoped commit and push was clean except for this amended handoff outcome update, which was folded into the same branch commit and force-pushed to update the draft PR.
