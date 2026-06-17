ALTER TABLE public.institutions ADD COLUMN IF NOT EXISTS region text;
ALTER TABLE public.institution_documents ADD COLUMN IF NOT EXISTS region text;
ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS region text;
CREATE INDEX IF NOT EXISTS idx_institution_documents_region ON public.institution_documents(region);