# Plant ID TODO

## Next

1. Decide the exact Supabase schema for My Garden.
   - Why: saved individual plants need durable records, photographs, identity history, recoverable deletion, and timestamps before UI work starts.
   - Verify: schema review plus tests for access boundaries and record lifecycle.

2. Decide owner session lifetime and cookie/security details.
   - Why: My Garden must be private, available on MacBook and phone, and protected server-side.
   - Verify: documented threat model and server-side authorization tests.

3. Decide photograph storage and retention rules.
   - Why: plant records need photos, but storage cost, privacy, deletion, and thumbnails need explicit handling.
   - Verify: storage adapter tests and private URL/access checks.

4. Decide whether AI assessments are single-current or historical.
   - Why: the product direction requires AI assessment to remain distinct from recorded identity; history changes the data model.
   - Verify: data model examples for manual identity, nursery label identity, AI accepted identity, and repeated assessments.

## Deferred Implementation

1. Implement My Garden browsing as a simple card list or grid.
   - Search and filtering remain deferred until the collection is large enough to justify them.

2. Add multi-photo identification sets.
   - Include add/remove photo behavior and clear temporary vs saved flows.

3. Add private owner unlock and server-side authorization.
   - No username, registration, or account-management UI.

4. Add personalized care and problem-diagnosis guides for saved plants.
   - Use individual environment and history, not only species-level care.

5. Add condensed printable two-sided care sheets.
   - Must not contradict the full record, but does not need full content parity.

6. Add project-specific browser tests once saved flows exist.
   - Keep generic smoke checks separate from product behavior tests.

7. Resolve canonical Vercel project cleanup.
   - Legacy notes say `plant-care-app` owns `plants.gavinnesom.com`, while a separate `plant-id-starter` Vercel project may also exist.
