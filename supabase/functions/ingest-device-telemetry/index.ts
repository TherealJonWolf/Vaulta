// Server-side telemetry ingestion: validate -> persist -> evaluate rules -> update health
// Backend is the source of truth. Client only emits; rules and alerts are computed here.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SPEED_THRESHOLD_KMH = 900;
const STALE_THRESHOLD_MS = 60_000;
const SOFT_STALE_MS = 30_000;
const IDENTICAL_READING_LIMIT = 5;

interface TelemetryPayload {
  device_id: string;
  client_timestamp?: string;
  latitude?: number | null;
  longitude?: number | null;
  accuracy?: number | null;
  altitude?: number | null;
  heading?: number | null;
  speed?: number | null;
  alpha?: number | null;
  beta?: number | null;
  gamma?: number | null;
  event_type?: string;
  metadata?: Record<string, unknown>;
}

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function validate(payload: TelemetryPayload): string[] {
  const errors: string[] = [];
  if (!payload.device_id || typeof payload.device_id !== "string" || payload.device_id.length > 128) {
    errors.push("invalid_device_id");
  }
  const numFields: Array<[string, number | null | undefined]> = [
    ["latitude", payload.latitude],
    ["longitude", payload.longitude],
    ["alpha", payload.alpha],
    ["beta", payload.beta],
    ["gamma", payload.gamma],
  ];
  for (const [name, val] of numFields) {
    if (val != null && (typeof val !== "number" || !Number.isFinite(val))) {
      errors.push(`invalid_${name}`);
    }
  }
  if (payload.latitude != null && (payload.latitude < -90 || payload.latitude > 90)) errors.push("lat_out_of_range");
  if (payload.longitude != null && (payload.longitude < -180 || payload.longitude > 180)) errors.push("lon_out_of_range");
  return errors;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const startedAt = Date.now();
  const trace_id = crypto.randomUUID();

  try {
    // Auth
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized", trace_id }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsErr } = await userClient.auth.getClaims(token);
    if (claimsErr || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized", trace_id }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const user_id = claimsData.claims.sub as string;

    // Service-role client for writes that bypass RLS (alerts, health)
    const admin = createClient(supabaseUrl, serviceKey);

    // Parse + validate
    let payload: TelemetryPayload;
    try {
      payload = await req.json();
    } catch {
      return new Response(JSON.stringify({ error: "invalid_json", trace_id }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const validation_errors = validate(payload);
    const is_valid = validation_errors.length === 0;

    if (!payload.device_id) {
      return new Response(
        JSON.stringify({ error: "device_id required", validation_errors, trace_id }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const received_at = new Date().toISOString();

    // Persist event (always — even invalid, for traceability of dropped data)
    const { data: insertedEvent, error: insertErr } = await admin
      .from("device_telemetry_events")
      .insert({
        user_id,
        device_id: payload.device_id,
        trace_id,
        event_type: payload.event_type ?? "sensor_reading",
        client_timestamp: payload.client_timestamp ?? received_at,
        received_at,
        latitude: payload.latitude ?? null,
        longitude: payload.longitude ?? null,
        accuracy: payload.accuracy ?? null,
        altitude: payload.altitude ?? null,
        heading: payload.heading ?? null,
        speed: payload.speed ?? null,
        alpha: payload.alpha ?? null,
        beta: payload.beta ?? null,
        gamma: payload.gamma ?? null,
        is_valid,
        validation_errors,
        processing_latency_ms: Date.now() - startedAt,
        metadata: payload.metadata ?? {},
      })
      .select("id, created_at")
      .single();

    if (insertErr) {
      console.error("[ingest-device-telemetry] persist failed", trace_id, insertErr);
      return new Response(
        JSON.stringify({ error: "persist_failed", detail: insertErr.message, trace_id }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Load recent events for this device for rule evaluation (last 20)
    const { data: recent } = await admin
      .from("device_telemetry_events")
      .select("id, latitude, longitude, alpha, beta, gamma, created_at, is_valid")
      .eq("device_id", payload.device_id)
      .order("created_at", { ascending: false })
      .limit(20);

    const alertsToInsert: Array<Record<string, unknown>> = [];

    // Rule 1: Impossible Speed (compare latest with previous valid GPS)
    if (is_valid && payload.latitude != null && payload.longitude != null && recent && recent.length >= 2) {
      const prev = recent.find((e) => e.id !== insertedEvent.id && e.latitude != null && e.longitude != null);
      if (prev) {
        const distKm = haversineKm(
          payload.latitude,
          payload.longitude!,
          prev.latitude as number,
          prev.longitude as number,
        );
        const hours =
          (new Date(received_at).getTime() - new Date(prev.created_at as string).getTime()) / 3_600_000;
        if (hours > 0) {
          const speedKmh = distKm / hours;
          if (speedKmh > SPEED_THRESHOLD_KMH) {
            alertsToInsert.push({
              device_id: payload.device_id,
              user_id,
              trace_id,
              telemetry_event_id: insertedEvent.id,
              alert_type: "location_teleport",
              severity: "critical",
              rule_name: "Impossible Speed",
              description: `Device moved ${distKm.toFixed(0)}km in ${(hours * 60).toFixed(1)}min (${speedKmh.toFixed(0)} km/h)`,
              resolved: false,
            });
          }
        }
      }
    }

    // Rule 2: Stale Orientation
    let consecutiveIdentical = 0;
    if (payload.alpha != null) {
      const orient = (recent ?? []).filter((e) => e.alpha != null);
      const head = orient[0];
      if (head && head.alpha === payload.alpha && head.beta === payload.beta && head.gamma === payload.gamma) {
        // count back through identical readings
        consecutiveIdentical = 1;
        for (let i = 0; i < orient.length; i++) {
          const e = orient[i];
          if (e.alpha === payload.alpha && e.beta === payload.beta && e.gamma === payload.gamma) {
            consecutiveIdentical++;
          } else break;
        }
      }
      if (consecutiveIdentical >= IDENTICAL_READING_LIMIT) {
        alertsToInsert.push({
          device_id: payload.device_id,
          user_id,
          trace_id,
          telemetry_event_id: insertedEvent.id,
          alert_type: "stale_orientation",
          severity: "medium",
          rule_name: "Stale Orientation",
          description: `Orientation unchanged across ${consecutiveIdentical} readings (α=${payload.alpha}, β=${payload.beta}, γ=${payload.gamma})`,
          resolved: false,
        });
      }
    }

    // Insert alerts
    if (alertsToInsert.length > 0) {
      const { error: alertErr } = await admin.from("device_telemetry_alerts").insert(alertsToInsert);
      if (alertErr) console.error("[ingest-device-telemetry] alert insert failed", trace_id, alertErr);
    }

    // Upsert device health
    const { data: existingHealth } = await admin
      .from("device_health")
      .select("total_events, total_alerts, total_dropped, consecutive_identical_readings")
      .eq("device_id", payload.device_id)
      .maybeSingle();

    const healthRow = {
      device_id: payload.device_id,
      user_id,
      status: "healthy" as const,
      last_seen_at: received_at,
      last_event_id: insertedEvent.id,
      last_trace_id: trace_id,
      consecutive_identical_readings: consecutiveIdentical,
      total_events: (existingHealth?.total_events ?? 0) + 1,
      total_alerts: (existingHealth?.total_alerts ?? 0) + alertsToInsert.length,
      total_dropped: (existingHealth?.total_dropped ?? 0) + (is_valid ? 0 : 1),
    };

    await admin.from("device_health").upsert(healthRow, { onConflict: "device_id" });

    return new Response(
      JSON.stringify({
        ok: true,
        trace_id,
        event_id: insertedEvent.id,
        is_valid,
        validation_errors,
        alerts_generated: alertsToInsert.length,
        processing_latency_ms: Date.now() - startedAt,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("[ingest-device-telemetry] unexpected", trace_id, err);
    return new Response(
      JSON.stringify({ error: "internal_error", trace_id }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
