import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Verify the caller is an admin
    const authHeader = req.headers.get("Authorization")!;
    const anonClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await anonClient.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey);
    const { data: roleData } = await adminClient.from("user_roles").select("role").eq("user_id", user.id).eq("role", "admin").maybeSingle();
    if (!roleData) {
      return new Response(JSON.stringify({ error: "Forbidden – admin role required" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { target_user_id } = await req.json();
    if (!target_user_id) {
      return new Response(JSON.stringify({ error: "target_user_id required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // List MFA factors for the target user
    const { data: factorsData, error: factorsError } = await adminClient.auth.admin.mfa.listFactors({
      userId: target_user_id,
    });

    if (factorsError) {
      return new Response(JSON.stringify({ error: factorsError.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const factors = factorsData?.factors ?? [];
    if (factors.length === 0) {
      return new Response(JSON.stringify({ success: true, message: "No MFA factors found" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Unenroll all factors
    const results = [];
    for (const factor of factors) {
      const { error: deleteError } = await adminClient.auth.admin.mfa.deleteFactor({
        userId: target_user_id,
        factorId: factor.id,
      });
      results.push({ factorId: factor.id, deleted: !deleteError, error: deleteError?.message ?? null });
    }

    // Also clear recovery codes
    await adminClient.from("mfa_recovery_codes").delete().eq("user_id", target_user_id);

    // Update profile mfa_enabled flag
    await adminClient.from("profiles").update({ mfa_enabled: false }).eq("user_id", target_user_id);

    return new Response(JSON.stringify({ success: true, factors_removed: results.length, details: results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
