
-- ============ assessment_reports: institution-issued verified snapshots ============
CREATE TABLE public.assessment_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id uuid NOT NULL,
  submission_id uuid,
  applicant_user_id uuid,
  applicant_name text,
  reference_id text,
  issued_by uuid NOT NULL,
  issuer_display_name text,
  trust_score numeric,
  score_state text NOT NULL DEFAULT 'insufficient',
  assessment_narrative text,
  evidence_summary jsonb NOT NULL DEFAULT '{}'::jsonb,
  report_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  report_hash text NOT NULL UNIQUE,
  version text NOT NULL DEFAULT 'v1',
  issued_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_assessment_reports_inst ON public.assessment_reports(institution_id);
CREATE INDEX idx_assessment_reports_hash ON public.assessment_reports(report_hash);
CREATE INDEX idx_assessment_reports_applicant ON public.assessment_reports(applicant_user_id);

ALTER TABLE public.assessment_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Institution members can view their reports"
  ON public.assessment_reports FOR SELECT TO authenticated
  USING (public.is_institutional_member(auth.uid(), institution_id));

CREATE POLICY "Institution members can insert reports"
  ON public.assessment_reports FOR INSERT TO authenticated
  WITH CHECK (
    public.is_institutional_member(auth.uid(), institution_id)
    AND issued_by = auth.uid()
  );

CREATE POLICY "Applicants can view reports about them"
  ON public.assessment_reports FOR SELECT TO authenticated
  USING (applicant_user_id = auth.uid());

CREATE POLICY "Admins can view all assessment reports"
  ON public.assessment_reports FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Immutability trigger: block updates entirely
CREATE OR REPLACE FUNCTION public.protect_assessment_report_immutability()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RAISE EXCEPTION 'assessment_reports are immutable';
END;
$$;

CREATE TRIGGER assessment_reports_no_update
  BEFORE UPDATE ON public.assessment_reports
  FOR EACH ROW EXECUTE FUNCTION public.protect_assessment_report_immutability();

REVOKE DELETE ON public.assessment_reports FROM anon, authenticated;

-- Public verification function: hash-only lookup, exposes only safe fields
CREATE OR REPLACE FUNCTION public.verify_assessment_report_by_hash(p_hash text)
RETURNS TABLE(
  valid boolean,
  issued_at timestamptz,
  issuer_display_name text,
  reference_id text,
  trust_score numeric,
  score_state text,
  version text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    true AS valid,
    r.issued_at,
    r.issuer_display_name,
    r.reference_id,
    r.trust_score,
    r.score_state,
    r.version
  FROM public.assessment_reports r
  WHERE r.report_hash = p_hash
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.verify_assessment_report_by_hash(text) TO anon, authenticated;
