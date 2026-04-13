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

    const userId = "71806196-ec7c-43f0-bf04-77c4e36d8c34";
    const factorId = "af27352b-34d9-4f23-83fa-b5af7f5ac92a";

    // Use REST API directly to delete the factor
    const res = await fetch(`${supabaseUrl}/auth/v1/admin/users/${userId}/factors/${factorId}`, {
      method: "DELETE",
      headers: {
        "Authorization": `Bearer ${serviceRoleKey}`,
        "apikey": serviceRoleKey,
      },
    });

    const body = await res.text();

    if (!res.ok) {
      return new Response(JSON.stringify({ error: body, status: res.status }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Clear recovery codes and mfa flag
    const adminClient = createClient(supabaseUrl, serviceRoleKey);
    await adminClient.from("mfa_recovery_codes").delete().eq("user_id", userId);
    await adminClient.from("profiles").update({ mfa_enabled: false }).eq("user_id", userId);

    return new Response(JSON.stringify({ success: true, deleted_factor: factorId, auth_response: body }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
