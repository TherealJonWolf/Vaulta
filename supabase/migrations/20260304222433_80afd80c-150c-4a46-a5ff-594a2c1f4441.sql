
-- Table for storing data consistency audit findings
CREATE TABLE public.consistency_findings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  rule_id text NOT NULL,
  rule_category text NOT NULL,
  rule_name text NOT NULL,
  description text NOT NULL,
  severity text NOT NULL DEFAULT 'low',
  confidence_impact numeric(5,2) NOT NULL DEFAULT 0,
  follow_up_action text NOT NULL DEFAULT 'none',
  audit_log_entry text NOT NULL,
  metadata jsonb DEFAULT '{}'::jsonb,
  resolved boolean NOT NULL DEFAULT false,
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.consistency_findings ENABLE ROW LEVEL SECURITY;

-- Users can view their own findings
CREATE POLICY "Users can view their own consistency findings"
  ON public.consistency_findings FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- System inserts via service role; users can also insert their own
CREATE POLICY "Users can insert their own consistency findings"
  ON public.consistency_findings FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Index for fast lookups
CREATE INDEX idx_consistency_findings_user_id ON public.consistency_findings(user_id);
CREATE INDEX idx_consistency_findings_rule_category ON public.consistency_findings(rule_category);
CREATE INDEX idx_consistency_findings_severity ON public.consistency_findings(severity);
CREATE INDEX idx_consistency_findings_created_at ON public.consistency_findings(created_at DESC);
