-- Phase 3: Fraud-Risk Engine aggregator table
CREATE TABLE public.fraud_risk_assessments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  institution_id uuid,
  submission_id uuid,
  applicant_name text,
  reference_id text,
  aggregate_score numeric NOT NULL DEFAULT 0,
  severity text NOT NULL DEFAULT 'low',
  top_signals jsonb NOT NULL DEFAULT '[]'::jsonb,
  evidence_refs jsonb NOT NULL DEFAULT '[]'::jsonb,
  methodology_version text NOT NULL DEFAULT 'v1',
  computed_by uuid,
  immutable_hash text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT fraud_risk_severity_check CHECK (severity IN ('low','moderate','high','critical')),
  CONSTRAINT fraud_risk_score_check CHECK (aggregate_score >= 0 AND aggregate_score <= 100),
  CONSTRAINT fraud_risk_scope_check CHECK (user_id IS NOT NULL OR submission_id IS NOT NULL)
);

CREATE INDEX idx_fraud_risk_user ON public.fraud_risk_assessments(user_id, created_at DESC);
CREATE INDEX idx_fraud_risk_submission ON public.fraud_risk_assessments(submission_id, created_at DESC);
CREATE INDEX idx_fraud_risk_institution ON public.fraud_risk_assessments(institution_id, created_at DESC);

ALTER TABLE public.fraud_risk_assessments ENABLE ROW LEVEL SECURITY;

-- Immutability hash trigger
CREATE OR REPLACE FUNCTION public.set_fraud_risk_hash()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_canonical text;
BEGIN
  v_canonical := concat_ws('|',
    NEW.id::text,
    COALESCE(NEW.user_id::text, ''),
    COALESCE(NEW.institution_id::text, ''),
    COALESCE(NEW.submission_id::text, ''),
    NEW.aggregate_score::text,
    NEW.severity,
    NEW.top_signals::text,
    NEW.evidence_refs::text,
    NEW.methodology_version,
    NEW.created_at::text
  );
  NEW.immutable_hash := encode(digest(v_canonical, 'sha256'), 'hex');
  RETURN NEW;
END; $$;

CREATE TRIGGER trg_set_fraud_risk_hash
  BEFORE INSERT ON public.fraud_risk_assessments
  FOR EACH ROW EXECUTE FUNCTION public.set_fraud_risk_hash();

-- Block updates entirely
CREATE OR REPLACE FUNCTION public.protect_fraud_risk_immutability()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  RAISE EXCEPTION 'fraud_risk_assessments are immutable';
END; $$;

CREATE TRIGGER trg_protect_fraud_risk
  BEFORE UPDATE ON public.fraud_risk_assessments
  FOR EACH ROW EXECUTE FUNCTION public.protect_fraud_risk_immutability();

REVOKE DELETE ON public.fraud_risk_assessments FROM anon, authenticated;

-- RLS policies
CREATE POLICY "Admins view all fraud risk"
  ON public.fraud_risk_assessments FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Institution members view fraud risk"
  ON public.fraud_risk_assessments FOR SELECT TO authenticated
  USING (institution_id IS NOT NULL AND is_institutional_member(auth.uid(), institution_id));

CREATE POLICY "Applicants view own fraud risk"
  ON public.fraud_risk_assessments FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Institution members insert fraud risk"
  ON public.fraud_risk_assessments FOR INSERT TO authenticated
  WITH CHECK (institution_id IS NOT NULL
              AND is_institutional_member(auth.uid(), institution_id)
              AND computed_by = auth.uid());

CREATE POLICY "Admins insert fraud risk"
  ON public.fraud_risk_assessments FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) AND computed_by = auth.uid());