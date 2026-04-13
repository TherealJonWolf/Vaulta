import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const TARGET_USER_ID = "71806196-ec7c-43f0-bf04-77c4e36d8c34";
// One-time use token to prevent replay
const ONE_TIME_TOKEN = "mfa-reset-2026-04-13-vaulta";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { token } = await req.json();
    if (token !== ONE_TIME_TOKEN) {
      return new Response(JSON.stringify({ error: "Invalid token" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    // List MFA factors
    const { data: factorsData, error: factorsError } = await adminClient.auth.admin.mfa.listFactors({
      userId: TARGET_USER_ID,
    });

    if (factorsError) {
      return new Response(JSON.stringify({ error: factorsError.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const factors = factorsData?.factors ?? [];
    const results = [];
    for (const factor of factors) {
      const { error: deleteError } = await adminClient.auth.admin.mfa.deleteFactor({
        userId: TARGET_USER_ID,
        factorId: factor.id,
      });
      results.push({ factorId: factor.id, deleted: !deleteError, error: deleteError?.message ?? null });
    }

    // Clear recovery codes and mfa flag
    await adminClient.from("mfa_recovery_codes").delete().eq("user_id", TARGET_USER_ID);
    await adminClient.from("profiles").update({ mfa_enabled: false }).eq("user_id", TARGET_USER_ID);

    return new Response(JSON.stringify({ success: true, factors_found: factors.length, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
