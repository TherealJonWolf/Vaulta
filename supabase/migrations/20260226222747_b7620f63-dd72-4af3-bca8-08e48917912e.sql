
-- Store vault passphrase verification data (salt + verification hash, NOT the passphrase)
CREATE TABLE public.vault_passphrases (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  salt TEXT NOT NULL,
  verification_hash TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.vault_passphrases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own passphrase data"
  ON public.vault_passphrases FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own passphrase data"
  ON public.vault_passphrases FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own passphrase data"
  ON public.vault_passphrases FOR UPDATE
  USING (auth.uid() = user_id);

CREATE TRIGGER update_vault_passphrases_updated_at
  BEFORE UPDATE ON public.vault_passphrases
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Add encrypted_iv column to documents for per-document IV storage
ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS encrypted_iv TEXT;
