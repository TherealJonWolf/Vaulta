---
name: Intake Link Expiry Window
description: Configurable 24/48/72h secure intake window with tenant-side countdown
type: feature
---
Institutional users select the expiry window (24/48/72 hours) when generating intake links from `InstitutionalIntake.tsx`. The chosen duration is persisted as `intake_links.expires_at`.

On the public `/submit/:token` page (`SubmitDocuments.tsx`), a live countdown HH:MM:SS shows the remaining secure window. When `expires_at <= now`, the upload button is disabled and an expired-state warning replaces the countdown. The token validation RPC `validate_intake_token` already enforces expiry server-side; the countdown is UX, not security.
