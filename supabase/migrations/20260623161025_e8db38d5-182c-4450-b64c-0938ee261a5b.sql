
-- 1. Institution passphrases table (zero-knowledge: server only stores ciphertext + salt + public key)
CREATE TABLE IF NOT EXISTS public.institution_passphrases (
  institution_id uuid PRIMARY KEY REFERENCES public.institutions(id) ON DELETE CASCADE,
  salt text NOT NULL,
  verify_blob text NOT NULL,
  wrapped_private_key text NOT NULL,
  public_key text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.institution_passphrases TO authenticated;
GRANT ALL ON public.institution_passphrases TO service_role;

ALTER TABLE public.institution_passphrases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can read their institution passphrase metadata"
  ON public.institution_passphrases FOR SELECT TO authenticated
  USING (public.is_institutional_member(auth.uid(), institution_id));

CREATE POLICY "Admin members can create their institution passphrase"
  ON public.institution_passphrases FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.institutional_users iu
      WHERE iu.user_id = auth.uid()
        AND iu.institution_id = institution_passphrases.institution_id
        AND iu.role = 'admin'
    )
  );

-- No UPDATE policy: passphrase is write-once. Rotation requires service_role.

CREATE TRIGGER institution_passphrases_updated_at
  BEFORE UPDATE ON public.institution_passphrases
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2. Envelope encryption columns on institution_documents
ALTER TABLE public.institution_documents
  ADD COLUMN IF NOT EXISTS wrapped_key text,
  ADD COLUMN IF NOT EXISTS iv text,
  ADD COLUMN IF NOT EXISTS encryption_version text;

-- 3. Encrypted payload on intake_submissions (plaintext columns kept for back-compat)
ALTER TABLE public.intake_submissions
  ADD COLUMN IF NOT EXISTS encrypted_payload text,
  ADD COLUMN IF NOT EXISTS payload_wrapped_key text,
  ADD COLUMN IF NOT EXISTS payload_iv text,
  ADD COLUMN IF NOT EXISTS encryption_version text;

-- 4. Encrypted reviewer notes
ALTER TABLE public.institutional_review_logs
  ADD COLUMN IF NOT EXISTS encrypted_note text,
  ADD COLUMN IF NOT EXISTS note_wrapped_key text,
  ADD COLUMN IF NOT EXISTS note_iv text,
  ADD COLUMN IF NOT EXISTS encryption_version text;

ALTER TABLE public.manual_review_queue
  ADD COLUMN IF NOT EXISTS encrypted_note text,
  ADD COLUMN IF NOT EXISTS note_wrapped_key text,
  ADD COLUMN IF NOT EXISTS note_iv text,
  ADD COLUMN IF NOT EXISTS encryption_version text;

-- 5. Public-key lookup for intake flow (no private material exposed)
CREATE OR REPLACE FUNCTION public.get_institution_public_key_for_token(p_token text)
RETURNS TABLE(institution_id uuid, public_key text)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT ip.institution_id, ip.public_key
  FROM public.intake_links il
  JOIN public.institution_passphrases ip ON ip.institution_id = il.institution_id
  WHERE il.token = p_token
    AND il.status = 'active'
    AND il.expires_at > now()
  LIMIT 1;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_institution_public_key_for_token(text) TO anon, authenticated;
