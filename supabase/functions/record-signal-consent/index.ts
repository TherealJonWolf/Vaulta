// record-signal-consent
// Phase 1 of the multi-signal trust enhancement.
//
// Purpose: write or update a per-category consent decision for the
// authenticated user, hash the exact consent text version they saw, and
// log the change to security_events for auditability.
//
// Integration notes:
// - This function is the ONLY supported writer to signal_consents from
//   the client side. The table itself allows user inserts/updates under
//   RLS, but routing through the function gives us:
//     * server-computed consent_text_hash (clients can't lie about what
//       text they agreed to)
//     * a single audit funnel into security_events
//     * a place to add future side effects (e.g. immediate revocation
//       cleanup) without touching the client.
// - Categories that are "implicitly consented" elsewhere (e.g. identity
//   verification via Veriff, document_consistency via uploads) can still
//   be recorded here with source='system_default' for completeness.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const VALID_CATEGORIES = new Set([
  "device_consistency",
  "geolocation_context",
  "behavioral_pattern",
  "utility_corroboration",
  "cross_account",
  "identity_verification",
  "document_consistency",
]);

const VALID_SOURCES = new Set([
  "vault_settings",
  "onboarding",
  "system_default",
]);

async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const buf = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

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

    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const user = userData.user;

    // Parse + validate body. Lightweight inline validation to avoid an
    // extra dependency for one endpoint.
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return new Response(JSON.stringify({ error: "Invalid JSON" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { category, granted, consent_text, source } =
      (body ?? {}) as Record<string, unknown>;

    if (typeof category !== "string" || !VALID_CATEGORIES.has(category)) {
      return new Response(
        JSON.stringify({ error: "Invalid category" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    if (typeof granted !== "boolean") {
      return new Response(
        JSON.stringify({ error: "granted must be boolean" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    if (typeof consent_text !== "string" || consent_text.length < 1 || consent_text.length > 5000) {
      return new Response(
        JSON.stringify({ error: "consent_text required (1..5000 chars)" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    const consentSource = typeof source === "string" && VALID_SOURCES.has(source)
      ? source
      : "vault_settings";

    const consentHash = await sha256Hex(consent_text);
    const now = new Date().toISOString();

    // Use service role for the write so we control exactly which fields
    // are persisted (clients can't smuggle in a fake granted_at).
    const service = createClient(supabaseUrl, serviceKey);

    const upsertPayload = {
      user_id: user.id,
      category,
      granted,
      granted_at: granted ? now : null,
      revoked_at: granted ? null : now,
      consent_text_hash: consentHash,
      source: consentSource,
      updated_at: now,
    };

    const { data: row, error: upsertErr } = await service
      .from("signal_consents")
      .upsert(upsertPayload, { onConflict: "user_id,category" })
      .select()
      .single();

    if (upsertErr) {
      console.error("signal_consents upsert failed", upsertErr);
      return new Response(
        JSON.stringify({ error: "Failed to record consent" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Audit trail. Best-effort; do not fail the request if logging fails.
    await service.from("security_events").insert({
      user_id: user.id,
      event_type: granted ? "signal_consent_granted" : "signal_consent_revoked",
      event_description: `Signal consent ${granted ? "granted" : "revoked"} for category '${category}'`,
      metadata: {
        category,
        source: consentSource,
        consent_text_hash: consentHash,
      },
    }).then(({ error }) => {
      if (error) console.warn("security_events log failed", error.message);
    });

    return new Response(
      JSON.stringify({
        ok: true,
        consent: {
          category: row.category,
          granted: row.granted,
          granted_at: row.granted_at,
          revoked_at: row.revoked_at,
          source: row.source,
        },
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("record-signal-consent error", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
