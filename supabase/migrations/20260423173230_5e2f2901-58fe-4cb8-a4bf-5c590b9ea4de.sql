-- Immutable trust report snapshots
CREATE TABLE public.trust_report_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  trust_score numeric NOT NULL,
  trust_level public.trust_level NOT NULL,
  confidence numeric NOT NULL DEFAULT 0,
  signals_summary jsonb NOT NULL DEFAULT '[]'::jsonb,
  consent_snapshot jsonb NOT NULL DEFAULT '[]'::jsonb,
  audit_metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  generated_at timestamptz NOT NULL DEFAULT now(),
  report_hash text NOT NULL UNIQUE,
  version text NOT NULL DEFAULT 'v1'
);

CREATE INDEX idx_trust_report_snapshots_user ON public.trust_report_snapshots(user_id);
CREATE INDEX idx_trust_report_snapshots_hash ON public.trust_report_snapshots(report_hash);

ALTER TABLE public.trust_report_snapshots ENABLE ROW LEVEL SECURITY;

-- Users can read their own snapshots
CREATE POLICY "Users can view own snapshots"
  ON public.trust_report_snapshots
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Users can insert their own snapshots (service role bypasses RLS for edge fn)
CREATE POLICY "Users can insert own snapshots"
  ON public.trust_report_snapshots
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Admins can view all
CREATE POLICY "Admins can view all snapshots"
  ON public.trust_report_snapshots
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

-- NO update / delete policies = immutable

-- Public verification function: hash-only lookup, no sensitive data exposed
CREATE OR REPLACE FUNCTION public.verify_trust_report_by_hash(p_hash text)
RETURNS TABLE(
  valid boolean,
  generated_at timestamptz,
  trust_score numeric,
  trust_level public.trust_level,
  version text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    true AS valid,
    s.generated_at,
    s.trust_score,
    s.trust_level,
    s.version
  FROM public.trust_report_snapshots s
  WHERE s.report_hash = p_hash
  LIMIT 1;
$$;

-- Allow anonymous + authenticated callers to verify by hash
GRANT EXECUTE ON FUNCTION public.verify_trust_report_by_hash(text) TO anon, authenticated;