
-- PART 1: Add new columns to institution_settings
ALTER TABLE public.institution_settings 
  ADD COLUMN IF NOT EXISTS contact_name text,
  ADD COLUMN IF NOT EXISTS contact_email text,
  ADD COLUMN IF NOT EXISTS contact_phone text,
  ADD COLUMN IF NOT EXISTS institution_type text DEFAULT 'other',
  ADD COLUMN IF NOT EXISTS website_url text,
  ADD COLUMN IF NOT EXISTS business_address text;

-- PART 2: Add user personalization columns to profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS preferred_name text,
  ADD COLUMN IF NOT EXISTS phone text,
  ADD COLUMN IF NOT EXISTS preferred_language text DEFAULT 'en',
  ADD COLUMN IF NOT EXISTS profile_photo_url text,
  ADD COLUMN IF NOT EXISTS vault_display_name text,
  ADD COLUMN IF NOT EXISTS vault_accent_color text DEFAULT '#0ea5e9';

-- PART 3: Create storage buckets
INSERT INTO storage.buckets (id, name, public) VALUES ('institution-logos', 'institution-logos', true) ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('profile-photos', 'profile-photos', true) ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('institution-documents', 'institution-documents', false) ON CONFLICT (id) DO NOTHING;

-- Storage policies for institution-logos bucket
CREATE POLICY "Authenticated users can upload institution logos"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'institution-logos');

CREATE POLICY "Anyone can view institution logos"
  ON storage.objects FOR SELECT TO public
  USING (bucket_id = 'institution-logos');

CREATE POLICY "Authenticated users can update institution logos"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'institution-logos');

CREATE POLICY "Authenticated users can delete institution logos"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'institution-logos');

-- Storage policies for profile-photos bucket
CREATE POLICY "Users can upload own profile photos"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'profile-photos' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Anyone can view profile photos"
  ON storage.objects FOR SELECT TO public
  USING (bucket_id = 'profile-photos');

CREATE POLICY "Users can update own profile photos"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'profile-photos' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users can delete own profile photos"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'profile-photos' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Storage policies for institution-documents bucket  
CREATE POLICY "Institution members can upload institution documents"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'institution-documents');

CREATE POLICY "Institution members can view institution documents"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'institution-documents');

-- PART 4: Document Possession Request table
CREATE TABLE public.document_possession_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id uuid NOT NULL REFERENCES public.institutions(id),
  applicant_user_id uuid NOT NULL,
  submission_id uuid REFERENCES public.intake_submissions(id),
  requested_by uuid NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  document_types text[] NOT NULL DEFAULT '{}',
  legal_basis text NOT NULL,
  legal_basis_detail text,
  retention_period text NOT NULL,
  retention_expires_at timestamp with time zone,
  declined_reason text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  responded_at timestamp with time zone,
  reference_id text,
  applicant_name text
);

ALTER TABLE public.document_possession_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Institution members can view their requests"
  ON public.document_possession_requests FOR SELECT TO authenticated
  USING (is_institutional_member(auth.uid(), institution_id));

CREATE POLICY "Institution members can create requests"
  ON public.document_possession_requests FOR INSERT TO authenticated
  WITH CHECK (is_institutional_member(auth.uid(), institution_id));

CREATE POLICY "Institution members can update their requests"
  ON public.document_possession_requests FOR UPDATE TO authenticated
  USING (is_institutional_member(auth.uid(), institution_id));

CREATE POLICY "Applicants can view requests sent to them"
  ON public.document_possession_requests FOR SELECT TO authenticated
  USING (applicant_user_id = auth.uid());

CREATE POLICY "Applicants can update requests sent to them"
  ON public.document_possession_requests FOR UPDATE TO authenticated
  USING (applicant_user_id = auth.uid());

-- PART 5: Consent Records table (APPEND ONLY - no update/delete policies)
CREATE TABLE public.consent_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  institution_id uuid NOT NULL REFERENCES public.institutions(id),
  possession_request_id uuid NOT NULL REFERENCES public.document_possession_requests(id),
  document_ids uuid[] NOT NULL DEFAULT '{}',
  document_names text[] NOT NULL DEFAULT '{}',
  legal_basis text NOT NULL,
  retention_period text NOT NULL,
  consent_text_hash text NOT NULL,
  consent_given_at timestamp with time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.consent_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own consent records"
  ON public.consent_records FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own consent records"
  ON public.consent_records FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Institution members can view consent records"
  ON public.consent_records FOR SELECT TO authenticated
  USING (is_institutional_member(auth.uid(), institution_id));

-- PART 6: Institution Documents table (documents possessed by institution)
CREATE TABLE public.institution_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id uuid NOT NULL REFERENCES public.institutions(id),
  consent_record_id uuid NOT NULL REFERENCES public.consent_records(id),
  possession_request_id uuid NOT NULL REFERENCES public.document_possession_requests(id),
  original_document_id uuid,
  document_type text NOT NULL,
  file_name text NOT NULL,
  file_path text NOT NULL,
  file_size bigint NOT NULL DEFAULT 0,
  mime_type text NOT NULL,
  encrypted_iv text,
  applicant_name text,
  applicant_user_id uuid NOT NULL,
  transferred_at timestamp with time zone NOT NULL DEFAULT now(),
  retention_expires_at timestamp with time zone,
  retention_expired_notified boolean NOT NULL DEFAULT false,
  deleted_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.institution_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Institution members can view their documents"
  ON public.institution_documents FOR SELECT TO authenticated
  USING (is_institutional_member(auth.uid(), institution_id));

CREATE POLICY "Institution members can insert documents"
  ON public.institution_documents FOR INSERT TO authenticated
  WITH CHECK (is_institutional_member(auth.uid(), institution_id));

CREATE POLICY "Institution members can update documents"
  ON public.institution_documents FOR UPDATE TO authenticated
  USING (is_institutional_member(auth.uid(), institution_id));

CREATE POLICY "Applicants can view documents about them"
  ON public.institution_documents FOR SELECT TO authenticated
  USING (applicant_user_id = auth.uid());

-- PART 7: Document Access Log (APPEND ONLY)
CREATE TABLE public.document_access_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id uuid NOT NULL REFERENCES public.institutions(id),
  institution_document_id uuid NOT NULL REFERENCES public.institution_documents(id),
  consent_record_id uuid NOT NULL REFERENCES public.consent_records(id),
  accessed_by uuid NOT NULL,
  access_type text NOT NULL,
  ip_address text,
  user_agent text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.document_access_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Institution members can view access log"
  ON public.document_access_log FOR SELECT TO authenticated
  USING (is_institutional_member(auth.uid(), institution_id));

CREATE POLICY "Institution members can insert access log"
  ON public.document_access_log FOR INSERT TO authenticated
  WITH CHECK (is_institutional_member(auth.uid(), institution_id));
