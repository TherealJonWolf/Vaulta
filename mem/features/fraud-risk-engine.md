---
name: Fraud-Risk Engine
description: Phase 3 weighted fraud-risk aggregator — immutable assessments + institutional panel
type: feature
---
Additive Phase 3 layer on top of existing fraud signals. Does NOT replace consistency_findings, cross_account_signals, manual_review_queue, or document verification.

**Table**: `fraud_risk_assessments` — append-only, hash-sealed via `set_fraud_risk_hash` trigger, updates blocked by `protect_fraud_risk_immutability`. Fields: aggregate_score (0-100), severity (low/moderate/high/critical), top_signals jsonb, evidence_refs, methodology_version, immutable_hash.

**RLS**: admins all; institution members scoped to institution_id; applicants scoped to user_id. Inserts require computed_by = auth.uid().

**Edge function**: `aggregate-fraud-risk` — POST { submission_id?, user_id?, institution_id? }. Auth = institutional member or admin. Pulls from consistency_findings, manual_review_queue, device_telemetry_alerts, documents.verification_result. Weighted sum with severity multipliers (low 0.6, moderate 1.0, high 1.3, critical 1.6), capped at 100. Emits a `trust_event` (event_type `fraud_risk.assessed`) for provenance.

**UI**: `src/institutional/components/FraudRiskPanel.tsx` mounted in `ApplicantDetailDrawer` below `DecisionNarrativePanel`. Shows aggregate score, severity, top 6 contributing signals, immutable hash, Compute/Recompute button.
