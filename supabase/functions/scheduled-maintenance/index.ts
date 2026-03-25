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
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const now = new Date();

    // 1. Clean expired sessions (older than 30 days inactive)
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const { data: expiredSessions } = await supabase
      .from("active_sessions")
      .delete()
      .lt("last_active_at", thirtyDaysAgo)
      .select("id");

    // 2. Apply trust score decay (reduce scores by 1 point per week of inactivity)
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const { data: staleScores } = await supabase
      .from("trust_scores")
      .select("id, user_id, trust_score")
      .lt("calculated_at", sevenDaysAgo);

    let decayCount = 0;
    if (staleScores && staleScores.length > 0) {
      for (const score of staleScores) {
        const decayAmount = 1;
        const newScore = Math.max(0, score.trust_score - decayAmount);

        // Log decay in trust_history
        await supabase.from("trust_history").insert({
          user_id: score.user_id,
          event_type: "weekly_decay",
          trust_score_at_time: newScore,
          trust_delta: -decayAmount,
          decay_applied: decayAmount,
          metadata: { reason: "weekly_inactivity_decay", previous_score: score.trust_score },
        });

        decayCount++;
      }
    }

    // 3. Expire shared profile tokens
    const { data: expiredTokens } = await supabase
      .from("shared_profile_tokens")
      .update({ is_active: false })
      .lt("expires_at", now.toISOString())
      .eq("is_active", true)
      .select("id");

    const summary = {
      expired_sessions_cleaned: expiredSessions?.length ?? 0,
      trust_scores_decayed: decayCount,
      tokens_expired: expiredTokens?.length ?? 0,
      ran_at: now.toISOString(),
    };

    console.log("Scheduled maintenance completed:", summary);

    return new Response(JSON.stringify(summary), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Scheduled maintenance error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
