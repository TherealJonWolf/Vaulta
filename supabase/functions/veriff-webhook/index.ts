import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { status, verification } = body;

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    console.log(`Veriff webhook received: status=${status}`, verification?.id);

    if (!verification?.id) {
      return new Response(JSON.stringify({ error: "Missing verification ID" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Find the session
    const { data: session } = await supabase
      .from("veriff_sessions")
      .select("*")
      .eq("session_id", verification.id)
      .single();

    if (!session) {
      console.log(`No session found for verification ${verification.id}`);
      return new Response(JSON.stringify({ ok: true, message: "Session not found" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Update session status
    const decision = verification.status === "approved" ? "approved" : verification.status === "declined" ? "declined" : verification.status;
    const reasonCode = verification.reasonCode || null;

    await supabase
      .from("veriff_sessions")
      .update({
        status: decision,
        decision: decision,
        reason_code: reasonCode,
        updated_at: new Date().toISOString(),
      })
      .eq("id", session.id);

    // Notify user
    let title: string;
    let message: string;
    let type: string;

    if (decision === "approved") {
      title = "Identity Verified";
      message = "Your government ID verification has been approved. Your trust score has been updated.";
      type = "success";
    } else if (decision === "declined") {
      title = "Verification Not Approved";
      message = `Your identity verification was not approved${reasonCode ? ` (${reasonCode})` : ""}. You can try again with a different document.`;
      type = "warning";
    } else {
      title = "Verification Update";
      message = `Your identity verification status has been updated to: ${decision}`;
      type = "info";
    }

    await supabase.from("notifications").insert({
      user_id: session.user_id,
      title,
      message,
      type,
      metadata: { session_id: verification.id, decision, reason_code: reasonCode },
    });

    // Log security event
    await supabase.from("security_events").insert({
      user_id: session.user_id,
      event_type: "identity_verification",
      event_description: `Veriff verification ${decision}${reasonCode ? ` (${reasonCode})` : ""}`,
      metadata: { session_id: verification.id, decision },
    });

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Veriff webhook error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
