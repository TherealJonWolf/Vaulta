---
name: Verifiable Reports (Phase 2)
description: assessment_reports table + institutional issuance + /verify/:hash supports both tenant and institutional reports
type: feature
---
**Phase 2 of the institutional trust infrastructure upgrade.** Extends the existing tenant `trust_report_snapshots` system with institution-issued assessment reports, and links report generation into the Phase 1 Trust Timeline.

**Tables:**
- `trust_report_snapshots` (Phase 1, unchanged) — user-issued verified trust reports.
- `assessment_reports` (new) — institution-issued snapshots of an `intake_submissions` row at a point in time. Fields: institution_id, submission_id, applicant_user_id, applicant_name, reference_id, issued_by, issuer_display_name, trust_score, score_state, assessment_narrative, evidence_summary, report_payload, report_hash (UNIQUE), version, issued_at. Immutable: BEFORE UPDATE trigger raises, DELETE revoked.

**RLS on assessment_reports:** institution members see/insert their institution's reports; applicants see reports about them; admins see all.

**Edge functions:**
- `generate-trust-report` — now ALSO inserts a `trust_events` row of type `report.verified.generated` so the Trust Timeline links to the verified report.
- `issue-assessment-report` (new) — authenticated, institution-member only. Canonicalises the submission, SHA-256 hashes, inserts an `assessment_reports` row, logs to `institutional_activity_log`. Hash collision returns the existing row (idempotent).
- `verify-trust-report` — tries `verify_trust_report_by_hash` first, falls back to `verify_assessment_report_by_hash`. Response includes `report_type: "tenant_trust_report" | "institutional_assessment_report"`.

**Public RPC `verify_assessment_report_by_hash(p_hash text)`** — SECURITY DEFINER, returns only: valid, issued_at, issuer_display_name, reference_id, trust_score, score_state, version. Never exposes applicant PII or payload.

**UI:**
- `src/institutional/components/IssueAssessmentReportButton.tsx` — mounted in `ApplicantDetailDrawer` footer. Shows hash + verify URL on success.
- `src/pages/VerifyTrustReport.tsx` — renders distinct layouts for tenant vs institutional reports based on `report_type`.

**Tone:** never "approved/denied". Use "score state" (clear/review/flag/insufficient).