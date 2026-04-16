// Periodic sweep: marks devices STALE/UNHEALTHY based on last_seen_at
// and emits "Device Silent" alerts. Designed to be invoked on demand or via cron.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const STALE_MS = 30_000;
const UNHEALTHY_MS = 60_000;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const trace_id = crypto.randomUUID();

  try {
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: devices } = await admin
      .from("device_health")
      .select("device_id, user_id, status, last_seen_at, total_alerts");

    if (!devices || devices.length === 0) {
      return new Response(JSON.stringify({ ok: true, trace_id, evaluated: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const now = Date.now();
    let updated = 0;
    const newAlerts: Array<Record<string, unknown>> = [];

    for (const d of devices) {
      const ms = now - new Date(d.last_seen_at).getTime();
      let next: "healthy" | "stale" | "unhealthy" = "healthy";
      if (ms > UNHEALTHY_MS) next = "unhealthy";
      else if (ms > STALE_MS) next = "stale";

      if (next !== d.status) {
        await admin
          .from("device_health")
          .update({ status: next, last_trace_id: trace_id })
          .eq("device_id", d.device_id);
        updated++;

        if (next === "unhealthy") {
          newAlerts.push({
            device_id: d.device_id,
            user_id: d.user_id,
            trace_id,
            alert_type: "device_silent",
            severity: "high",
            rule_name: "Device Silent",
            description: `No events for ${Math.round(ms / 1000)}s (threshold: 60s)`,
            resolved: false,
          });
        }
      }
    }

    if (newAlerts.length > 0) {
      await admin.from("device_telemetry_alerts").insert(newAlerts);
      // bump alert counts
      for (const a of newAlerts) {
        await admin.rpc("noop").catch(() => {}); // placeholder if needed
      }
    }

    return new Response(
      JSON.stringify({ ok: true, trace_id, evaluated: devices.length, updated, alerts: newAlerts.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("[evaluate-device-health]", trace_id, err);
    return new Response(JSON.stringify({ error: "internal_error", trace_id }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
