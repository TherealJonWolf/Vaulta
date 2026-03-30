
-- Manual review queue for borderline AI confidence documents
CREATE TABLE public.manual_review_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid NOT NULL,
  user_id uuid NOT NULL,
  institution_id uuid REFERENCES public.institutions(id),
  file_name text NOT NULL,
  mime_type text,
  ai_confidence integer NOT NULL,
  ai_summary text,
  ai_issues jsonb DEFAULT '[]'::jsonb,
  ai_generated_likelihood text DEFAULT 'none',
  verification_result jsonb DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'pending',
  reviewed_by uuid,
  reviewed_at timestamptz,
  review_decision text,
  review_notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.manual_review_queue ENABLE ROW LEVEL SECURITY;

-- Institution members can view review items for their institution
CREATE POLICY "Institution members can view review queue"
  ON public.manual_review_queue FOR SELECT TO authenticated
  USING (is_institutional_member(auth.uid(), institution_id));

-- Admins can view all review items
CREATE POLICY "Admins can view all review queue"
  ON public.manual_review_queue FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-- System/edge functions insert via service role; admins can also insert
CREATE POLICY "Admins can insert review queue"
  ON public.manual_review_queue FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Institution members and admins can update (approve/reject)
CREATE POLICY "Institution members can update review queue"
  ON public.manual_review_queue FOR UPDATE TO authenticated
  USING (is_institutional_member(auth.uid(), institution_id) OR has_role(auth.uid(), 'admin'::app_role));

-- Users can see their own documents in review
CREATE POLICY "Users can view own review items"
  ON public.manual_review_queue FOR SELECT TO authenticated
  USING (auth.uid() = user_id);
