
-- Device telemetry events table
CREATE TABLE public.device_telemetry_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  device_id text NOT NULL,
  event_type text NOT NULL DEFAULT 'sensor_reading',
  latitude double precision,
  longitude double precision,
  accuracy double precision,
  alpha double precision,
  beta double precision,
  gamma double precision,
  speed double precision,
  heading double precision,
  altitude double precision,
  is_valid boolean NOT NULL DEFAULT true,
  validation_errors text[] DEFAULT '{}',
  client_timestamp timestamptz NOT NULL DEFAULT now(),
  server_timestamp timestamptz NOT NULL DEFAULT now(),
  processing_latency_ms integer DEFAULT 0,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.device_telemetry_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view all telemetry events"
  ON public.device_telemetry_events FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can insert own telemetry events"
  ON public.device_telemetry_events FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_telemetry_device_id ON public.device_telemetry_events(device_id);
CREATE INDEX idx_telemetry_created_at ON public.device_telemetry_events(created_at DESC);
CREATE INDEX idx_telemetry_user_id ON public.device_telemetry_events(user_id);

-- Device telemetry alerts table
CREATE TABLE public.device_telemetry_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id text NOT NULL,
  user_id uuid,
  alert_type text NOT NULL,
  severity text NOT NULL DEFAULT 'medium',
  rule_name text NOT NULL,
  description text NOT NULL,
  telemetry_event_id uuid REFERENCES public.device_telemetry_events(id),
  resolved boolean NOT NULL DEFAULT false,
  resolved_at timestamptz,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.device_telemetry_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view all telemetry alerts"
  ON public.device_telemetry_alerts FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can insert telemetry alerts"
  ON public.device_telemetry_alerts FOR INSERT
  TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update telemetry alerts"
  ON public.device_telemetry_alerts FOR UPDATE
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can insert own telemetry alerts"
  ON public.device_telemetry_alerts FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_telemetry_alerts_device ON public.device_telemetry_alerts(device_id);
CREATE INDEX idx_telemetry_alerts_created ON public.device_telemetry_alerts(created_at DESC);
