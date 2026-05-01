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

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const anonClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await anonClient.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey);
    const { data: roleData } = await adminClient
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .maybeSingle();
    if (!roleData) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const email: string | undefined = body.email?.toLowerCase().trim();
    const reason: string = body.reason || "Manual reinstatement by admin";
    if (!email) {
      return new Response(JSON.stringify({ error: "email required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Look up blacklist entry (for audit trail + associated user id)
    const { data: entry } = await adminClient
      .from("blacklisted_emails")
      .select("id, associated_user_id, reason")
      .eq("email", email)
      .maybeSingle();

    const { data: profile } = await adminClient
      .from("profiles")
      .select("user_id")
      .eq("email", email)
      .maybeSingle();

    const targetUserId = entry?.associated_user_id ?? profile?.user_id ?? null;

    // Remove blacklist entry
    if (entry) {
      const { error: delErr } = await adminClient
        .from("blacklisted_emails")
        .delete()
        .eq("id", entry.id);
      if (delErr) {
        return new Response(JSON.stringify({ error: delErr.message }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Unlock the profile and clear the hosted auth-level ban if present
    if (targetUserId) {
      await adminClient
        .from("profiles")
        .update({ failed_login_attempts: 0, account_locked_at: null })
        .eq("user_id", targetUserId);

      const { error: unbanError } = await adminClient.auth.admin.updateUserById(targetUserId, {
        ban_duration: "none",
      });
      if (unbanError) {
        return new Response(JSON.stringify({ error: `Auth ban could not be cleared: ${unbanError.message}` }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Audit log
    await adminClient.from("security_events").insert({
      user_id: targetUserId,
      event_type: "account_reinstated",
      event_description: "Account reinstated by admin",
      metadata: {
        email,
        reason,
        previous_ban_reason: entry?.reason ?? null,
        reinstated_by: user.id,
        cleared_blacklist: Boolean(entry),
        cleared_auth_ban: Boolean(targetUserId),
      },
    });

    return new Response(
      JSON.stringify({ success: true, email, associated_user_id: targetUserId, cleared_blacklist: Boolean(entry) }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err?.message ?? String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});