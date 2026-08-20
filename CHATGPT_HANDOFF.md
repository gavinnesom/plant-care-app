# Plant ID — Part 2 Codex Handoff

## Status

Implemented.

## Source

ChatGPT product/design planning with Gavin after completion of Plant ID Part 1.

## Part 1 release baseline

Part 1 is complete and released.

- Repository: `gavinnesom/plant-care-app`
- Local repository: `/Users/gavinnesom/Code/plant-id-starter`
- Production: `https://plants.gavinnesom.com`
- PR #2: `Replace Plant ID Redis rate limiting with Supabase`
- Squash commit on `main`: `91c2ea168cbf13b859938d5db5c07331263ef3d3`
- Vercel production deployment is Ready.
- Production homepage returns `200`.
- `GET /api/identify-plant` returns `405` with `Allow: POST`.
- The obsolete helper route returns `404`.
- A real production Cordyline identification has succeeded with `200`, a valid identification result, and rate-limit headers.
- Local `main` matches the released squash commit and the working tree is clean.
- Redis/Upstash has been removed from Plant ID.
- Plant ID now uses the existing shared GavinApps Supabase project for an isolated Supabase/Postgres rate limiter.
- Only `SUPABASE_DB_URL` is used by the current rate limiter; the unused `SUPABASE_URL` configuration was removed.

Do not revisit Part 1 unless the current repository state reveals an actual regression.

## Objective

Implement and release **Part 2 — Private My Garden foundation** as one coherent milestone.

Part 2 should create the secure, durable personal-garden skeleton that later parts will extend. It should also give Plant ID a first-pass warmer visual identity.

This is intended to be one substantial Codex assignment, not a sequence of routine approval checkpoints. Use normal engineering judgment for implementation details, Git mechanics, testing, PR management, Vercel deployment, and safe Supabase setup. Stop only for a genuine blocker, unexpected destructive/security-sensitive operation, unexpected local work that could be overwritten, or a material product decision not resolved below.

Do **not** begin Parts 3–5.

## Product direction

Plant ID is becoming Gavin's personal garden field guide while retaining the existing public temporary-identification feature.

Saving is optional. A saved record represents an **individual physical plant**, not merely a species.

My Garden is private to Gavin but must work on both his MacBook and phone.

There is no user-registration/account-management system. My Garden uses one fixed owner key/passphrase and secure long-lived per-device sessions.

## Part 2 user experience

### 1. Identify page

Preserve the existing identification workflow.

After a successful plant identification, add a small, unobtrusive **Add to Garden** action.

Add a small Cordyline/plant icon in a consistent navigation position. It represents **My Garden**.

- If the browser/device has a valid Garden session, clicking the Cordyline opens My Garden directly.
- If there is no valid session, clicking it asks for the owner key and then opens My Garden after successful unlock.
- If **Add to Garden** is clicked without a valid Garden session, unlock first and then continue into the pre-populated Grow form rather than losing the identification.

Do not turn this into a large navigation bar.

### 2. My Garden

After unlock, show a simple responsive tiled/gallery layout of saved plants.

Each plant tile should show, when available:

- photo;
- required garden/personal name;
- location;
- Plant Type.

Gavin expects a small garden, roughly fewer than 25 plants. Do not add search, filtering, pagination, or other premature collection-management UI.

The Garden page should have a clear **Grow** action for creating a new garden plant.

In the exact same navigation position used for the Cordyline icon on the Identify page, show a **camera icon** that returns to the Identify page.

The Cordyline and camera controls should have the same size/visual treatment and feel like a mirrored two-mode navigation convention:

- Identify page: Cordyline → My Garden
- Garden page: Camera → Identify Plant

### 3. Grow form

There is one Grow form, reached in two ways.

#### From My Garden

Clicking **Grow** opens a new mostly empty garden entry.

Minimum user-facing fields:

- **Garden Name** — required.
- **Location** — optional free text, e.g. `on the patio` or `by the shed`.
- **Plant Type** — editable.
- **AI ID** — separately visible and not editable as if it were Gavin's recorded identity.
- **Photo** — optional in Part 2.

A manually created plant may have no photo and no AI assessment. In that case display/store the AI state as **No guess**.

#### From an identification

Clicking **Add to Garden** after a successful identification opens the same Grow form, pre-populated from the current identification:

- current image;
- AI identification as **AI ID**;
- **Plant Type** initially copied from the AI ID.

