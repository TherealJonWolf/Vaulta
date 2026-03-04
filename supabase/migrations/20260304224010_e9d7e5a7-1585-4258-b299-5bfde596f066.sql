
-- Trust History: Longitudinal trust memory (Weakness 2)
CREATE TABLE public.trust_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  event_type text NOT NULL, -- 'evaluation', 'reinforcement', 'contradiction', 'decay'
  trust_score_at_time integer NOT NULL,
  trust_delta integer NOT NULL DEFAULT 0,
  rules_satisfied text[] DEFAULT '{}',
  rules_violated text[] DEFAULT '{}',
  decay_applied numeric DEFAULT 0,
  inertia_factor numeric DEFAULT 1.0, -- how resistant trust is to change
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.trust_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own trust history"
  ON public.trust_history FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "System can insert trust history"
  ON public.trust_history FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_trust_history_user_created ON public.trust_history(user_id, created_at DESC);

-- Cross-Account Signals: Anonymized similarity detection (Weakness 4)
CREATE TABLE public.cross_account_signals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  signal_type text NOT NULL, -- 'cadence_similarity', 'structure_similarity', 'correction_pattern'
  fingerprint_hash text NOT NULL, -- anonymized behavioral fingerprint
  account_count integer NOT NULL DEFAULT 1,
  severity text NOT NULL DEFAULT 'low',
  confidence_score numeric NOT NULL DEFAULT 0,
  metadata jsonb DEFAULT '{}'::jsonb,
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.cross_account_signals ENABLE ROW LEVEL SECURITY;

-- No user-facing RLS — this table is server-side only via service role
-- Users cannot read cross-account signals (Weakness 3: signal leakage prevention)

CREATE INDEX idx_cross_account_fingerprint ON public.cross_account_signals(fingerprint_hash);
CREATE INDEX idx_cross_account_signal_type ON public.cross_account_signals(signal_type);

-- Evaluation Metadata: Stores per-account jitter seeds and boundary-hugging scores (Weakness 1)
CREATE TABLE public.evaluation_metadata (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  jitter_seed numeric NOT NULL, -- random seed for probabilistic tolerance bands
  jitter_epoch integer NOT NULL DEFAULT 0, -- rotates periodically
  boundary_hugging_score numeric NOT NULL DEFAULT 0, -- 0-100 score for near-trigger behavior
  boundary_events integer NOT NULL DEFAULT 0, -- count of near-trigger evaluations
  last_random_audit_at timestamptz, -- last time a random secondary evaluation was triggered
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.evaluation_metadata ENABLE ROW LEVEL SECURITY;

-- Users can only see their own evaluation metadata (obfuscated feedback only)
CREATE POLICY "Users can view own evaluation metadata"
  ON public.evaluation_metadata FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "System can insert evaluation metadata"
  ON public.evaluation_metadata FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "System can update evaluation metadata"
  ON public.evaluation_metadata FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE UNIQUE INDEX idx_evaluation_metadata_user ON public.evaluation_metadata(user_id);
