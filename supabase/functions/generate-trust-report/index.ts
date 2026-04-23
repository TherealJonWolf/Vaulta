// Snapshot Engine for Vaulta Verified Trust Reports.
//
// Responsibilities:
//   1. Authenticate the caller (JWT in Authorization header).
//   2. Pull a full point-in-time view from trust_scores, trust_signals,
//      signal_consents, security_events, evaluation_metadata.
//   3. Aggregate signals into category rollups (no raw signals exposed).
//   4. Build a deterministic JSON snapshot, SHA-256 hash it, and persist
//      to trust_report_snapshots (immutable; no UPDATE/DELETE policies).
//   5. Return the snapshot + hash to the caller for client-side PDF
//      generation. The DB row IS the source of truth for verification.
//
// Future-proofing hooks (declared in payload but unused for v1):
//   - signature_block: reserved for detached digital signatures.
//   - qr_payload: reserved for QR code embedding in the PDF.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.74.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

type SignalCategory =
  | "device_consistency"
  | "geolocation_context"
  | "behavioral_pattern"
  | "utility_corroboration"
  | "cross_account"
  | "identity_verification"
  | "document_consistency";

interface SignalRow {
  category: SignalCategory;
  direction: "positive" | "neutral" | "negative";
  weight: number;
  confidence: number;
  evaluated_at: string;
}

interface ConsentRow {
  category: SignalCategory;
  granted: boolean;
  consent_text_hash: string;
  granted_at: string | null;
  revoked_at: string | null;
  source: string;
  updated_at: string;
}

// Versioned consent text — must match src/lib/signalConsent.ts exactly.
const CONSENT_VERSION = "v1";

// Deterministic JSON serializer: sorted keys recursively. Required so the
// SHA-256 hash is stable and reproducible by third parties.
function canonicalize(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return "[" + value.map(canonicalize).join(",") + "]";
  }
  const keys = Object.keys(value as Record<string, unknown>).sort();
  return (
    "{" +
    keys
      .map(
        (k) =>
          JSON.stringify(k) +
          ":" +
          canonicalize((value as Record<string, unknown>)[k]),
      )
      .join(",") +
    "}"
  );
}

