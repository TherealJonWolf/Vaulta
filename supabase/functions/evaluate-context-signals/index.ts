// evaluate-context-signals
// Phase 2 of the multi-signal trust enhancement.
//
// PURPOSE
// -------
// Orchestrator that projects existing raw signals (telemetry, consistency
// findings, cross-account signals, integrity factors) into the new
// trust_signals ledger, respecting per-category consent and per-category
// caps. After writing the projection, it triggers the existing
// trust-evolution function so the temporal engine (decay, snap-down,
// inertia) folds the deltas in.
//
// IMPORTANT INVARIANTS
// --------------------
// 1. trust_signals is a PROJECTION, not a source of truth. Raw rows stay
//    in their original tables; we only normalize them here.
// 2. We never write to trust_scores or trust_history directly. The
//    existing trust-evolution function owns those tables.
// 3. Consent gates ingestion AT PROJECTION TIME: a category with no
//    granted consent contributes nothing, regardless of what raw data
//    happens to exist.
// 4. Per-category caps (see CATEGORY_RULES) bound the absolute weighted
//    contribution per evaluation window so a chatty source can't swamp
//    the score.
// 5. Idempotency: each projected row carries a stable rule_id +
//    source_table + source_id triple. Re-running the function for the
//    same window will skip already-projected source rows.
//
// INPUTS
// ------
// POST { user_id?: string, window_hours?: number }
//   - When called with a user JWT and no user_id, evaluates the caller.
//   - When called with an admin JWT or service role, can target any user.
//   - window_hours defaults to 24 and is capped at 720 (30 days).
//
// OUTPUT (intentionally redacted, mirrors trust-evolution's pattern)
// {
//   ok: true,
//   evaluated_user: "<uuid>",
//   window_hours: 24,
//   projected: { device_consistency: 3, geolocation_context: 1, ... },
//   skipped_categories: ["behavioral_pattern"],   // no consent
//   trust_evolution: { ... summary from trust-evolution ... }
// }

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

type SignalCategory =
  | "device_consistency"
  | "geolocation_context"
  | "behavioral_pattern"
  | "utility_corroboration"
  | "cross_account"
  | "identity_verification"
  | "document_consistency";

type Direction = "positive" | "neutral" | "negative";

// ----------------------------------------------------------------------
// Per-category rules. Mirrors §6 of the architecture plan.
// ----------------------------------------------------------------------
interface CategoryRule {
  // Maximum absolute weight applied to a single projected signal.
  maxSingle: number;
  // Maximum cumulative absolute weight over the evaluation window.
  maxCumulative: number;
  // Minimum confidence applied to projected signals (low-quality floor).
  confidenceFloor: number;
  // If true, the category can only ever produce negative signals.
  negativeOnly?: boolean;
  // If true, the category can only ever produce positive signals.
  positiveOnly?: boolean;
  // Default decay window for projected rows (signals expire from
  // contributing weight after this many days).
  decayDays: number;
}

const CATEGORY_RULES: Record<SignalCategory, CategoryRule> = {
  device_consistency:    { maxSingle: 2.0, maxCumulative: 10, confidenceFloor: 0.6, decayDays: 30 },
  geolocation_context:   { maxSingle: 1.5, maxCumulative: 8,  confidenceFloor: 0.5, decayDays: 30 },
  behavioral_pattern:    { maxSingle: 1.0, maxCumulative: 6,  confidenceFloor: 0.4, decayDays: 30 },
  utility_corroboration: { maxSingle: 3.0, maxCumulative: 12, confidenceFloor: 0.7, decayDays: 60 },
  cross_account:         { maxSingle: 5.0, maxCumulative: 20, confidenceFloor: 0.8, decayDays: 90, negativeOnly: true },
  identity_verification: { maxSingle: 5.0, maxCumulative: 5,  confidenceFloor: 0.95, decayDays: 180, positiveOnly: true },
  document_consistency:  { maxSingle: 2.0, maxCumulative: 10, confidenceFloor: 0.6, decayDays: 60 },
};

