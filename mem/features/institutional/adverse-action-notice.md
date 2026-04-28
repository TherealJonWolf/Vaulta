---
name: Adverse Action Notice PDF
description: Server-side FCRA/Fair Housing-aligned PDF generated via adverse-action-pdf edge function
type: feature
---
Edge function: `supabase/functions/adverse-action-pdf` — generates a server-side jsPDF notice institutions can deliver to applicants when proceeding with adverse or conditional terms.

**Auth/Authz**: validates JWT via anon-keyed client, then verifies institutional membership via service role + `institutional_users` table.

**Branding**: pulls display_name, contact info, business_address, and signature_path from `institution_settings`. Signature image (PNG/JPEG) is fetched and embedded above the signature line; falls through to text-only if unavailable.

**Reasons block** is auto-derived from `score_state` (flag/review/insufficient/clear). Composite trust score is included if present. The notice references Vaulta as the third-party information source per FCRA disclosure requirements and includes Fair Housing rights language.

**Audit**: writes to both `institutional_activity_log` (event_type "Adverse Action Notice Generated") AND `institutional_review_logs` (action "adverse_action_notice_generated") so the kanban can display a "Notice Issued" badge.

**UI surface**: button in `ApplicantDetailDrawer` only appears when `score_state` is "flag" or "review". Template language is non-final — institutions are responsible for legal review per the footer disclaimer.
