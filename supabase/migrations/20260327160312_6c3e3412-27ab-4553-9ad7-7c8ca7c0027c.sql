
-- Institution settings for branding personalization
-- Each institution gets exactly one settings row, enforced by unique constraint
CREATE TABLE public.institution_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id UUID NOT NULL REFERENCES public.institutions(id) ON DELETE CASCADE,
  display_name TEXT,
  logo_path TEXT,
  accent_color TEXT DEFAULT '#0f172a',
  welcome_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (institution_id)
);

-- RLS: strict isolation per institution
ALTER TABLE public.institution_settings ENABLE ROW LEVEL SECURITY;

-- Members can read their own institution's settings
CREATE POLICY "Institution members can view their settings"
ON public.institution_settings FOR SELECT TO authenticated
USING (public.is_institutional_member(auth.uid(), institution_id));

-- Members can insert their institution's settings
CREATE POLICY "Institution members can insert settings"
ON public.institution_settings FOR INSERT TO authenticated
WITH CHECK (public.is_institutional_member(auth.uid(), institution_id));

-- Members can update their own institution's settings
CREATE POLICY "Institution members can update their settings"
ON public.institution_settings FOR UPDATE TO authenticated
USING (public.is_institutional_member(auth.uid(), institution_id))
WITH CHECK (public.is_institutional_member(auth.uid(), institution_id));

-- Public read access for submit page (applicants need to see branding)
CREATE POLICY "Public can read institution settings by id"
ON public.institution_settings FOR SELECT TO anon
USING (true);

-- Auto-update updated_at
CREATE TRIGGER update_institution_settings_updated_at
  BEFORE UPDATE ON public.institution_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
