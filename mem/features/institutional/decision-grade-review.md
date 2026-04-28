---
name: Decision-Grade Review Interface
description: Phase 1+2 institutional review surfaces — risk badges, Judge's Bench, decision narrative, verified income seal
type: feature
---
The institutional review interface transforms raw assessment data into decision-support scaffolding for landlords/lenders.

**Risk badges** (`src/lib/riskBadges.ts`) — derived from score state + signals (INCOME_VARIANCE, DOC_INTEGRITY, DEVICE_CHANGE, GEO_ANOMALY, IP_MISMATCH, INSUFFICIENT_DATA, FLAGGED). Surfaced on kanban cards (max 2) and in the applicant drawer.

**Judge's Bench** (`src/institutional/components/JudgeBench.tsx`) — split-pane document viewer + manual verification toggle that persists to `institutional_review_logs`.

**Decision Narrative Panel** (`src/institutional/components/DecisionNarrativePanel.tsx`) — replaces freeform narrative with structured PROVISIONAL TRUST CLASSIFICATION, risk level, recommended action, signal breakdown, system belief, source of uncertainty, and what would change the outcome. Uses `src/lib/decisionGrade.ts`.

**Vaulta Verified Income seal** (`src/institutional/components/VerifiedIncomeSeal.tsx` + inline kanban check) — surfaces when score_state==="clear" AND an income-bearing document type is present AND trust_score >= 70. Income keywords: paystub, payslip, income, tax, w-2, w2, 1099, salary, bank statement, employment.

**Audit log** — all review actions persist to `institutional_review_logs` (RLS scoped to institution members via reviewer_user_id = auth.uid()). Real-time activity feed in `ReviewActivityLog.tsx`.

**Decision-grade tone** — never "approved/denied"; use APPROVED, CONDITIONALLY APPROVED, NOT RECOMMENDED, INSUFFICIENT DATA. No "fog language" (mixed signals, uncertain profile, requires further interpretation).
