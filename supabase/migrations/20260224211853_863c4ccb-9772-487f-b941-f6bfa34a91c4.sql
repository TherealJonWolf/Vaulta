
-- Table for tracking account flags (suspended, under review, etc.)
CREATE TABLE public.account_flags (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  flag_type TEXT NOT NULL DEFAULT 'suspended', -- suspended, under_review, cleared
  reason TEXT NOT NULL,
  flagged_document_name TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  resolved_at TIMESTAMP WITH TIME ZONE,
  resolved_by TEXT
);

ALTER TABLE public.account_flags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own flags"
  ON public.account_flags FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "System can insert flags"
  ON public.account_flags FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Table for blacklisted emails
CREATE TABLE public.blacklisted_emails (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  reason TEXT NOT NULL,
  blacklisted_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  associated_user_id UUID
);

ALTER TABLE public.blacklisted_emails ENABLE ROW LEVEL SECURITY;

-- No user-facing select policy - this is admin-only
-- But we need a function to check if an email is blacklisted (public access for signup check)
CREATE OR REPLACE FUNCTION public.is_email_blacklisted(check_email TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (SELECT 1 FROM public.blacklisted_emails WHERE email = lower(check_email));
END;
$$;
