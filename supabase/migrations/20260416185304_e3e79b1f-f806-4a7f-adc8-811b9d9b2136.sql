-- 1. Add trace_id + received_at to telemetry events
ALTER TABLE public.device_telemetry_events
  ADD COLUMN IF NOT EXISTS trace_id uuid NOT NULL DEFAULT gen_random_uuid(),
  ADD COLUMN IF NOT EXISTS received_at timestamptz NOT NULL DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_device_telemetry_events_trace_id ON public.device_telemetry_events(trace_id);
CREATE INDEX IF NOT EXISTS idx_device_telemetry_events_device_id ON public.device_telemetry_events(device_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_device_telemetry_events_user_id ON public.device_telemetry_events(user_id, created_at DESC);

-- 2. Add trace_id to alerts
ALTER TABLE public.device_telemetry_alerts
  ADD COLUMN IF NOT EXISTS trace_id uuid;

CREATE INDEX IF NOT EXISTS idx_device_telemetry_alerts_trace_id ON public.device_telemetry_alerts(trace_id);
CREATE INDEX IF NOT EXISTS idx_device_telemetry_alerts_device_id ON public.device_telemetry_alerts(device_id, created_at DESC);

-- Remove permissive user-insert path; only service role / admins write alerts now
DROP POLICY IF EXISTS "Users can insert own telemetry alerts" ON public.device_telemetry_alerts;

-- 3. Device health table — server-maintained
CREATE TABLE IF NOT EXISTS public.device_health (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id text NOT NULL UNIQUE,
  user_id uuid,
  status text NOT NULL DEFAULT 'healthy' CHECK (status IN ('healthy', 'stale', 'unhealthy')),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  last_event_id uuid,
  last_trace_id uuid,
  consecutive_identical_readings int NOT NULL DEFAULT 0,
  total_events int NOT NULL DEFAULT 0,
  total_alerts int NOT NULL DEFAULT 0,
  total_dropped int NOT NULL DEFAULT 0,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_device_health_user_id ON public.device_health(user_id);
CREATE INDEX IF NOT EXISTS idx_device_health_last_seen ON public.device_health(last_seen_at DESC);

ALTER TABLE public.device_health ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own device health"
  ON public.device_health FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Admins can view all device health"
  ON public.device_health FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-- INSERT/UPDATE only via service-role edge function (no policy = denied for clients)

CREATE TRIGGER trg_device_health_updated_at
  BEFORE UPDATE ON public.device_health
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 4. Device integrity factors — additive trust dimension
CREATE TABLE IF NOT EXISTS public.device_integrity_factors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  integrity_score int NOT NULL DEFAULT 0 CHECK (integrity_score BETWEEN 0 AND 10),
  device_consistency_score int NOT NULL DEFAULT 0,
  session_integrity_score int NOT NULL DEFAULT 0,
  abnormal_movement_score int NOT NULL DEFAULT 0,
  insight_summary text,
  insights jsonb DEFAULT '[]'::jsonb,
  last_evaluated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.device_integrity_factors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own integrity factors"
  ON public.device_integrity_factors FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Admins can view all integrity factors"
  ON public.device_integrity_factors FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER trg_device_integrity_factors_updated_at
  BEFORE UPDATE ON public.device_integrity_factors
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();