ALTER TABLE public.documents ADD COLUMN is_verified boolean NOT NULL DEFAULT false;
ALTER TABLE public.documents ADD COLUMN verification_result jsonb DEFAULT '{}'::jsonb;