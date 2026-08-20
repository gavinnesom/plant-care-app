# Plant ID Project

## Vision

Plant ID is becoming Gavin's personal garden field guide. It should identify plants from photographs and, when Gavin chooses, save individual plants into My Garden with a plant name, location, recorded identity, AI assessment, care history, and personalized problem-diagnosis guide.

## Background

The app began as a polished one-photo plant-identification demo. It now has a working multi-photo upload flow, Vercel serverless API routes, OpenAI vision calls, response validation, uncertainty messaging, rate limiting, and a private saved Garden foundation.

## Users and Contexts

- Gavin can use temporary identification on desktop or phone.
- Gavin can unlock private My Garden on his MacBook and phone.
- Public visitors may use temporary identification but must not view or modify My Garden.

## Current State

Part 5 completes the saved-plant experience: each plant is a readable vertical record with durable AI identity assessments, purpose-aware photos, personalized care guides, dated observations, problem diagnosis, recoverable deletion, and a condensed two-sided printable care sheet.

## Current Non-Goals

The current product does not implement search, filtering, conventional multi-user accounts, a full history browser, permanent deletion from Recently deleted, or Miscellany integration.

## Product Principles

- Identification can be temporary; saving requires an explicit user choice.
- My Garden is a collection of individual plants, not only species.
- A saved plant requires only a plant name.
- Recorded identity and AI assessment must remain visibly distinct.
- Manual or nursery-supplied identity must not block requesting an AI assessment.
- Private garden reads, writes, AI reassessment, and photograph requests must be authorized server-side.
- Saved-photo capacity and per-request AI selection are separate limits.
- Identity/reference photos and observation/problem photos are not interchangeable AI evidence.

## Approved Future Direction

My Garden is private and intended only for Gavin. It uses one fixed owner passphrase, no username or registration interface, a server-side passphrase secret, and a long-lived secure device session. Plant ID reuses the existing GavinApps Supabase project with separate Plant ID tables and private photograph storage. It must not use or modify MemoryEngine tables, API, authentication, or domain model. Plant and photo deletion should remain recoverable with useful creation and modification timestamps retained.

## Success Criteria

- Temporary multi-photo identification remains useful and safe.
- My Garden keeps Plant Type and AI ID visibly separate.
- Saved plants can store multiple private photos and request explicit AI reassessment.
- Care guides, observations, and diagnoses persist separately with useful provenance.
- The complete plant record remains readable on desktop and mobile.
- Print renders the current aggregate as a deliberately condensed two-page care sheet without inventing a second data model.
