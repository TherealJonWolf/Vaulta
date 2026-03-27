
-- Institutions table
CREATE TABLE IF NOT EXISTS public.institutions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.institutions ENABLE ROW LEVEL SECURITY;

-- Institutional users junction
CREATE TABLE IF NOT EXISTS public.institutional_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  institution_id uuid NOT NULL REFERENCES public.institutions(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'member',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, institution_id)
);
ALTER TABLE public.institutional_users ENABLE ROW LEVEL SECURITY;

-- Intake links
CREATE TABLE IF NOT EXISTS public.intake_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id uuid NOT NULL REFERENCES public.institutions(id),
  created_by uuid NOT NULL,
  token text NOT NULL UNIQUE,
  applicant_name text NOT NULL,
  reference_id text NOT NULL,
  status text NOT NULL DEFAULT 'active',
  expires_at timestamptz NOT NULL,
  submitted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.intake_links ENABLE ROW LEVEL SECURITY;

-- Intake submissions
CREATE TABLE IF NOT EXISTS public.intake_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  intake_link_id uuid NOT NULL REFERENCES public.intake_links(id),
  institution_id uuid NOT NULL REFERENCES public.institutions(id),
  applicant_name text NOT NULL,
  reference_id text NOT NULL,
  document_count integer NOT NULL DEFAULT 0,
  trust_score integer,
  score_state text NOT NULL DEFAULT 'insufficient',
  assessment_narrative text,
  document_types text[] DEFAULT '{}',
  assessed_at timestamptz,
  submitted_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.intake_submissions ENABLE ROW LEVEL SECURITY;

-- Activity log (append-only)
CREATE TABLE IF NOT EXISTS public.institutional_activity_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id uuid NOT NULL REFERENCES public.institutions(id),
  user_id uuid NOT NULL,
  event_type text NOT NULL,
  reference_id text,
  applicant_name text,
  detail text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.institutional_activity_log ENABLE ROW LEVEL SECURITY;

-- Security definer: check institutional membership
CREATE OR REPLACE FUNCTION public.is_institutional_member(_user_id uuid, _institution_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.institutional_users
    WHERE user_id = _user_id AND institution_id = _institution_id
  )
$$;

-- Get user institution
CREATE OR REPLACE FUNCTION public.get_user_institution(_user_id uuid)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT institution_id FROM public.institutional_users
  WHERE user_id = _user_id LIMIT 1
$$;

-- Validate intake token (public access via security definer)
CREATE OR REPLACE FUNCTION public.validate_intake_token(p_token text)
RETURNS TABLE(id uuid, applicant_name text, reference_id text, institution_name text, is_valid boolean)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT il.id, il.applicant_name, il.reference_id, i.name AS institution_name,
    (il.status = 'active' AND il.expires_at > now()) AS is_valid
  FROM public.intake_links il
  JOIN public.institutions i ON i.id = il.institution_id
  WHERE il.token = p_token LIMIT 1;
END;
$$;

-- Auto-provision institutional access for landlords/admins
CREATE OR REPLACE FUNCTION public.ensure_institutional_access(_user_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_institution_id uuid;
  v_institution_name text;
  v_email text;
BEGIN
  SELECT iu.institution_id INTO v_institution_id
  FROM public.institutional_users iu WHERE iu.user_id = _user_id LIMIT 1;
  IF v_institution_id IS NOT NULL THEN
    SELECT name INTO v_institution_name FROM public.institutions WHERE id = v_institution_id;
    RETURN jsonb_build_object('institution_id', v_institution_id, 'institution_name', v_institution_name);
  END IF;
  IF NOT (public.has_role(_user_id, 'landlord') OR public.has_role(_user_id, 'admin')) THEN
    RETURN jsonb_build_object('error', 'not_authorized');
  END IF;
  SELECT p.email INTO v_email FROM public.profiles p WHERE p.user_id = _user_id;
  v_institution_name := COALESCE(NULLIF(split_part(COALESCE(v_email, ''), '@', 2), ''), 'My Organization');
  INSERT INTO public.institutions (name) VALUES (v_institution_name) RETURNING id INTO v_institution_id;
  INSERT INTO public.institutional_users (user_id, institution_id, role) VALUES (_user_id, v_institution_id, 'admin');
  RETURN jsonb_build_object('institution_id', v_institution_id, 'institution_name', v_institution_name);
END;
$$;

-- RLS Policies
CREATE POLICY "Members can view own institution" ON public.institutions
  FOR SELECT TO authenticated USING (public.is_institutional_member(auth.uid(), id));

CREATE POLICY "Members can view own membership" ON public.institutional_users
  FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE POLICY "Members can view institution links" ON public.intake_links
  FOR SELECT TO authenticated USING (public.is_institutional_member(auth.uid(), institution_id));

CREATE POLICY "Members can create links" ON public.intake_links
  FOR INSERT TO authenticated WITH CHECK (public.is_institutional_member(auth.uid(), institution_id));

CREATE POLICY "Members can update links" ON public.intake_links
  FOR UPDATE TO authenticated USING (public.is_institutional_member(auth.uid(), institution_id));

CREATE POLICY "Members can view submissions" ON public.intake_submissions
  FOR SELECT TO authenticated USING (public.is_institutional_member(auth.uid(), institution_id));

CREATE POLICY "Members can view activity log" ON public.institutional_activity_log
  FOR SELECT TO authenticated USING (public.is_institutional_member(auth.uid(), institution_id));

CREATE POLICY "Members can insert activity log" ON public.institutional_activity_log
  FOR INSERT TO authenticated WITH CHECK (public.is_institutional_member(auth.uid(), institution_id));