Gavin can change Plant Type before saving.

### 4. Plant Type versus AI ID

This distinction is important and must exist from the beginning.

- **AI ID** means what the AI currently thinks the plant is.
- **Plant Type** is the identity recorded for and used by the saved garden plant.
- On an AI-created record, Plant Type initially comes from AI ID.
- Gavin may override Plant Type whenever he knows better.
- Changing Plant Type must not change AI ID.
- A later AI reassessment must not silently overwrite a Plant Type Gavin has deliberately corrected.
- A manually created plant with no AI assessment has **AI ID: No guess**.

Example:

- AI ID: `Cordyline australis`
- Plant Type: `Festival™ Raspberry Cordyline`

Persist enough provenance to preserve this separation cleanly for Part 3. Do not collapse the two identities into one database field merely because Part 2 only has one-photo identification.

### 5. Individual plant page

Clicking a Garden tile opens that individual plant.

Build this as the beginning of the eventual long-form plant record rather than as a disposable temporary screen.

For Part 2, the top of the page should show the useful saved identity information:

- photo;
- Garden Name;
- Location;
- Plant Type;
- AI ID;
- an appropriate Edit action.

The eventual product will continue below this with:

1. sunlight/water/general care;
2. observations and problem diagnosis;
3. likely causes and practical actions.

Those care and diagnosis features are primarily Part 4 and should **not** be implemented now. However, structure the page/components/data boundaries so Part 4 can extend the same page naturally rather than replacing it.

Do not expose developer-facing placeholder text such as `Care guide coming in Part 4` in the production UI.

## Privacy and unlock behavior

My Garden is owner-only.

Use one fixed owner passphrase/key stored as a **server-side secret**. It must never be hardcoded in frontend code or committed to Git.

A successful unlock should create a secure session lasting **30 days on that browser/device**.

Expected behavior:

- MacBook and phone have independent sessions.
- Closing/reopening the browser does not lock the Garden.
- After 30 days, Garden access requires the owner key again.
- Clearing browser/site data naturally removes the session.
- No visible **Lock Garden** / logout feature is required in Part 2.
- There is no normal Supabase Auth username/password UI.

Every private Garden read/write and private-photo operation must be authorized on the server. A hidden client-side control or frontend password comparison is not security.

Choose an appropriate secure session implementation. Prefer ordinary web security practices such as secure server-issued session state/cookies; do not expose the owner key or signing material to the client.

## Supabase and data isolation

Reuse Gavin's existing shared GavinApps Supabase project.

Plant ID must own clearly isolated Plant ID objects and must not modify or depend on MemoryEngine or Miscellany tables, authentication, APIs, storage, or domain behavior.

Extend the existing isolated Plant ID database area rather than creating cross-app coupling.

Create a clean persistence boundary for individual garden plants and their photos that later Parts 3 and 4 can extend.

The minimum saved plant model must support at least:

- stable plant ID;
- Garden Name;
- Location;
- Plant Type;
- separate AI ID / AI assessment state;
- created timestamp;
- modified timestamp;
- recoverable-deletion state such as `deleted_at`;
- association with zero or more photographs, even if the Part 2 UI only needs one primary/current photo.

Use **private Supabase photo storage**, not public image URLs.

Part 2 does not need a polished restore/trash UI, but the data model should use soft/recoverable deletion rather than making ordinary deletion irreversibly destructive.

Do not modify the existing Plant ID rate-limiter behavior except where a small shared infrastructure change is genuinely required by the new Garden backend.

## Photo scope

Part 2 only needs enough photo support to make the Garden foundation real:

- save the current identification image when an identified plant is added to the Garden;
- allow a new manual plant to have no photo;
- an optional single-photo path for a manually created plant is acceptable/useful;
- store photos privately and associate them with the saved individual plant.

Do not implement the full Part 3 multi-photo identification workflow, image-set editing, repeated AI reassessment flow, or AI-history UX.

Design the persistence/storage boundary so Part 3 can add multiple photos without replacing Part 2's storage model.

## First-pass visual refresh

The current app was forced into the portfolio's existing stark dark visual treatment. Gavin finds it too stark/dystopian for a plant-care app.

Part 2 should include a **first-pass visual refresh** across the existing Identify page and the new Garden/Grow/plant screens.

This is not expected to be the final visual design. It can be refined during Parts 3, 4, and 5.

Direction:

