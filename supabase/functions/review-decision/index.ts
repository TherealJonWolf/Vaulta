import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

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

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { reviewItemId, decision, notes } = await req.json();

    if (!reviewItemId || !["approved", "rejected"].includes(decision)) {
      return new Response(JSON.stringify({ error: "Invalid request: reviewItemId and decision (approved/rejected) required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const serviceClient = createClient(supabaseUrl, serviceKey);

    // Fetch the review item
    const { data: reviewItem, error: fetchErr } = await serviceClient
      .from("manual_review_queue")
      .select("*")
      .eq("id", reviewItemId)
      .single();

    if (fetchErr || !reviewItem) {
      return new Response(JSON.stringify({ error: "Review item not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (reviewItem.status !== "pending") {
      return new Response(JSON.stringify({ error: "Item already reviewed" }), {
        status: 409,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify reviewer has access (institutional member or admin)
    const { data: hasAdmin } = await serviceClient.rpc("has_role", {
      _user_id: user.id,
      _role: "admin",
    });

    let hasAccess = hasAdmin;
    if (!hasAccess && reviewItem.institution_id) {
      const { data: isMember } = await serviceClient.rpc("is_institutional_member", {
        _user_id: user.id,
        _institution_id: reviewItem.institution_id,
      });
      hasAccess = isMember;
    }

    if (!hasAccess) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Update the review item
    const { error: updateErr } = await serviceClient
      .from("manual_review_queue")
      .update({
        status: decision,
        reviewed_by: user.id,
        reviewed_at: new Date().toISOString(),
        review_decision: decision,
        review_notes: notes || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", reviewItemId);

    if (updateErr) {
      return new Response(JSON.stringify({ error: "Failed to update review item" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Feed back into trust score: update the document's verification status
    const documentUserId = reviewItem.user_id;
    const documentId = reviewItem.document_id;

    if (decision === "approved") {
      // Mark document as verified
      await serviceClient
        .from("documents")
        .update({
          is_verified: true,
          verification_result: {
            ...reviewItem.verification_result,
            manual_review: {
              decision: "approved",
              reviewed_by: user.id,
              reviewed_at: new Date().toISOString(),
              notes,
            },
          },
        })
        .eq("id", documentId);

      // Record positive trust history event
      await serviceClient.from("trust_history").insert({
        user_id: documentUserId,
        event_type: "reinforcement",
        trust_score_at_time: 0, // will be recalculated
        trust_delta: 3,
        metadata: {
          source: "manual_review",
          document_id: documentId,
          reviewer: user.id,
          decision: "approved",
        },
      });
    } else {
      // Mark document as not verified
      await serviceClient
        .from("documents")
        .update({
          is_verified: false,
          verification_result: {
            ...reviewItem.verification_result,
            manual_review: {
              decision: "rejected",
              reviewed_by: user.id,
              reviewed_at: new Date().toISOString(),
              notes,
            },
          },
        })
        .eq("id", documentId);

      // Record negative trust history event (3x degradation rate)
      await serviceClient.from("trust_history").insert({
        user_id: documentUserId,
        event_type: "contradiction",
        trust_score_at_time: 0,
        trust_delta: -9,
        metadata: {
          source: "manual_review",
          document_id: documentId,
          reviewer: user.id,
          decision: "rejected",
          reason: notes || "Document rejected during manual review",
        },
      });

      // Flag the document hash
      const { data: docHash } = await serviceClient
        .from("document_hashes")
        .select("sha256_hash")
        .eq("user_id", documentUserId)
        .eq("file_name", reviewItem.file_name)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (docHash?.sha256_hash) {
        await serviceClient.rpc("flag_document_hash", {
          p_hash: docHash.sha256_hash,
          p_reason: `Rejected in manual review: ${notes || "No reason provided"}`,
        });
      }
    }

    // Log activity
    if (reviewItem.institution_id) {
      await serviceClient.from("institutional_activity_log").insert({
        institution_id: reviewItem.institution_id,
        user_id: user.id,
        event_type: `document_review_${decision}`,
        detail: `Document "${reviewItem.file_name}" ${decision} (AI confidence: ${reviewItem.ai_confidence}%)`,
        reference_id: reviewItemId,
      });
    }

    return new Response(
      JSON.stringify({ success: true, decision }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Review decision error:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
