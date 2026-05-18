import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

/**
 * Phase 3: Fraud-Risk Engine — Aggregator
 *
 * Pulls evidence from existing sources (consistency_findings, document
 * verification_result, manual_review_queue, device_telemetry_alerts) and
 * produces a single weighted risk record in fraud_risk_assessments.
 *
 * Additive only. Does not mutate any source data.
 */

type Signal = {
  code: string;
  label: string;
  severity: "low" | "moderate" | "high" | "critical";
  weight: number;       // 0-100, contribution to aggregate
  detail: string;
  evidence_ref?: Record<string, unknown>;
};

const SEVERITY_FROM_SCORE = (s: number): Signal["severity"] => {
  if (s >= 75) return "critical";
  if (s >= 50) return "high";
  if (s >= 25) return "moderate";
  return "low";
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const service = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userErr } = await userClient.auth.getUser();
    if (userErr || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const submission_id: string | undefined = body.submission_id;
    let user_id: string | undefined = body.user_id;
    let institution_id: string | undefined = body.institution_id;
    let applicant_name: string | null = null;
    let reference_id: string | null = null;

    // If submission, resolve scope
    if (submission_id) {
      const { data: sub } = await service.from("intake_submissions")
        .select("institution_id, applicant_name, reference_id")
        .eq("id", submission_id).maybeSingle();
      if (sub) {
        institution_id = institution_id || sub.institution_id;
        applicant_name = sub.applicant_name;
        reference_id = sub.reference_id;
      }
    }

    // Authorization: institutional member of institution_id OR admin
    let authorized = false;
    if (institution_id) {
      const { data: member } = await service.from("institutional_users")
        .select("id").eq("user_id", user.id).eq("institution_id", institution_id).maybeSingle();
      if (member) authorized = true;
    }
    if (!authorized) {
      const { data: roleRow } = await service.from("user_roles")
        .select("role").eq("user_id", user.id).eq("role", "admin").maybeSingle();
      if (roleRow) authorized = true;
    }
    if (!authorized) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const signals: Signal[] = [];
    const evidence: Array<Record<string, unknown>> = [];

    // --- Source 1: consistency_findings (user-scoped) ---
    if (user_id) {
      const { data: findings } = await service.from("consistency_findings")
        .select("rule_id, rule_name, rule_category, severity, confidence_impact, description, resolved")
        .eq("user_id", user_id).eq("resolved", false).limit(50);
      for (const f of findings || []) {
        const w = Math.min(40, Math.abs(Number(f.confidence_impact) || 0));
        if (w <= 0) continue;
        signals.push({
          code: `CONSISTENCY:${f.rule_id}`,
          label: f.rule_name || "Consistency finding",
          severity: (f.severity as Signal["severity"]) || "low",
          weight: w,
          detail: f.description || "Data consistency rule triggered",
          evidence_ref: { source: "consistency_findings", rule_id: f.rule_id, category: f.rule_category },
        });
      }
    }

    // --- Source 2: manual_review_queue (AI confidence / generated likelihood) ---
    if (user_id) {
      const { data: queue } = await service.from("manual_review_queue")
        .select("file_name, ai_confidence, ai_generated_likelihood, ai_summary, status")
        .eq("user_id", user_id).limit(20);
      for (const q of queue || []) {
        const likelihood = (q.ai_generated_likelihood || "none") as string;
        const conf = Number(q.ai_confidence) || 0;
        let w = 0;
        let sev: Signal["severity"] = "low";
        if (likelihood === "high") { w = 35; sev = "high"; }
        else if (likelihood === "medium") { w = 20; sev = "moderate"; }
        else if (conf < 60) { w = 12; sev = "moderate"; }
        if (w === 0) continue;
        signals.push({
          code: `DOC_INTEGRITY:${q.file_name}`,
          label: "Document integrity concern",
          severity: sev,
          weight: w,
          detail: q.ai_summary || `AI flagged document (${likelihood}, conf ${conf}%)`,
          evidence_ref: { source: "manual_review_queue", file_name: q.file_name },
        });
      }
    }

    // --- Source 3: device_telemetry_alerts (unresolved) ---
    if (user_id) {
      const { data: alerts } = await service.from("device_telemetry_alerts")
        .select("rule_name, severity, alert_type, description, resolved")
        .eq("user_id", user_id).eq("resolved", false).limit(20);
      for (const a of alerts || []) {
        const sev = (a.severity as Signal["severity"]) || "low";
        const w = sev === "critical" ? 30 : sev === "high" ? 22 : sev === "moderate" ? 12 : 6;
        signals.push({
          code: `DEVICE:${a.alert_type}`,
          label: a.rule_name || "Device telemetry alert",
          severity: sev,
          weight: w,
          detail: a.description || "Device anomaly detected",
          evidence_ref: { source: "device_telemetry_alerts", alert_type: a.alert_type },
        });
      }
    }

    // --- Source 4: institution_documents verification_result (if available via documents fk) ---
    if (user_id) {
      const { data: docs } = await service.from("documents")
        .select("file_name, verification_result, is_verified")
        .eq("user_id", user_id).limit(50);
      for (const d of docs || []) {
        const vr = (d.verification_result as any) || {};
        const issues = Array.isArray(vr.issues) ? vr.issues : [];
        if (d.is_verified === false && issues.length > 0) {
          signals.push({
            code: `DOC_VERIFICATION:${d.file_name}`,
            label: "Document verification failed",
            severity: "moderate",
            weight: 15,
            detail: `${issues.length} verification issue(s) on ${d.file_name}`,
            evidence_ref: { source: "documents", file_name: d.file_name, issue_count: issues.length },
          });
        }
      }
    }

    // --- Aggregate ---
    // Use a soft-cap weighted sum: each signal contributes its weight, capped to 100.
    // Severity-weighted multiplier emphasizes critical signals slightly.
    const sevMult: Record<Signal["severity"], number> = { low: 0.6, moderate: 1.0, high: 1.3, critical: 1.6 };
    let raw = 0;
    for (const s of signals) raw += s.weight * sevMult[s.severity];
    const aggregate_score = Math.round(Math.min(100, raw));
    const severity = SEVERITY_FROM_SCORE(aggregate_score);

    // Top contributing signals (max 6 by effective contribution)
    const ranked = [...signals]
      .map((s) => ({ ...s, _contribution: Math.round(s.weight * sevMult[s.severity]) }))
      .sort((a, b) => b._contribution - a._contribution)
      .slice(0, 6);

    evidence.push({
      methodology: "weighted_signal_sum_v1",
      sources_evaluated: ["consistency_findings", "manual_review_queue", "device_telemetry_alerts", "documents"],
      total_signals: signals.length,
      computed_at: new Date().toISOString(),
    });

    // Insert immutable assessment (use service to bypass RLS but record computed_by accurately)
    const insertPayload = {
      user_id: user_id || null,
      institution_id: institution_id || null,
      submission_id: submission_id || null,
      applicant_name,
      reference_id,
      aggregate_score,
      severity,
      top_signals: ranked,
      evidence_refs: evidence,
      methodology_version: "v1",
      computed_by: user.id,
    };
    const { data: inserted, error: insErr } = await service
      .from("fraud_risk_assessments")
      .insert(insertPayload)
      .select()
      .maybeSingle();
    if (insErr) {
      console.error("[aggregate-fraud-risk] insert failed", insErr);
      return new Response(JSON.stringify({ error: insErr.message }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Emit a trust_event for provenance (best-effort, ignore failure)
    if (user_id) {
      await service.from("trust_events").insert({
        user_id,
        event_type: "fraud_risk.assessed",
        source_system: "aggregate-fraud-risk",
        trust_delta: 0,
        severity: severity === "critical" ? "critical" : severity === "high" ? "high" : severity === "moderate" ? "moderate" : "info",
        confidence: 80,
        explanation: `Fraud-risk assessment computed (score ${aggregate_score}, ${signals.length} signals).`,
        evidence_refs: [{ assessment_id: inserted?.id, immutable_hash: inserted?.immutable_hash }],
        metadata: { methodology_version: "v1", submission_id: submission_id || null },
      }).then(() => undefined, () => undefined);
    }

    return new Response(JSON.stringify({ assessment: inserted }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[aggregate-fraud-risk] error", e);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});