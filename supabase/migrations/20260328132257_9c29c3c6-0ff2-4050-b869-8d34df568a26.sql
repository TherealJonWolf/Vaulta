-- Remove the blanket anon SELECT policy that exposes sensitive contact details
DROP POLICY IF EXISTS "Anon can read institution branding" ON public.institution_settings;

-- Create a SECURITY DEFINER function that returns ONLY branding fields (no contact info)
CREATE OR REPLACE FUNCTION public.get_institution_branding(p_institution_id uuid)
RETURNS TABLE(
  institution_id uuid,
  display_name text,
  logo_path text,
  accent_color text,
  welcome_message text,
  institution_type text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT s.institution_id, s.display_name, s.logo_path, s.accent_color, s.welcome_message, s.institution_type
  FROM public.institution_settings s
  WHERE s.institution_id = p_institution_id
  LIMIT 1;
$$;