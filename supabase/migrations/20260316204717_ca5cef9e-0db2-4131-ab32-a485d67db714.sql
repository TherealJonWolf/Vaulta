
-- Table to log all document upload events (successes, security failures, technical failures)
CREATE TABLE public.document_upload_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  file_name TEXT NOT NULL,
  file_size BIGINT DEFAULT 0,
  mime_type TEXT,
  event_type TEXT NOT NULL DEFAULT 'success', -- 'success', 'security_failure', 'technical_failure'
  failure_reason TEXT,
  failure_step TEXT, -- which verification step failed
  severity TEXT NOT NULL DEFAULT 'info', -- 'info', 'warning', 'critical'
  metadata JSONB DEFAULT '{}'::jsonb,
  security_warnings_issued INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.document_upload_events ENABLE ROW LEVEL SECURITY;

-- Users can insert their own events
CREATE POLICY "Users can insert their own upload events"
  ON public.document_upload_events FOR INSERT
  TO public
  WITH CHECK (auth.uid() = user_id);

-- Users can view their own events
CREATE POLICY "Users can view their own upload events"
  ON public.document_upload_events FOR SELECT
  TO public
  USING (auth.uid() = user_id);

-- Admins can view all upload events
CREATE POLICY "Admins can view all upload events"
  ON public.document_upload_events FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));
