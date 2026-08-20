# Plant ID Project

## Vision

Plant ID is becoming Gavin's personal garden field guide. It should identify plants from photographs and, when Gavin chooses, save individual plants into My Garden with a plant name, location, recorded identity, AI assessment, care history, and personalized problem-diagnosis guide.

## Background

The app began as a polished one-photo plant-identification demo. It now has a working multi-photo upload flow, Vercel serverless API routes, OpenAI vision calls, response validation, uncertainty messaging, rate limiting, and a private saved Garden foundation.

## Users and Contexts

- Gavin can use temporary identification on desktop or phone.
- Gavin can unlock private My Garden on his MacBook and phone.
- Public visitors may use temporary identification but must not view or modify My Garden.

## Current Milestone

The current milestone is Part 3: multiple-photo identification and saved-plant AI reassessment while preserving Gavin's authority over Plant Type.

## Current Non-Goals

This milestone does not implement long-form personalized care guides, problem diagnosis workflows, print/PDF output, search, filtering, conventional multi-user accounts, or Miscellany integration.

## Product Principles

- Identification can be temporary; saving requires an explicit user choice.
- My Garden is a collection of individual plants, not only species.
- A saved plant requires only a plant name.
- Recorded identity and AI assessment must remain visibly distinct.
- Manual or nursery-supplied identity must not block requesting an AI assessment.
- Private garden reads, writes, AI reassessment, and photograph requests must be authorized server-side.

## Approved Future Direction

My Garden is private and intended only for Gavin. It uses one fixed owner passphrase, no username or registration interface, a server-side passphrase secret, and a long-lived secure device session. Plant ID reuses the existing GavinApps Supabase project with separate Plant ID tables and private photograph storage. It must not use or modify MemoryEngine tables, API, authentication, or domain model. Plant and photo deletion should remain recoverable with useful creation and modification timestamps retained.

## Success Criteria

- Temporary multi-photo identification remains useful and safe.
- My Garden keeps Plant Type and AI ID visibly separate.
- Saved plants can store multiple private photos and request explicit AI reassessment.
- The next implementation pass can start from documented architecture, commands, risks, and decisions.
