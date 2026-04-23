// Public verification endpoint for Vaulta Verified Trust Reports.
//
// Hash-only lookup — exposes ONLY:
//   - valid: boolean
//   - generated_at
//   - trust_score
//   - trust_level
//   - version
//
// Never returns user_id, signals, consents, or audit metadata. A third
// party (landlord, lender, auditor) holding only the report hash can
// confirm a PDF is authentic and unmodified without learning anything
// about the underlying user.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.74.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

const HEX64 = /^[a-f0-9]{64}$/i;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    let hash: string | null = null;
    if (req.method === "GET") {
      const url = new URL(req.url);
      hash = url.searchParams.get("hash");
    } else if (req.method === "POST") {
      const body = await req.json().catch(() => ({}));
      hash = typeof body?.report_hash === "string" ? body.report_hash : null;
    }

    if (!hash || !HEX64.test(hash)) {
      return new Response(
        JSON.stringify({
          valid: false,
          error: "invalid_hash_format",
          message: "Provide a 64-character hex SHA-256 report hash.",
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Use anon client to invoke the security-definer RPC. RLS on the
    // table itself blocks anonymous SELECT; the function exposes only
    // the safe verification fields.
    const client = createClient(SUPABASE_URL, ANON_KEY);
    const { data, error } = await client.rpc("verify_trust_report_by_hash", {
      p_hash: hash.toLowerCase(),
    });

    if (error) {
      console.error("verify rpc error", error);
      return new Response(
        JSON.stringify({ valid: false, error: "lookup_failed" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const row = Array.isArray(data) ? data[0] : data;
    if (!row) {
      return new Response(
        JSON.stringify({
          valid: false,
          message: "No report found for this hash.",
        }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    return new Response(
      JSON.stringify({
        valid: true,
        generated_at: row.generated_at,
        trust_score: Number(row.trust_score),
        trust_level: row.trust_level,
        version: row.version,
        report_hash: hash.toLowerCase(),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("verify-trust-report error", err);
    return new Response(
      JSON.stringify({ valid: false, error: "internal_error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});