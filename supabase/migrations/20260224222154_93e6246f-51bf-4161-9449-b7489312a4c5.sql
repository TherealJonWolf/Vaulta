
-- Table for SHA-256 document fingerprints and cross-user duplicate detection
CREATE TABLE public.document_hashes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  sha256_hash TEXT NOT NULL,
  user_id UUID NOT NULL,
  file_name TEXT NOT NULL,
  file_size BIGINT NOT NULL,
  is_flagged BOOLEAN NOT NULL DEFAULT false,
  flag_reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Index for fast hash lookups
CREATE INDEX idx_document_hashes_sha256 ON public.document_hashes (sha256_hash);
CREATE INDEX idx_document_hashes_user ON public.document_hashes (user_id);

-- Enable RLS
ALTER TABLE public.document_hashes ENABLE ROW LEVEL SECURITY;

-- Users can insert their own hashes
CREATE POLICY "Users can insert their own document hashes"
ON public.document_hashes FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Users can view their own hashes
CREATE POLICY "Users can view their own document hashes"
ON public.document_hashes FOR SELECT
USING (auth.uid() = user_id);

-- Function to check if a hash has been flagged by any user (cross-user detection)
CREATE OR REPLACE FUNCTION public.check_document_hash(p_hash TEXT)
RETURNS TABLE(is_flagged BOOLEAN, flag_reason TEXT, duplicate_count BIGINT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    COALESCE(bool_or(dh.is_flagged), false) AS is_flagged,
    MAX(dh.flag_reason) AS flag_reason,
    COUNT(DISTINCT dh.user_id) AS duplicate_count
  FROM public.document_hashes dh
  WHERE dh.sha256_hash = p_hash;
END;
$$;

-- Function to flag a hash across all records
CREATE OR REPLACE FUNCTION public.flag_document_hash(p_hash TEXT, p_reason TEXT)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.document_hashes
  SET is_flagged = true, flag_reason = p_reason
  WHERE sha256_hash = p_hash;
END;
$$;
