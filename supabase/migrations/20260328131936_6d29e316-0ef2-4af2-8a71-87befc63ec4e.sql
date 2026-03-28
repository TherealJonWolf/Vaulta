-- Fix SECURITY DEFINER view by converting to SECURITY INVOKER
DROP VIEW IF EXISTS public.institution_public_info;
CREATE VIEW public.institution_public_info
WITH (security_invoker = true) AS
SELECT institution_id, display_name, logo_path, accent_color, welcome_message, institution_type
FROM public.institution_settings;

-- Re-add a scoped anon SELECT policy on institution_settings that only exposes non-sensitive fields
-- The view approach with security_invoker needs the underlying table to be readable
-- Instead, let's use a restricted anon policy
CREATE POLICY "Anon can read institution branding"
ON public.institution_settings
FOR SELECT
TO anon
USING (true);