async function sha256Hex(input: string): Promise<string> {
  const buf = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function rollupSignals(signals: SignalRow[]) {
  const buckets = new Map<
    string,
    {
      category: string;
      count: number;
      net_weight: number;
      positive_count: number;
      negative_count: number;
      neutral_count: number;
      avg_confidence: number;
      capped_contribution: number;
    }
  >();

  // Per-category caps mirror evaluate-context-signals so the report
  // honours the same normalization the trust engine applies.
  const CAPS: Record<string, number> = {
    device_consistency: 10,
    geolocation_context: 8,
    behavioral_pattern: 8,
    utility_corroboration: 12,
    cross_account: 20,
    identity_verification: 15,
    document_consistency: 15,
  };

  for (const s of signals) {
    const b = buckets.get(s.category) ?? {
      category: s.category,
      count: 0,
      net_weight: 0,
      positive_count: 0,
      negative_count: 0,
      neutral_count: 0,
      avg_confidence: 0,
      capped_contribution: 0,
    };
    b.count += 1;
    b.net_weight += s.weight;
    b.avg_confidence += s.confidence;
    if (s.direction === "positive") b.positive_count += 1;
    else if (s.direction === "negative") b.negative_count += 1;
    else b.neutral_count += 1;
    buckets.set(s.category, b);
  }

  const result = Array.from(buckets.values()).map((b) => {
    const cap = CAPS[b.category] ?? 10;
    const capped = Math.max(-cap, Math.min(cap, b.net_weight));
    const dominantDirection =
      b.net_weight > 0.01
        ? "positive"
        : b.net_weight < -0.01
          ? "negative"
          : "neutral";
    return {
      category: b.category,
      count: b.count,
      positive_count: b.positive_count,
      negative_count: b.negative_count,
      neutral_count: b.neutral_count,
      net_impact: dominantDirection,
      net_weight: Number(b.net_weight.toFixed(3)),
      capped_contribution: Number(capped.toFixed(3)),
      avg_confidence: Number((b.avg_confidence / b.count).toFixed(3)),
    };
  });
  // Sort for determinism
  result.sort((a, b) => a.category.localeCompare(b.category));
  return result;
}

function summarizeRedactions(events: Array<{ metadata: unknown }>) {
  const redactedFields = new Set<string>();
  let redactedEventCount = 0;
  for (const e of events) {
    const m = e.metadata as { redacted_fields?: unknown } | null;
    if (
      m &&
      Array.isArray((m as { redacted_fields?: unknown[] }).redacted_fields)
    ) {
      redactedEventCount += 1;
      for (const f of (m as { redacted_fields: string[] }).redacted_fields) {
        if (typeof f === "string") redactedFields.add(f);
      }
    }
  }
  return {
    redacted_event_count: redactedEventCount,
    redacted_field_types: Array.from(redactedFields).sort(),
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // 1. Auth
    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace(/^Bearer\s+/i, "");
    if (!token) {
      return new Response(
        JSON.stringify({ error: "missing_authorization" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
    const { data: userRes, error: userErr } = await admin.auth.getUser(token);
    if (userErr || !userRes?.user) {
      return new Response(
        JSON.stringify({ error: "invalid_session" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    const user = userRes.user;
    const userId = user.id;

    const traceId = crypto.randomUUID();
    const generatedAt = new Date().toISOString();

    // 2. Pull source data in parallel
    const [trustScoreRes, signalsRes, consentsRes, evalMetaRes, telemetryRes] =
      await Promise.all([
        admin
          .from("trust_scores")
          .select(
            "trust_score, trust_level, confidence, explanation, calculated_at",
          )
          .eq("user_id", userId)
          .order("calculated_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
        admin
          .from("trust_signals")
          .select("category, direction, weight, confidence, evaluated_at")
          .eq("user_id", userId)
          .gte(
            "evaluated_at",
            new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString(),
          ),
        admin
          .from("signal_consents")
          .select(
            "category, granted, consent_text_hash, granted_at, revoked_at, source, updated_at",
          )
          .eq("user_id", userId),
        admin
          .from("evaluation_metadata")
          .select(
            "jitter_epoch, boundary_events, boundary_hugging_score, last_random_audit_at",
          )
          .eq("user_id", userId)
          .maybeSingle(),
        admin
          .from("device_telemetry_events")
          .select("device_id, metadata")
          .eq("user_id", userId)
          .gte(
            "received_at",
            new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
          )
          .limit(500),
      ]);

    const trustScoreRow = trustScoreRes.data;
    const signals = (signalsRes.data ?? []) as SignalRow[];
    const consents = (consentsRes.data ?? []) as ConsentRow[];
    const evalMeta = evalMetaRes.data;
    const telemetry = telemetryRes.data ?? [];

    if (!trustScoreRow) {
      return new Response(
        JSON.stringify({
          error: "no_trust_score",
          message:
            "No trust score has been calculated yet. Upload documents and complete verification first.",
        }),
        { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // 3. Build privacy-safe rollups
    const signalsSummary = rollupSignals(signals);
    const projectedSignalCounts = signalsSummary.reduce(
      (acc, s) => {
        acc[s.category] = s.count;
        return acc;
      },
      {} as Record<string, number>,
    );

    // Categories the user has NOT consented to are "skipped" in the
    // evaluation pipeline. Surface them so the report is honest about
    // what data could and could not contribute.
    const consentMap = new Map(consents.map((c) => [c.category, c]));
    const ALL_CATEGORIES: SignalCategory[] = [
      "device_consistency",
      "geolocation_context",
      "behavioral_pattern",
      "utility_corroboration",
      "cross_account",
      "identity_verification",
      "document_consistency",
    ];
    const skippedCategories = ALL_CATEGORIES.filter(
      (c) => consentMap.get(c)?.granted !== true,
    );

    const consentSnapshot = ALL_CATEGORIES.map((cat) => {
      const row = consentMap.get(cat);
      return {
        category: cat,
        granted: row?.granted ?? false,
        consent_version: CONSENT_VERSION,
        consent_text_hash: row?.consent_text_hash ?? null,
        granted_at: row?.granted_at ?? null,
        revoked_at: row?.revoked_at ?? null,
        source: row?.source ?? null,
      };
    });

    // 4. Audit metadata — hash device IDs, never expose raw
    const uniqueDeviceIds = new Set<string>();
    for (const t of telemetry) {
      if (t.device_id) uniqueDeviceIds.add(t.device_id);
    }
    const hashedDeviceIds = await Promise.all(
      Array.from(uniqueDeviceIds).map((d) => sha256Hex(d + ":" + userId)),
    );

    const redactionSummary = summarizeRedactions(telemetry);

    // Encryption posture: documents table records encrypted_iv when
    // client-side E2E encryption is in use. Surface it as a coarse flag.
    const { count: totalDocs } = await admin
      .from("documents")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId);
    const { count: encryptedDocs } = await admin
      .from("documents")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .not("encrypted_iv", "is", null);
    const encryptionStatus =
      (totalDocs ?? 0) === 0
        ? "not_applicable"
        : (encryptedDocs ?? 0) === (totalDocs ?? 0)
          ? "all_encrypted"
          : (encryptedDocs ?? 0) > 0
            ? "partial"
            : "none";

    const auditMetadata = {
      trace_id: traceId,
      evaluation_window: {
        signals_lookback_days: 90,
        telemetry_lookback_days: 30,
      },
      projected_signal_counts: projectedSignalCounts,
      skipped_categories: skippedCategories,
      redacted_fields_summary: redactionSummary,
      encryption_status: encryptionStatus,
      device_count: uniqueDeviceIds.size,
      device_ids_hashed: hashedDeviceIds.sort(),
      jitter_epoch: evalMeta?.jitter_epoch ?? null,
      boundary_hugging_score: evalMeta?.boundary_hugging_score ?? null,
      last_random_audit_at: evalMeta?.last_random_audit_at ?? null,
    };

    // 5. Assemble snapshot payload (deterministic, immutable)
    const snapshotPayload = {
      version: "v1",
      generated_at: generatedAt,
      user_id_hash: await sha256Hex("user:" + userId),
      trust_score: Number(trustScoreRow.trust_score),
      trust_level: trustScoreRow.trust_level,
      confidence:
        typeof trustScoreRow.confidence === "string"
          ? trustScoreRow.confidence === "high"
            ? 0.9
            : trustScoreRow.confidence === "medium"
              ? 0.6
              : 0.3
          : Number(trustScoreRow.confidence ?? 0),
      explanation: trustScoreRow.explanation ?? null,
      score_calculated_at: trustScoreRow.calculated_at,
      signals_summary: signalsSummary,
      consent_snapshot: consentSnapshot,
      audit_metadata: auditMetadata,
      // Reserved for future digital signature / QR embedding
      signature_block: null,
      qr_payload: null,
    };

    const canonical = canonicalize(snapshotPayload);
    const reportHash = await sha256Hex(canonical);

    // 6. Persist immutable snapshot row
    const { data: inserted, error: insertErr } = await admin
      .from("trust_report_snapshots")
      .insert({
        user_id: userId,
        trust_score: snapshotPayload.trust_score,
        trust_level: snapshotPayload.trust_level,
        confidence: snapshotPayload.confidence,
        signals_summary: signalsSummary,
        consent_snapshot: consentSnapshot,
        audit_metadata: auditMetadata,
        generated_at: generatedAt,
        report_hash: reportHash,
        version: "v1",
      })
      .select("id, generated_at, report_hash")
      .single();

    if (insertErr) {
      console.error("snapshot insert failed", insertErr);
      return new Response(
        JSON.stringify({ error: "snapshot_insert_failed", detail: insertErr.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // 7. Audit trail — record generation in security_events
    await admin.from("security_events").insert({
      user_id: userId,
      event_type: "trust_report_generated",
      event_description: `Trust report snapshot generated (hash: ${reportHash.slice(0, 12)}…)`,
      metadata: {
        trace_id: traceId,
        report_hash: reportHash,
        snapshot_id: inserted.id,
      },
    });

    return new Response(
      JSON.stringify({
        ok: true,
        snapshot_id: inserted.id,
        report_hash: reportHash,
        generated_at: inserted.generated_at,
        snapshot: snapshotPayload,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("generate-trust-report failure", err);
    return new Response(
      JSON.stringify({ error: "internal_error", detail: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});