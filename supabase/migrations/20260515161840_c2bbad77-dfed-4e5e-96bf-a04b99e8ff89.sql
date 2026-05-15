
-- Trust Provenance: append-only event log
CREATE TABLE public.trust_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  event_type text NOT NULL,
  source_system text NOT NULL,
  trust_delta numeric NOT NULL DEFAULT 0,
  severity text NOT NULL DEFAULT 'info' CHECK (severity IN ('info','low','moderate','high','critical')),
  confidence integer NOT NULL DEFAULT 0 CHECK (confidence BETWEEN 0 AND 100),
  explanation text NOT NULL,
  evidence_refs jsonb NOT NULL DEFAULT '[]'::jsonb,
  reviewed_by uuid,
  review_status text NOT NULL DEFAULT 'unreviewed' CHECK (review_status IN ('unreviewed','acknowledged','overridden','confirmed')),
  reviewed_at timestamptz,
  reviewer_notes text,
  reversed boolean NOT NULL DEFAULT false,
  reversed_by_event_id uuid,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  immutable_hash text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_trust_events_user_created ON public.trust_events (user_id, created_at DESC);
CREATE INDEX idx_trust_events_severity ON public.trust_events (severity) WHERE severity IN ('high','critical');
CREATE INDEX idx_trust_events_review_status ON public.trust_events (review_status) WHERE review_status = 'unreviewed';

ALTER TABLE public.trust_events ENABLE ROW LEVEL SECURITY;

-- RLS: users can read own
CREATE POLICY "Users can view own trust events"
  ON public.trust_events FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- RLS: admins read all
CREATE POLICY "Admins can view all trust events"
  ON public.trust_events FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

-- RLS: institution members read events for users who have a submission in their institution
CREATE POLICY "Institution members can view applicant trust events"
  ON public.trust_events FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.intake_submissions s
      JOIN public.institutional_users iu ON iu.institution_id = s.institution_id
      WHERE iu.user_id = auth.uid()
        AND s.applicant_name IS NOT NULL
        AND (
          -- match by applicant_user_id when populated via possession requests
          EXISTS (
            SELECT 1 FROM public.document_possession_requests dpr
            WHERE dpr.submission_id = s.id
              AND dpr.applicant_user_id = trust_events.user_id
          )
        )
    )
  );

-- RLS: inserts — user themselves OR admin OR institution member acting as reviewer
CREATE POLICY "Users can insert own trust events"
  ON public.trust_events FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Admins can insert any trust events"
  ON public.trust_events FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

-- RLS: updates only for reviewer/review_status fields, by admins or institution members.
-- Enforced further by trigger that locks immutable columns.
CREATE POLICY "Admins can update review fields"
  ON public.trust_events FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

-- Function: compute immutable hash on insert
CREATE OR REPLACE FUNCTION public.set_trust_event_hash()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_canonical text;
BEGIN
  -- Deterministic canonicalization: stable key order
  v_canonical := concat_ws('|',
    NEW.id::text,
    NEW.user_id::text,
    NEW.event_type,
    NEW.source_system,
    NEW.trust_delta::text,
    NEW.severity,
    NEW.confidence::text,
    NEW.explanation,
    NEW.evidence_refs::text,
    NEW.metadata::text,
    NEW.created_at::text
  );
  NEW.immutable_hash := encode(digest(v_canonical, 'sha256'), 'hex');
  RETURN NEW;
END;
$$;

-- Need pgcrypto for digest()
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TRIGGER trg_trust_event_hash
  BEFORE INSERT ON public.trust_events
  FOR EACH ROW EXECUTE FUNCTION public.set_trust_event_hash();

-- Function: lock immutable columns on update
CREATE OR REPLACE FUNCTION public.protect_trust_event_immutability()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.id IS DISTINCT FROM OLD.id
     OR NEW.user_id IS DISTINCT FROM OLD.user_id
     OR NEW.event_type IS DISTINCT FROM OLD.event_type
     OR NEW.source_system IS DISTINCT FROM OLD.source_system
     OR NEW.trust_delta IS DISTINCT FROM OLD.trust_delta
     OR NEW.severity IS DISTINCT FROM OLD.severity
     OR NEW.confidence IS DISTINCT FROM OLD.confidence
     OR NEW.explanation IS DISTINCT FROM OLD.explanation
     OR NEW.evidence_refs::text IS DISTINCT FROM OLD.evidence_refs::text
     OR NEW.metadata::text IS DISTINCT FROM OLD.metadata::text
     OR NEW.created_at IS DISTINCT FROM OLD.created_at
     OR NEW.immutable_hash IS DISTINCT FROM OLD.immutable_hash THEN
    RAISE EXCEPTION 'trust_events immutable fields cannot be modified';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_trust_event_protect
  BEFORE UPDATE ON public.trust_events
  FOR EACH ROW EXECUTE FUNCTION public.protect_trust_event_immutability();

-- Block deletes entirely (no DELETE policies = no deletes for authenticated users; add explicit revoke just in case)
REVOKE DELETE ON public.trust_events FROM authenticated, anon;
