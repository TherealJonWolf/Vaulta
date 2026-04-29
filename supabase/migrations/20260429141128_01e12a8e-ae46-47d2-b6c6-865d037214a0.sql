-- These helpers are only invoked by RLS policies or by edge functions using the
-- service role — they don't need to be callable directly by signed-in users.
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.is_institutional_member(uuid, uuid) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.get_user_institution(uuid) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.check_document_hash(text) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.is_email_blacklisted(text) FROM authenticated;