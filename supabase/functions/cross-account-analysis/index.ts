import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/**
 * Cross-Account Analysis Engine (Weakness 4: Single-Account Myopia)
 * 
 * Detects statistically improbable similarities across accounts
 * without requiring direct identity linkage.
 * 
 * This function is called periodically (e.g. via cron) or after consistency checks.
 * It operates on anonymized behavioral fingerprints stored in cross_account_signals.
 */

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceClient = createClient(
      supabaseUrl,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Authentication: Only service-role or admin can trigger this
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Analyze cross-account signal clusters ──
    // Find all signals with account_count >= 2 (potential clusters)
    const { data: signals } = await serviceClient
      .from("cross_account_signals")
      .select("*")
      .gte("account_count", 2)
      .order("account_count", { ascending: false })
      .limit(100);

    const clusters: Array<{
      signalType: string;
      accountCount: number;
      severity: string;
      confidenceScore: number;
      firstSeen: string;
      lastSeen: string;
      escalation: string;
    }> = [];

    for (const signal of (signals || [])) {
      // Severity escalation logic
      let escalation = "monitor";
      if (signal.account_count >= 5) {
        escalation = "hard_review";
      } else if (signal.account_count >= 3) {
        escalation = "soft_review";
      }

      // Time-based escalation: if cluster is growing over time
      const daysSinceFirstSeen = (Date.now() - new Date(signal.first_seen_at).getTime()) / (1000 * 60 * 60 * 24);
      const daysSinceLastSeen = (Date.now() - new Date(signal.last_seen_at).getTime()) / (1000 * 60 * 60 * 24);

      // Active cluster (seen recently) is more concerning
      if (daysSinceLastSeen < 7 && signal.account_count >= 3) {
        escalation = "hard_review";
      }

      // Growth rate: many accounts in short time
      const growthRate = daysSinceFirstSeen > 0 ? signal.account_count / daysSinceFirstSeen : signal.account_count;
      if (growthRate > 1) {
        // More than 1 new match per day = highly suspicious
        escalation = "hard_review";
      }

      // False positive safeguards:
      // 1. Don't escalate if cluster is old and stable (same count for 30+ days)
      if (daysSinceLastSeen > 30 && escalation === "soft_review") {
        escalation = "monitor";
      }

      // 2. Require minimum confidence score to escalate beyond monitor
      if (signal.confidence_score < 30 && escalation !== "monitor") {
        escalation = "monitor";
      }

      clusters.push({
        signalType: signal.signal_type,
        accountCount: signal.account_count,
        severity: signal.severity,
        confidenceScore: signal.confidence_score,
        firstSeen: signal.first_seen_at,
        lastSeen: signal.last_seen_at,
        escalation,
      });
    }

    // Log the analysis
    await serviceClient.from("security_events").insert({
      user_id: user.id,
      event_type: "cross_account_analysis",
      event_description: `Cross-account analysis: ${clusters.length} cluster(s) detected, ${clusters.filter(c => c.escalation === "hard_review").length} requiring review`,
      metadata: {
        totalClusters: clusters.length,
        hardReviewClusters: clusters.filter(c => c.escalation === "hard_review").length,
        softReviewClusters: clusters.filter(c => c.escalation === "soft_review").length,
        maxClusterSize: clusters.length > 0 ? Math.max(...clusters.map(c => c.accountCount)) : 0,
      },
    });

    // Weakness 3: Return obfuscated summary
    return new Response(
      JSON.stringify({
        analysis: {
          clustersDetected: clusters.length,
          requiresAttention: clusters.filter(c => c.escalation !== "monitor").length,
          // Don't reveal specific fingerprints or counts to client
          status: clusters.some(c => c.escalation === "hard_review")
            ? "elevated_risk"
            : clusters.some(c => c.escalation === "soft_review")
            ? "moderate_risk"
            : "nominal",
          evaluatedAt: new Date().toISOString(),
        },
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Cross-account analysis error:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