// Severity → weight magnitude. Used by the consistency_findings projector.
const SEVERITY_WEIGHT: Record<string, number> = {
  low: 0.5,
  medium: 1.0,
  high: 2.0,
  critical: 3.0,
};

interface ProjectedSignal {
  user_id: string;
  category: SignalCategory;
  direction: Direction;
  weight: number;
  confidence: number;
  source_table: string;
  source_id: string | null;
  rule_id: string;
  summary: string;
  evaluated_at: string;
  expires_at: string;
  metadata: Record<string, unknown>;
}

// Apply per-category cap + sign constraints to a candidate row.
// Returns null if the row is rejected (e.g. negativeOnly category with
// a positive signal).
function applyCategoryRules(
  row: ProjectedSignal,
  runningTotals: Map<SignalCategory, number>,
): ProjectedSignal | null {
  const rule = CATEGORY_RULES[row.category];

  // Sign constraints
  if (rule.negativeOnly && row.direction === "positive") return null;
  if (rule.positiveOnly && row.direction === "negative") return null;

  // Confidence floor
  const confidence = Math.max(rule.confidenceFloor, Math.min(1, row.confidence));

  // Single-event cap
  let weight = Math.min(Math.abs(row.weight), rule.maxSingle);

  // Cumulative cap (uses absolute contribution including confidence)
  const used = runningTotals.get(row.category) ?? 0;
  const remaining = Math.max(0, rule.maxCumulative - used);
  const effective = weight * confidence;
  if (effective > remaining) {
    weight = remaining / Math.max(0.0001, confidence);
    if (weight <= 0.01) return null; // category exhausted
  }
  runningTotals.set(row.category, used + weight * confidence);

  return {
    ...row,
    weight: Number(weight.toFixed(2)),
    confidence: Number(confidence.toFixed(2)),
    expires_at: new Date(Date.now() + rule.decayDays * 86_400_000).toISOString(),
  };
}

// ----------------------------------------------------------------------
// Projectors. Each reads from one existing table and yields candidate
// ProjectedSignal rows. They are intentionally tiny — the rule engine
// they read from already did the heavy lifting.
// ----------------------------------------------------------------------

async function projectDeviceTelemetry(
  service: ReturnType<typeof createClient>,
  userId: string,
  sinceISO: string,
  consents: Set<SignalCategory>,
): Promise<ProjectedSignal[]> {
  const out: ProjectedSignal[] = [];
  if (!consents.has("device_consistency") && !consents.has("geolocation_context")) {
    return out;
  }

  // We only need invalid events for negative signals; valid events imply
  // a small positive contribution to device_consistency.
  const { data, error } = await service
    .from("device_telemetry_events")
    .select("id, device_id, is_valid, validation_errors, latitude, longitude, accuracy, received_at")
    .eq("user_id", userId)
    .gte("received_at", sinceISO)
    .order("received_at", { ascending: true })
    .limit(500);

  if (error || !data) return out;

  // Aggregate per-device valid streak as a single positive signal so we
  // don't emit a row per telemetry event (avoids swamping the projection).
  const validByDevice = new Map<string, number>();
  for (const ev of data) {
    if (consents.has("device_consistency")) {
      if (ev.is_valid) {
        validByDevice.set(ev.device_id, (validByDevice.get(ev.device_id) ?? 0) + 1);
      } else {
        out.push({
          user_id: userId,
          category: "device_consistency",
          direction: "negative",
          weight: 1.0,
          confidence: 0.7,
          source_table: "device_telemetry_events",
          source_id: ev.id,
          rule_id: "telemetry_validation_failed",
          summary: "Device sent a malformed telemetry event",
          evaluated_at: new Date().toISOString(),
          expires_at: "",
          metadata: { validation_errors: ev.validation_errors ?? [] },
        });
      }
    }

    // Geolocation: a single low-accuracy reading is neutral; we only
    // surface clearly bad readings as negative signals here. The richer
    // velocity/teleport detection lives in evaluate-device-health.
    if (consents.has("geolocation_context") && ev.latitude != null && ev.accuracy != null && ev.accuracy > 5000) {
      out.push({
        user_id: userId,
        category: "geolocation_context",
        direction: "negative",
        weight: 0.5,
        confidence: 0.5,
        source_table: "device_telemetry_events",
        source_id: ev.id,
        rule_id: "geo_low_accuracy",
        summary: "Location reading had unusually low accuracy",
        evaluated_at: new Date().toISOString(),
        expires_at: "",
        metadata: { accuracy: ev.accuracy },
      });
    }
  }

  if (consents.has("device_consistency")) {
    for (const [deviceId, count] of validByDevice) {
      if (count >= 5) {
        out.push({
          user_id: userId,
          category: "device_consistency",
          direction: "positive",
          weight: Math.min(2.0, 0.3 + count * 0.05),
          confidence: 0.7,
          source_table: "device_telemetry_events",
          source_id: null,
          rule_id: "device_consistent_streak",
          summary: `Device behaved consistently across ${count} recent events`,
          evaluated_at: new Date().toISOString(),
          expires_at: "",
          metadata: { device_id_hash: hashShort(deviceId), event_count: count },
        });
      }
    }
  }

  return out;
}

