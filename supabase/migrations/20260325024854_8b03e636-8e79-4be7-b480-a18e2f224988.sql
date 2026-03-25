
-- Immutable trust narratives table
CREATE TABLE public.trust_narratives (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  assessment_id uuid NOT NULL,
  institution_type text NOT NULL DEFAULT 'general',
  institution_name text,
  score_state text NOT NULL CHECK (score_state IN ('clear', 'review', 'flag', 'insufficient')),
  trust_score integer,
  narrative_text text NOT NULL,
  document_count integer NOT NULL DEFAULT 0,
  history_months integer,
  flag_count integer NOT NULL DEFAULT 0,
  assessed_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb DEFAULT '{}'::jsonb
);

-- RLS
ALTER TABLE public.trust_narratives ENABLE ROW LEVEL SECURITY;

-- Applicant can view their own narratives
CREATE POLICY "Users can view own narratives"
  ON public.trust_narratives FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- System inserts narratives (via authenticated user context)
CREATE POLICY "Users can insert own narratives"
  ON public.trust_narratives FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Admins can view all
CREATE POLICY "Admins can view all narratives"
  ON public.trust_narratives FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Landlords/lenders can view narratives for applicants they have saved
CREATE POLICY "Institutions can view applicant narratives"
  ON public.trust_narratives FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.landlord_saved_applicants lsa
      WHERE lsa.landlord_user_id = auth.uid()
        AND lsa.applicant_user_id = trust_narratives.user_id
    )
  );

-- Index for fast lookups
CREATE INDEX idx_trust_narratives_user_id ON public.trust_narratives(user_id);
CREATE INDEX idx_trust_narratives_assessment_id ON public.trust_narratives(assessment_id);
