-- Append-only institutional review log
CREATE TABLE public.institutional_review_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id uuid NOT NULL,
  submission_id uuid NOT NULL,
  reviewer_user_id uuid NOT NULL,
  reviewer_name text,
  action text NOT NULL,
  target_type text,
  target_id uuid,
  target_name text,
  badge_codes text[] NOT NULL DEFAULT '{}'::text[],
  notes text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX idx_irl_submission ON public.institutional_review_logs (submission_id, created_at DESC);
CREATE INDEX idx_irl_institution ON public.institutional_review_logs (institution_id, created_at DESC);

ALTER TABLE public.institutional_review_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Institution members can view review logs"
  ON public.institutional_review_logs
  FOR SELECT
  TO authenticated
  USING (public.is_institutional_member(auth.uid(), institution_id));

CREATE POLICY "Institution members can insert review logs"
  ON public.institutional_review_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_institutional_member(auth.uid(), institution_id)
    AND reviewer_user_id = auth.uid()
  );