async function projectConsistencyFindings(
  service: ReturnType<typeof createClient>,
  userId: string,
  sinceISO: string,
  consents: Set<SignalCategory>,
): Promise<ProjectedSignal[]> {
  if (!consents.has("document_consistency")) return [];

  const { data, error } = await service
    .from("consistency_findings")
    .select("id, rule_id, rule_name, severity, description, confidence_impact, created_at")
    .eq("user_id", userId)
    .gte("created_at", sinceISO)
    .limit(200);

  if (error || !data) return [];

  return data.map((f) => {
    const sev = (f.severity ?? "low").toLowerCase();
    const baseWeight = SEVERITY_WEIGHT[sev] ?? 0.5;
    return {
      user_id: userId,
      category: "document_consistency" as const,
      direction: "negative" as const,
      weight: baseWeight,
      confidence: Math.min(1, Math.max(0.4, Math.abs(Number(f.confidence_impact ?? 0)) / 10)),
      source_table: "consistency_findings",
      source_id: f.id,
      rule_id: f.rule_id ?? "consistency_finding",
      summary: `Document inconsistency detected: ${f.rule_name ?? "rule"}`,
      evaluated_at: new Date().toISOString(),
      expires_at: "",
      metadata: { severity: sev },
    };
  });
}

async function projectCrossAccountSignals(
  service: ReturnType<typeof createClient>,
  userId: string,
  sinceISO: string,
  consents: Set<SignalCategory>,
): Promise<ProjectedSignal[]> {
  if (!consents.has("cross_account")) return [];

  // cross_account_signals are not user-scoped in the schema; we approximate
  // membership via the metadata.user_ids array if present.
  const { data, error } = await service
    .from("cross_account_signals")
    .select("id, signal_type, severity, account_count, confidence_score, metadata, last_seen_at")
    .gte("last_seen_at", sinceISO)
    .limit(50);

  if (error || !data) return [];

  const out: ProjectedSignal[] = [];
  for (const s of data) {
    const memberIds = (s.metadata as Record<string, unknown> | null)?.user_ids;
    if (Array.isArray(memberIds) && !memberIds.includes(userId)) continue;

    const sev = (s.severity ?? "low").toLowerCase();
    out.push({
      user_id: userId,
      category: "cross_account",
      direction: "negative",
      weight: SEVERITY_WEIGHT[sev] ?? 1.0,
      confidence: Math.min(1, Math.max(0.6, Number(s.confidence_score ?? 0) / 100)),
      source_table: "cross_account_signals",
      source_id: s.id,
      rule_id: `cross_account_${s.signal_type}`,
      summary: "Cross-account fraud pattern matched",
      evaluated_at: new Date().toISOString(),
      expires_at: "",
      metadata: { account_count: s.account_count, severity: sev },
    });
  }
  return out;
}

