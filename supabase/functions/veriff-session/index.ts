import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const VERIFF_API_URL = "https://stationapi.veriff.com/v1";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const veriffApiKey = Deno.env.get("VERIFF_API_KEY");

    if (!veriffApiKey) {
      return new Response(
        JSON.stringify({ error: "Veriff API key not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const url = new URL(req.url);
    const action = url.searchParams.get("action") || "create";

    // CREATE a new Veriff session
    if (action === "create") {
      const body = await req.json().catch(() => ({}));

      const veriffResponse = await fetch(`${VERIFF_API_URL}/sessions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-AUTH-CLIENT": veriffApiKey,
        },
        body: JSON.stringify({
          verification: {
            callback: body.callbackUrl || undefined,
            vendorData: user.id,
            person: body.person || undefined,
          },
        }),
      });

      if (!veriffResponse.ok) {
        const errText = await veriffResponse.text();
        console.error("Veriff session creation failed:", errText);
        return new Response(
          JSON.stringify({ error: "Failed to create verification session" }),
          { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const veriffData = await veriffResponse.json();
      const session = veriffData.verification;

      // Store session in database
      const { error: insertError } = await supabase
        .from("veriff_sessions")
        .insert({
          user_id: user.id,
          session_id: session.id,
          status: session.status || "created",
          verification_url: session.url,
          vendor_data: user.id,
        });

      if (insertError) {
        console.error("Failed to store Veriff session:", insertError);
      }

      return new Response(
        JSON.stringify({
          sessionId: session.id,
          url: session.url,
          status: session.status,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // GET session status
    if (action === "status") {
      const sessionId = url.searchParams.get("sessionId");
      if (!sessionId) {
        return new Response(JSON.stringify({ error: "sessionId required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Check Veriff API for session decision
      const veriffResponse = await fetch(
        `${VERIFF_API_URL}/sessions/${sessionId}/decision`,
        {
          method: "GET",
          headers: { "X-AUTH-CLIENT": veriffApiKey },
        }
      );

      let veriffStatus = "pending";
      let decision = null;
      let reasonCode = null;

      if (veriffResponse.ok) {
        const veriffData = await veriffResponse.json();
        if (veriffData.verification) {
          veriffStatus = veriffData.verification.status;
          decision = veriffData.verification.code?.toString();
          reasonCode = veriffData.verification.reasonCode?.toString();

          // Update local record
          const serviceClient = createClient(
            supabaseUrl,
            Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
          );
          await serviceClient
            .from("veriff_sessions")
            .update({
              status: veriffStatus,
              decision: decision,
              reason_code: reasonCode,
            })
            .eq("session_id", sessionId);
        }
      }

      // Also check local DB
      const { data: localSession } = await supabase
        .from("veriff_sessions")
        .select("*")
        .eq("session_id", sessionId)
        .eq("user_id", user.id)
        .single();

      return new Response(
        JSON.stringify({
          sessionId,
          status: veriffStatus,
          decision,
          reasonCode,
          localSession,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // GET user's latest session
    if (action === "latest") {
      const { data: latestSession } = await supabase
        .from("veriff_sessions")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      return new Response(JSON.stringify({ session: latestSession }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Invalid action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Veriff session error:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
