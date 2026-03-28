-- 1. Restrict testimonials INSERT to authenticated users only
DROP POLICY IF EXISTS "Anyone can submit testimonials" ON public.testimonials;
CREATE POLICY "Authenticated users can submit testimonials"
ON public.testimonials
FOR INSERT
TO authenticated
WITH CHECK (true);

-- 2. Restrict institution_settings anon policy to only expose display_name, logo_path, accent_color, welcome_message
-- Drop the overly permissive policy
DROP POLICY IF EXISTS "Public can read institution settings by id" ON public.institution_settings;

-- Create a more restrictive view for public access (intake pages need branding only)
CREATE OR REPLACE VIEW public.institution_public_info AS
SELECT institution_id, display_name, logo_path, accent_color, welcome_message, institution_type
FROM public.institution_settings;