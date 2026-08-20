# Plant ID TODO

## Next

1. Add Part 3 multi-photo identification sets.
   - Why: current Part 2 Garden photos support saved records, but identification still accepts one photo.
   - Verify: add/remove photo UI, server parsing, and saved-photo reassessment tests.

2. Add AI reassessment history for saved plants.
   - Why: AI ID is separated from Plant Type, but only the current initial assessment is exposed.
   - Verify: data model examples for manual identity, nursery label identity, AI accepted identity, and repeated assessments.

3. Add full personalized care and problem-diagnosis sections to individual plant pages.
   - Why: the Part 2 page is structured for this, but does not yet generate or store care-guide content.
   - Verify: care/diagnosis UI and persistence tests.

## Deferred Implementation

1. Add multi-photo identification sets.
   - Include add/remove photo behavior and clear temporary vs saved flows.

2. Add personalized care and problem-diagnosis guides for saved plants.
   - Use individual environment and history, not only species-level care.

3. Add condensed printable two-sided care sheets.
   - Must not contradict the full record, but does not need full content parity.

4. Add project-specific browser tests for saved flows.
   - Keep generic smoke checks separate from product behavior tests.

5. Resolve canonical Vercel project cleanup.
   - Legacy notes say `plant-care-app` owns `plants.gavinnesom.com`, while a separate `plant-id-starter` Vercel project may also exist.
