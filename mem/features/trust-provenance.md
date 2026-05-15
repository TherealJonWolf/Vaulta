---
name: Trust Provenance Events
description: Append-only trust_events audit log + Trust Timeline UI (Phase 1 of institutional upgrade)
type: feature
---
**trust_events** is an immutable, append-only audit log of every event that contributes to a user's trust evidence. Coexists with — does NOT replace — the existing trust_score and trust_report_snapshots system.

**Schema:** event_type, source_system, trust_delta (signed numeric), severity (info/low/moderate/high/critical), confidence (0-100), explanation, evidence_refs (jsonb array), reviewed_by, review_status (unreviewed/acknowledged/overridden/confirmed), reversed, reversed_by_event_id, immutable_hash (SHA-256), metadata.

**Integrity:**
- BEFORE INSERT trigger `set_trust_event_hash` computes `immutable_hash = sha256(canonical concat of immutable fields)` via pgcrypto.
- BEFORE UPDATE trigger `protect_trust_event_immutability` raises if any immutable column is modified — only review_status/reviewer_notes/reviewed_by/reviewed_at/reversed/reversed_by_event_id may change.
- DELETE revoked from authenticated/anon entirely.

**RLS:** users see own; admins see all; institution members see events for users tied to their institution via document_possession_requests → intake_submissions. Inserts: self, admin, or admin override.

**Helper:** `src/lib/trustEvents.ts` exports `recordTrustEvent()` and `fetchUserTrustTimeline()`. Use `recordTrustEvent` from any flow that meaningfully changes trust evidence (document verification, consistency findings, Veriff outcomes, manual reviewer actions). Never log raw model output as `explanation` — always plain language.

**UI:** `src/components/TrustTimeline.tsx` — Dialog mounted in Vault.tsx, opened via the History icon next to the Trust Score button. Shows reverse-chronological timeline with severity badges, signed trust_delta, confidence, review status, and a truncated immutable_hash. Empty state explains the system.

**Compliance language:** never "approved/denied/fraudulent". Use "low confidence / moderate concern / requires review / elevated inconsistency" per Section 6 + 10 of the institutional upgrade spec.
