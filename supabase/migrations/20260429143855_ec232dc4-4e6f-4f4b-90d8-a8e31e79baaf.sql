-- 1) Restore EXECUTE on functions used inside RLS policies. PostgreSQL evaluates
--    these in the context of the querying role, so authenticated MUST be able
--    to execute them or every gated SELECT/INSERT fails (42501 → surfaces as
--    "database error, code: 08P01" in the supabase-js client).
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.is_institutional_member(uuid, uuid) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.get_user_institution(uuid) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.check_document_hash(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_email_blacklisted(text) TO authenticated, anon;

-- 2) Allow manual_review_queue to accept items where the underlying document
--    has not yet been persisted (verify-document runs BEFORE the documents
--    insert). Previously document_id was UUID NOT NULL and the edge function
--    fell back to the SHA-256 hex string → 22P02 invalid uuid syntax.
ALTER TABLE public.manual_review_queue
  ALTER COLUMN document_id DROP NOT NULL;

ALTER TABLE public.manual_review_queue
  ADD COLUMN IF NOT EXISTS document_hash text;

CREATE INDEX IF NOT EXISTS idx_manual_review_queue_hash
  ON public.manual_review_queue(document_hash);