- an established, slightly wild garden rather than a sleek tech dashboard;
- warmer and more natural;
- inspiration: overgrown meadows, old gnarly trees, blackberry brambles, plum trees/fruit;
- warm off-whites and natural/vegetation tones are appropriate;
- restrained earth/bark and blackberry/plum accents are welcome;
- avoid becoming twee, cartoonish, overloaded with leaf decorations, or visually busy;
- preserve professional typography, spacing, responsiveness, accessibility, and component discipline.

Across Gavin's portfolio, the goal is **shared design discipline, not identical skins**. Plant ID may have its own personality.

Use judgment. Do not block on Gavin choosing exact hex colors, radii, fonts, or decorative details. Produce a coherent first pass that can be reacted to and refined later.

## Technical/architecture expectations

Follow the repository's current instructions and Gavin's installed/global standards naturally.

Preserve the current public temporary-identification behavior.

Keep server-only secrets and database credentials out of the client bundle.

Use clear server-side authorization boundaries for all Garden operations.

Factor the new Garden persistence/session/photo behavior cleanly so future Parts 3 and 4 can extend it.

Avoid unnecessary dependencies, compatibility layers, speculative abstractions, or duplicate workflows.

Use the same Grow creation path whether entry begins from My Garden or from an identification.

Keep the implementation understandable enough that the canonical project docs and codemap can accurately describe it.

## Git / PR / release workflow

Implement Part 2 on one appropriate working branch and one PR.

Use a descriptive branch name such as:

`codex/plant-id-private-garden-foundation`

Use the existing repository state as the source of truth. If a similarly appropriate Part 2 branch already exists, inspect it before creating another one.

During this assignment:

1. Inspect the current repository and applicable project/global instructions.
2. Implement the complete bounded Part 2 milestone.
3. Add/update database migration/setup material for the isolated Plant ID Supabase objects and private storage.
4. Add appropriate automated tests for the new security, persistence, and core UI/data behavior.
5. Run the appropriate tests/build/diff/static checks.
6. Exercise the feature in Vercel Preview, including the private unlock and Garden flow.
7. Update the repository's canonical `CHATGPT_HANDOFF.md`, `PROJECT_STATUS.md`, `CODEMAP.md`, `TODO.md`, README/setup documentation, and other project docs where the implementation changes their truth.
8. Open/finalize the Part 2 PR with a useful title and description.
9. If Preview and checks are healthy, squash-merge the PR into `main`.
10. Allow Vercel to deploy the released commit.
11. Perform sensible production smoke verification of the Part 2 flow.
12. Fast-forward local `main` to the released squash commit and finish with a clean working tree.
13. Report the final released state once.

This handoff authorizes the routine branch/PR/squash-merge/Vercel-release operations required to finish Part 2. Do not stop merely to ask permission for ordinary GitHub, Vercel, documentation, testing, or implementation sequencing choices.

If production verification requires creating one small test garden record, use judgment and clean up the test record if that can be done safely. Do not perform unnecessary paid OpenAI requests if the existing identification path does not need to be re-proven.

## Acceptance criteria

Part 2 is complete only when the released app provides the following end-to-end behavior:

- Existing public plant identification still works.
- Identify page has the unobtrusive **Add to Garden** action after a successful ID.
- Identify page has the Cordyline/My Garden navigation icon.
- A non-authorized device/browser is prompted for the owner key.
- Successful unlock establishes a secure 30-day per-device/browser session.
- An authorized device can reopen My Garden without re-entering the key during that period.
- Private Garden APIs/data/photos are server-authorized.
- My Garden is persisted in isolated Plant ID Supabase objects.
- Garden tiles show the appropriate photo/name/location/Plant Type data.
- **Grow** creates a new individual garden plant.
- Manual plants may be saved without a photo and show **AI ID: No guess**.
- **Add to Garden** from an identification enters the same Grow flow with the image, AI ID, and initial Plant Type populated.
- Plant Type can be manually changed without changing AI ID.
- Clicking a Garden tile opens the individual plant page.
- The individual page shows the saved identity/photo information and can be edited.
- The Garden page has the camera/Identify control in the same location as the Cordyline control on the Identify page.
- Photos are stored privately.
- The persistence model supports recoverable deletion and future multiple photos.
- No search/filter UI is introduced.
- No Part 3 multi-photo identification workflow is implemented.
- No Part 4 care/diagnosis system is implemented yet.
- The app has a coherent first-pass warmer garden visual identity.
- Tests/build/checks pass.
- The Part 2 PR is squash-merged, Vercel production is healthy, local `main` matches the released commit, and the working tree is clean.
- The canonical repository `CHATGPT_HANDOFF.md` is updated to `Implemented` with the actual Part 2 outcome.

