
-- Additive columns for the document-request/share workflow
ALTER TABLE public.document_possession_requests
  ADD COLUMN IF NOT EXISTS request_expires_at timestamptz NOT NULL DEFAULT (now() + interval '30 days'),
  ADD COLUMN IF NOT EXISTS purpose text;

ALTER TABLE public.institution_documents
  ADD COLUMN IF NOT EXISTS share_status text NOT NULL DEFAULT 'shared',
  ADD COLUMN IF NOT EXISTS download_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_downloaded_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_downloaded_by uuid,
  ADD COLUMN IF NOT EXISTS uploaded_via text NOT NULL DEFAULT 'vault';

-- Helper: only the requester or an institutional admin may DOWNLOAD/access blobs
CREATE OR REPLACE FUNCTION public.can_download_institution_doc(_user_id uuid, _doc_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.institution_documents d
    JOIN public.document_possession_requests r ON r.id = d.possession_request_id
    LEFT JOIN public.institutional_users iu
      ON iu.institution_id = d.institution_id AND iu.user_id = _user_id
    WHERE d.id = _doc_id
      AND d.deleted_at IS NULL
      AND (
        r.requested_by = _user_id
        OR iu.role = 'admin'
        OR public.has_role(_user_id, 'admin'::public.app_role)
      )
  )
$$;
