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
    const { token } = await req.json();
    if (token !== "mfa-reset-2026-04-13-vaulta") {
      return new Response(JSON.stringify({ error: "Invalid token" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    const userId = "71806196-ec7c-43f0-bf04-77c4e36d8c34";
    const factorId = "af27352b-34d9-4f23-83fa-b5af7f5ac92a";

    // Delete the specific factor
    const { data, error } = await adminClient.auth.admin.mfa.deleteFactor({
      userId: userId,
      factorId: factorId,
    });

    if (error) {
      return new Response(JSON.stringify({ error: error.message, code: error.status }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Clear recovery codes and mfa flag
    await adminClient.from("mfa_recovery_codes").delete().eq("user_id", userId);
    await adminClient.from("profiles").update({ mfa_enabled: false }).eq("user_id", userId);

    return new Response(JSON.stringify({ success: true, deleted_factor: factorId }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
