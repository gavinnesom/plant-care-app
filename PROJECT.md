# Plant ID Project

## Vision

Plant ID is becoming Gavin's personal garden field guide. It should identify plants from photographs and, when Gavin chooses, save individual plants into My Garden with a garden name, location, recorded identity, AI assessment, care history, and personalized problem-diagnosis guide.

## Background

The app began as a polished one-photo plant-identification demo. It already has a working upload flow, Vercel serverless API route, OpenAI vision call, response validation, uncertainty messaging, and rate limiting. The approved README now expands the direction from a temporary identification card to private saved plant records.

## Users and Contexts

- Gavin can use temporary identification on desktop or phone.
- Gavin can later unlock private My Garden on his MacBook and phone.
- Public visitors may use temporary identification but must not view or modify My Garden.

## Current Milestone

The current milestone is standards foundation only: document the project accurately, preserve the current identification app, and add a small unit-test foundation.

## Current Non-Goals

This milestone does not implement My Garden, Supabase persistence, owner unlocking, multi-photo identification, saved plant records, print/PDF output, search, filtering, or Miscellany integration.

## Product Principles

- Identification can be temporary; saving requires an explicit user choice.
- My Garden is a collection of individual plants, not only species.
- A saved plant requires only a garden name.
- Recorded identity and AI assessment must remain visibly distinct.
- Manual or nursery-supplied identity must not block requesting an AI assessment.
- Private garden reads, writes, and photograph requests must be authorized server-side when implemented.

## Approved Future Direction

My Garden is private and intended only for Gavin. It will use one fixed owner passphrase, no username or registration interface, a server-side passphrase secret, and a long-lived secure device session. Plant ID is expected to reuse the existing GavinApps Supabase project with separate Plant ID tables and private photograph storage. It must not use or modify MemoryEngine tables, API, authentication, or domain model. Deletion should initially be recoverable with useful creation and modification timestamps retained.

## Success Criteria

- Current temporary identification remains useful and safe.
- Project documents describe actual code and approved direction without pretending deferred features exist.
- The next implementation pass can start from documented architecture, commands, risks, and decisions.