## Stop conditions

Do not stop for normal implementation choices.

Stop and report the exact boundary only if you encounter something genuinely significant, for example:

- a security design problem that cannot be resolved safely within the decisions above;
- a Supabase migration/storage operation that risks unrelated GavinApps data;
- an unexpected destructive operation;
- unexpected local/repository work that could be overwritten;
- a material product decision not covered here;
- a failing Preview/production deployment that requires substantial unplanned redesign;
- a provider/account limitation that prevents the intended secure implementation.

If ordinary bugs, tests, CSS problems, migration mistakes, or routine deployment issues arise, diagnose and fix them as part of this assignment rather than turning them into another approval round trip.

## Non-goals

Do not implement:

- multi-photo selection/removal before AI identification;
- AI reassessment from multiple saved photos;
- historical AI-assessment UX;
- full care-guide generation/personalization;
- problem observation/diagnosis/action workflows;
- laminated print/PDF guide;
- search/filtering for My Garden;
- conventional multi-user accounts or Supabase Auth UI;
- a visible Lock Garden/logout feature;
- direct Miscellany integration;
- unrelated cleanup in MemoryEngine, Miscellany, or other GavinApps systems.

Those belong to later parts or are explicitly deferred.

## Codex implementation outcome

Implemented on 2026-08-20 before Part 2 merge.

- Branch: `codex/plant-id-private-garden-foundation`.
- Draft PR: `https://github.com/gavinnesom/plant-care-app/pull/3`.
- Implementation commit: `ca089e3c38a3a4b51993e70034676f1885ba04c4`.
- Added private My Garden foundation with owner-key unlock, signed 30-day session cookies, Garden gallery, Grow form, Add to Garden from identification, individual plant detail/edit page, and mirrored Cordyline/camera mode controls.
- Added authorized server endpoints: `api/garden-session.js`, `api/garden-plants.js`, `api/garden-plants/[id].js`, and `api/garden-photos/[id].js`.
- Added server boundaries: `server/db.js`, `server/garden-session.js`, and `server/garden-store.js`.
- Added migration `supabase/migrations/202608200002_plant_id_private_garden.sql` for `plant_id.garden_plants`, `plant_id.garden_photos`, active indexes, and update triggers.
- Applied the migration to the shared GavinApps Supabase project; only `plant_id` objects were created/inspected.
- Added server-only Vercel Preview/Production env vars `PLANT_ID_OWNER_KEY` and `PLANT_ID_SESSION_SECRET`. Values were not printed or committed. A generated local copy exists in ignored `.env.local` for Gavin's machine.
- Preserved the public one-photo identification flow and added the unobtrusive `Add to Garden` result action.
- Persisted AI ID separately from editable Plant Type; manual plants use AI state `none` / `No guess`.
- Stored saved photos privately in Plant ID-owned Supabase/Postgres rows and served them only through the authorized photo API.
- Added a first-pass warmer garden visual refresh using bark, moss, leaf, off-white, gold, and plum tones.

Verification before merge:

- `npm test`: pass, 14 tests.
- `npm run build`: pass; existing Vite CJS and stale Browserslist warnings only.
- `git diff --check`: pass.
- API module load check: pass.
- Vercel environment names confirmed: `OPENAI_API_KEY`, `SUPABASE_DB_URL`, `PLANT_ID_OWNER_KEY`, and `PLANT_ID_SESSION_SECRET`.
- Preview deployment `https://plant-care-7xj9zuaj9-gavins-projects-a20eaba9.vercel.app`: Ready.
- Preview functions: `api/identify-plant`, `api/garden-session`, `api/garden-plants`, `api/garden-plants/[id]`, and `api/garden-photos/[id]`.
- Preview smoke: homepage `200`, locked Garden list `401`, unlock `200`, session check `200`, manual no-guess plant create `201`, AI/photo plant create `201`, Garden list `200`, private photo fetch `200`, old helper route `404`.
- Preview test records named `Part 2 Preview Manual` and `Part 2 Preview Cordyline` were soft-deleted after verification.

Production verification is intentionally not recorded here because it occurs after this committed handoff update, PR squash merge, and Vercel production deployment.
