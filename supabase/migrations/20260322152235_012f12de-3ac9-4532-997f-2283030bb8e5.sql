
-- Add 'landlord' to the app_role enum
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'landlord';

-- Shared profile tokens: applicants generate these to share their vault
CREATE TABLE public.shared_profile_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  token text NOT NULL UNIQUE,
  label text DEFAULT 'Shared Profile',
  expires_at timestamp with time zone NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  view_count integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Landlord saved applicants: landlords can save profiles they've viewed
CREATE TABLE public.landlord_saved_applicants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  landlord_user_id uuid NOT NULL,
  applicant_user_id uuid NOT NULL,
  shared_token_id uuid REFERENCES public.shared_profile_tokens(id) ON DELETE SET NULL,
  notes text,
  saved_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(landlord_user_id, applicant_user_id)
);

-- Enable RLS
ALTER TABLE public.shared_profile_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.landlord_saved_applicants ENABLE ROW LEVEL SECURITY;

-- RLS for shared_profile_tokens: users can manage their own tokens
CREATE POLICY "Users can insert own tokens" ON public.shared_profile_tokens
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view own tokens" ON public.shared_profile_tokens
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can update own tokens" ON public.shared_profile_tokens
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own tokens" ON public.shared_profile_tokens
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Public read policy for token lookup (needed for shared profile viewing)
CREATE POLICY "Anyone can read active tokens by token value" ON public.shared_profile_tokens
  FOR SELECT TO anon USING (is_active = true AND expires_at > now());

-- RLS for landlord_saved_applicants
CREATE POLICY "Landlords can insert own saved applicants" ON public.landlord_saved_applicants
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = landlord_user_id);

CREATE POLICY "Landlords can view own saved applicants" ON public.landlord_saved_applicants
  FOR SELECT TO authenticated USING (auth.uid() = landlord_user_id);

CREATE POLICY "Landlords can update own saved applicants" ON public.landlord_saved_applicants
  FOR UPDATE TO authenticated USING (auth.uid() = landlord_user_id);

CREATE POLICY "Landlords can delete own saved applicants" ON public.landlord_saved_applicants
  FOR DELETE TO authenticated USING (auth.uid() = landlord_user_id);

-- Edge function to resolve shared tokens needs a security definer function
CREATE OR REPLACE FUNCTION public.resolve_shared_token(p_token text)
RETURNS TABLE(
  user_id uuid,
  token_id uuid,
  is_valid boolean,
  applicant_email text,
  applicant_name text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    t.user_id,
    t.id AS token_id,
    (t.is_active AND t.expires_at > now()) AS is_valid,
    p.email AS applicant_email,
    p.full_name AS applicant_name
  FROM public.shared_profile_tokens t
  JOIN public.profiles p ON p.user_id = t.user_id
  WHERE t.token = p_token
  LIMIT 1;
  
  -- Increment view count
  UPDATE public.shared_profile_tokens
  SET view_count = view_count + 1
  WHERE token = p_token AND is_active = true AND expires_at > now();
END;
$$;
