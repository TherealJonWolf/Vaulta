-- Remove the over-broad anon grants from the previous fix.
-- Authenticated grants are sufficient for RLS evaluation; public flows that
-- need these (e.g. shared profile resolution) go through edge functions
-- using the service role.
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_institutional_member(uuid, uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_user_institution(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_email_blacklisted(text) FROM anon;