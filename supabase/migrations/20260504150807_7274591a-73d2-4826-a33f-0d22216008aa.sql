
-- 1. Tighten shared_profile_tokens: remove public enumeration policy.
-- Public token resolution goes through SECURITY DEFINER RPC public.resolve_shared_token(text).
DROP POLICY IF EXISTS "Anyone can read active tokens by token value" ON public.shared_profile_tokens;

-- 2. Remove notifications from realtime publication (PII; per project policy).
ALTER PUBLICATION supabase_realtime DROP TABLE public.notifications;

-- 3. Storage: allow institution members to UPDATE and DELETE their bucket files.
CREATE POLICY "Institution members can update docs"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'institution-documents'
       AND public.is_institutional_member(auth.uid(), ((storage.foldername(name))[1])::uuid))
WITH CHECK (bucket_id = 'institution-documents'
       AND public.is_institutional_member(auth.uid(), ((storage.foldername(name))[1])::uuid));

CREATE POLICY "Institution members can delete docs"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'institution-documents'
       AND public.is_institutional_member(auth.uid(), ((storage.foldername(name))[1])::uuid));

-- 4. Lock down internal SECURITY DEFINER functions: revoke EXECUTE from anon/authenticated.
-- These are only called by triggers, edge functions (service role), or via RPCs that already wrap them.
REVOKE EXECUTE ON FUNCTION public.handle_new_user()                       FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column()              FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.prevent_admin_lockout()                 FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.prevent_admin_blacklist()               FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.assign_user_role(uuid, public.app_role) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.reset_failed_login(uuid)                FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.increment_failed_login(text)            FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.check_account_locked(text)              FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.is_email_blacklisted(text)              FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.flag_document_hash(text, text)          FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.check_document_hash(text)               FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.verify_recovery_code(uuid, text)        FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.ensure_institutional_access(uuid)       FROM anon, authenticated;

-- Keep callable but only by signed-in users (not anon):
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role)         FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_admin_email(text)                    FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_institutional_member(uuid, uuid)     FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_user_institution(uuid)              FROM anon;

-- These are intentionally callable by anonymous users (public verification endpoints):
--   public.resolve_shared_token(text)            -- public profile share links
--   public.validate_intake_token(text)           -- institutional intake links
--   public.verify_trust_report_by_hash(text)     -- trust report verification
--   public.get_institution_branding(uuid)        -- public institutional branding
