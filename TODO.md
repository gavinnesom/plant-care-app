# Plant ID TODO

## Next

1. Add AI reassessment history for saved plants.
   - Why: AI ID is separated from Plant Type, but only the current initial assessment is exposed.
   - Verify: data model examples for manual identity, nursery label identity, AI accepted identity, and repeated assessments.

2. Add full personalized care and problem-diagnosis sections to individual plant pages.
   - Why: the Part 2 page is structured for this, but does not yet generate or store care-guide content.
   - Verify: care/diagnosis UI and persistence tests.

## Deferred Implementation

1. Add personalized care and problem-diagnosis guides for saved plants.
   - Use individual environment and history, not only species-level care.

2. Add condensed printable two-sided care sheets.
   - Must not contradict the full record, but does not need full content parity.

3. Add project-specific browser tests for saved flows.
   - Keep generic smoke checks separate from product behavior tests.

4. Resolve canonical Vercel project cleanup.
   - Legacy notes say `plant-care-app` owns `plants.gavinnesom.com`, while a separate `plant-id-starter` Vercel project may also exist.
