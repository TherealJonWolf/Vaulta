
-- Table to track Veriff verification sessions
CREATE TABLE public.veriff_sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  session_id TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'created',
  decision TEXT,
  reason_code TEXT,
  vendor_data TEXT,
  verification_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.veriff_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own veriff sessions"
  ON public.veriff_sessions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own veriff sessions"
  ON public.veriff_sessions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Service role updates via edge function, but allow user updates for status polling
CREATE POLICY "Users can update their own veriff sessions"
  ON public.veriff_sessions FOR UPDATE
  USING (auth.uid() = user_id);

CREATE TRIGGER update_veriff_sessions_updated_at
  BEFORE UPDATE ON public.veriff_sessions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
