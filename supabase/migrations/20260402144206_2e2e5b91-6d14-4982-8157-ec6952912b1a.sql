
-- 1. Fix blacklisted_emails: enable RLS and add admin-only policies
ALTER TABLE public.blacklisted_emails ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view blacklisted emails"
ON public.blacklisted_emails FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can insert blacklisted emails"
ON public.blacklisted_emails FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete blacklisted emails"
ON public.blacklisted_emails FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

-- 2. Fix institution-logos storage: drop permissive policies, add institution-scoped ones
DROP POLICY IF EXISTS "Authenticated users can delete institution logos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update institution logos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload institution logos" ON storage.objects;

CREATE POLICY "Institution members can upload logos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'institution-logos'
  AND public.is_institutional_member(auth.uid(), ((storage.foldername(name))[1])::uuid)
);

CREATE POLICY "Institution members can update logos"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'institution-logos'
  AND public.is_institutional_member(auth.uid(), ((storage.foldername(name))[1])::uuid)
);

CREATE POLICY "Institution members can delete logos"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'institution-logos'
  AND public.is_institutional_member(auth.uid(), ((storage.foldername(name))[1])::uuid)
);

-- 3. Fix institution-documents storage: drop permissive policies, add institution-scoped ones
DROP POLICY IF EXISTS "Institution members can upload institution documents" ON storage.objects;
DROP POLICY IF EXISTS "Institution members can view institution documents" ON storage.objects;

CREATE POLICY "Institution members can upload docs"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'institution-documents'
  AND public.is_institutional_member(auth.uid(), ((storage.foldername(name))[1])::uuid)
);

CREATE POLICY "Institution members can view docs"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'institution-documents'
  AND public.is_institutional_member(auth.uid(), ((storage.foldername(name))[1])::uuid)
);

-- 4. Remove remaining sensitive tables from Realtime, keep only notifications
ALTER PUBLICATION supabase_realtime DROP TABLE public.account_flags, public.trust_history, public.document_upload_events;
