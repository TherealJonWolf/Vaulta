REVOKE EXECUTE ON FUNCTION public.is_admin_email(text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin_email(text) TO service_role;