async function projectIntegrityFactors(
  service: ReturnType<typeof createClient>,
  userId: string,
  consents: Set<SignalCategory>,
): Promise<ProjectedSignal[]> {
  if (!consents.has("device_consistency") && !consents.has("behavioral_pattern")) return [];

  const { data } = await service
    .from("device_integrity_factors")
    .select("id, integrity_score, abnormal_movement_score, session_integrity_score, device_consistency_score, behavioral_consistency_score, last_evaluated_at")
    .eq("user_id", userId)
    .order("last_evaluated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!data) return [];

  const out: ProjectedSignal[] = [];

  if (consents.has("device_consistency") && data.device_consistency_score >= 70) {
    out.push({
      user_id: userId,
      category: "device_consistency",
      direction: "positive",
      weight: 1.0,
      confidence: 0.8,
      source_table: "device_integrity_factors",
      source_id: data.id,
      rule_id: "integrity_device_consistency_strong",
      summary: "Device fingerprint has remained consistent",
      evaluated_at: new Date().toISOString(),
      expires_at: "",
      metadata: { score: data.device_consistency_score },
    });
  }

  if (consents.has("behavioral_pattern") && data.behavioral_consistency_score > 0) {
    const positive = data.behavioral_consistency_score >= 60;
    out.push({
      user_id: userId,
      category: "behavioral_pattern",
      direction: positive ? "positive" : "negative",
      weight: positive ? 0.8 : 0.6,
      confidence: 0.5,
      source_table: "device_integrity_factors",
      source_id: data.id,
      rule_id: positive ? "behavior_consistent" : "behavior_anomalous",
      summary: positive
        ? "Session rhythm matches the user's typical pattern"
        : "Session rhythm deviated from the user's typical pattern",
      evaluated_at: new Date().toISOString(),
      expires_at: "",
      metadata: { score: data.behavioral_consistency_score },
    });
  }

  return out;
}

// ----------------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------------

function hashShort(input: string): string {
  // Tiny non-cryptographic hash for redacting device IDs in metadata.
  let h = 0;
  for (let i = 0; i < input.length; i++) {
    h = (h * 31 + input.charCodeAt(i)) | 0;
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}

async function loadConsentedCategories(
  service: ReturnType<typeof createClient>,
  userId: string,
): Promise<Set<SignalCategory>> {
  const { data } = await service
    .from("signal_consents")
    .select("category, granted")
    .eq("user_id", userId);

  const consented = new Set<SignalCategory>();
  for (const row of data ?? []) {
    if (row.granted) consented.add(row.category as SignalCategory);
  }
  return consented;
}

async function dedupeAgainstExisting(
  service: ReturnType<typeof createClient>,
  userId: string,
  sinceISO: string,
  candidates: ProjectedSignal[],
): Promise<ProjectedSignal[]> {
  if (candidates.length === 0) return [];

  const { data } = await service
    .from("trust_signals")
    .select("source_table, source_id, rule_id")
    .eq("user_id", userId)
    .gte("evaluated_at", sinceISO);

  const seen = new Set(
    (data ?? []).map((r) => `${r.source_table}|${r.source_id ?? ""}|${r.rule_id ?? ""}`),
  );

  return candidates.filter(
    (c) => !seen.has(`${c.source_table}|${c.source_id ?? ""}|${c.rule_id ?? ""}`),
  );
}

// ----------------------------------------------------------------------
// Main handler
// ----------------------------------------------------------------------

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const trace_id = crypto.randomUUID();

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: callerData, error: callerErr } = await userClient.auth.getUser();
    if (callerErr || !callerData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const caller = callerData.user;
    const service = createClient(supabaseUrl, serviceKey);

    // Parse body
    let body: Record<string, unknown> = {};
    try {
      body = await req.json();
    } catch { /* empty body is fine */ }

    const requestedUserId = typeof body.user_id === "string" ? body.user_id : null;
    const windowHours = Math.min(720, Math.max(1, Number(body.window_hours ?? 24)));

    // Authorization for cross-user evaluation
    let targetUserId = caller.id;
    if (requestedUserId && requestedUserId !== caller.id) {
      const { data: isAdmin } = await service.rpc("has_role", {
        _user_id: caller.id,
        _role: "admin",
      });
      if (!isAdmin) {
        return new Response(JSON.stringify({ error: "Forbidden" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      targetUserId = requestedUserId;
    }

    const sinceISO = new Date(Date.now() - windowHours * 3_600_000).toISOString();
    const consents = await loadConsentedCategories(service, targetUserId);

    // Fan out to projectors
    const [tele, cons, xacc, integ] = await Promise.all([
      projectDeviceTelemetry(service, targetUserId, sinceISO, consents),
      projectConsistencyFindings(service, targetUserId, sinceISO, consents),
      projectCrossAccountSignals(service, targetUserId, sinceISO, consents),
      projectIntegrityFactors(service, targetUserId, consents),
    ]);

    let candidates = [...tele, ...cons, ...xacc, ...integ];

    // Idempotency: drop candidates already projected for this window
    candidates = await dedupeAgainstExisting(service, targetUserId, sinceISO, candidates);

    // Apply per-category caps
    const totals = new Map<SignalCategory, number>();
    const accepted: ProjectedSignal[] = [];
    for (const c of candidates) {
      const shaped = applyCategoryRules(c, totals);
      if (shaped) accepted.push(shaped);
    }

    // Persist
    const projected: Record<string, number> = {};
    if (accepted.length > 0) {
      const { error: insertErr } = await service.from("trust_signals").insert(accepted);
      if (insertErr) {
        console.error("[evaluate-context-signals] insert failed", trace_id, insertErr);
        return new Response(
          JSON.stringify({ error: "Failed to persist signals", trace_id }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      for (const a of accepted) {
        projected[a.category] = (projected[a.category] ?? 0) + 1;
      }
    }

    const skipped_categories = (Object.keys(CATEGORY_RULES) as SignalCategory[]).filter(
      (c) => !consents.has(c),
    );

    // Trigger trust-evolution so the temporal engine folds in the new
    // signals. We invoke it with the caller's auth header so its own
    // auth check passes; if the orchestrator was called by an admin for
    // another user, trust-evolution still uses the caller's JWT but
    // reads the target user's history via service-role queries inside
    // its handler. (No-op for the caller's own evaluation.)
    let evolutionSummary: unknown = null;
    try {
      const evoRes = await fetch(`${supabaseUrl}/functions/v1/trust-evolution`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: authHeader,
        },
        body: JSON.stringify({}),
      });
      const evoText = await evoRes.text();
      try {
        evolutionSummary = JSON.parse(evoText);
      } catch {
        evolutionSummary = { raw: evoText.slice(0, 200) };
      }
    } catch (e) {
      console.warn("[evaluate-context-signals] trust-evolution invoke failed", trace_id, e);
    }

    // Audit row
    await service.from("security_events").insert({
      user_id: targetUserId,
      event_type: "context_signals_evaluated",
      event_description: `Projected ${accepted.length} trust signals across ${Object.keys(projected).length} categories`,
      metadata: {
        trace_id,
        window_hours: windowHours,
        projected,
        skipped_categories,
        invoked_by: caller.id,
      },
    }).then(({ error }) => {
      if (error) console.warn("security_events log failed", error.message);
    });

    return new Response(
      JSON.stringify({
        ok: true,
        trace_id,
        evaluated_user: targetUserId,
        window_hours: windowHours,
        projected,
        skipped_categories,
        trust_evolution: evolutionSummary,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("[evaluate-context-signals]", trace_id, err);
    return new Response(
      JSON.stringify({ error: "Internal server error", trace_id }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
