
-- SOC Module: Security Incidents table
CREATE TABLE public.security_incidents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  severity text NOT NULL DEFAULT 'medium',
  status text NOT NULL DEFAULT 'open',
  category text NOT NULL DEFAULT 'general',
  assigned_to uuid,
  created_by uuid NOT NULL,
  resolved_at timestamp with time zone,
  resolved_by uuid,
  resolution_notes text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.security_incidents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view all incidents" ON public.security_incidents
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can insert incidents" ON public.security_incidents
  FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update incidents" ON public.security_incidents
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Incident Events: links existing security events/alerts to incidents
CREATE TABLE public.incident_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_id uuid NOT NULL REFERENCES public.security_incidents(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  event_source text NOT NULL,
  source_id text,
  user_id uuid,
  ip_address text,
  device_info text,
  severity text NOT NULL DEFAULT 'info',
  title text NOT NULL,
  detail text,
  metadata jsonb DEFAULT '{}'::jsonb,
  occurred_at timestamp with time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.incident_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view all incident events" ON public.incident_events
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can insert incident events" ON public.incident_events
  FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Alert History: persistent log of all alerts sent with delivery tracking
CREATE TABLE public.alert_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_type text NOT NULL,
  severity text NOT NULL DEFAULT 'info',
  category text NOT NULL DEFAULT 'system',
  title text NOT NULL,
  detail text,
  source_id text,
  incident_id uuid REFERENCES public.security_incidents(id),
  delivery_channel text NOT NULL DEFAULT 'email',
  delivery_status text NOT NULL DEFAULT 'pending',
  delivered_at timestamp with time zone,
  acknowledged_at timestamp with time zone,
  acknowledged_by uuid,
  recipient_admin_id uuid NOT NULL,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.alert_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view own alert history" ON public.alert_history
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update own alerts" ON public.alert_history
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "System can insert alerts" ON public.alert_history
  FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Admin Alert Settings: notification preferences per admin (no hardcoded contact info)
CREATE TABLE public.admin_alert_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id uuid NOT NULL UNIQUE,
  alert_email text,
  alert_phone_encrypted text,
  daily_digest_enabled boolean NOT NULL DEFAULT true,
  daily_digest_hour integer NOT NULL DEFAULT 8,
  min_severity_email text NOT NULL DEFAULT 'high',
  categories_enabled text[] NOT NULL DEFAULT '{fraud,auth,upload,trust,system}'::text[],
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.admin_alert_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view own settings" ON public.admin_alert_settings
  FOR SELECT TO authenticated USING (admin_user_id = auth.uid() AND public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can insert own settings" ON public.admin_alert_settings
  FOR INSERT TO authenticated WITH CHECK (admin_user_id = auth.uid() AND public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update own settings" ON public.admin_alert_settings
  FOR UPDATE TO authenticated USING (admin_user_id = auth.uid() AND public.has_role(auth.uid(), 'admin'));

-- Enable realtime for incidents and alerts
ALTER PUBLICATION supabase_realtime ADD TABLE public.security_incidents;
ALTER PUBLICATION supabase_realtime ADD TABLE public.alert_history;
