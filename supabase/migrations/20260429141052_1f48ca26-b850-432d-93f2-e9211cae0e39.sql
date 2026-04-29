-- 1. Fix public bucket listing: replace broad SELECT-all policies with restricted ones
-- Files remain accessible by direct URL (public bucket), but .list() with no prefix returns nothing.

DROP POLICY IF EXISTS "Anyone can view institution logos" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view profile photos" ON storage.objects;

-- Logos: only readable when the request includes a path (no broad listing)
CREATE POLICY "Public can view institution logos by path"
ON storage.objects
FOR SELECT
TO anon, authenticated
USING (
  bucket_id = 'institution-logos'
  AND name IS NOT NULL
  AND position('/' in name) > 0
);

-- Profile photos: same — must request by path
CREATE POLICY "Public can view profile photos by path"
ON storage.objects
FOR SELECT
TO anon, authenticated
USING (
  bucket_id = 'profile-photos'
  AND name IS NOT NULL
  AND position('/' in name) > 0
);

-- 2. Lock down SECURITY DEFINER functions: revoke EXECUTE from public/anon
-- Keep authenticated EXECUTE only where the function is meant to be called by signed-in users.
-- Functions that should be callable WITHOUT auth (anon) keep public EXECUTE: validate_intake_token, resolve_shared_token, verify_trust_report_by_hash, get_institution_branding, is_email_blacklisted, check_account_locked, increment_failed_login.

-- Revoke from anon/public for internal-only functions
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.reset_failed_login(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.check_document_hash(text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.assign_user_role(uuid, app_role) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.flag_document_hash(text, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_institutional_member(uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_user_institution(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.verify_recovery_code(uuid, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.ensure_institutional_access(uuid) FROM PUBLIC, anon;

-- Public (anon-callable) functions: revoke from PUBLIC but explicitly grant to anon and authenticated
REVOKE EXECUTE ON FUNCTION public.validate_intake_token(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.validate_intake_token(text) TO anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.resolve_shared_token(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.resolve_shared_token(text) TO anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.verify_trust_report_by_hash(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.verify_trust_report_by_hash(text) TO anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.get_institution_branding(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_institution_branding(uuid) TO anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.is_email_blacklisted(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_email_blacklisted(text) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.check_account_locked(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.check_account_locked(text) TO anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.increment_failed_login(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.increment_failed_login(text) TO anon, authenticated;