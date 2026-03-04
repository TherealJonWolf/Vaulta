import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/**
 * Trust Evolution Engine (Weakness 2: Longitudinal Memory)
 * 
 * Models trust as a function of time, not just current state.
 * Trust increases slowly (inertia), degrades rapidly (snap-down),
 * and decays when unreinforced.
 */

// Trust inertia constants
const TRUST_GAIN_RATE = 0.5;     // Points per reinforcement event (slow build)
const TRUST_LOSS_MULTIPLIER = 3; // Contradictions degrade 3x faster than reinforcements build
const DECAY_RATE_PER_DAY = 0.15; // Daily decay when trust is unreinforced
const MAX_DECAY_PER_PERIOD = 10; // Cap total decay per evaluation
const SNAP_DOWN_THRESHOLD = 2;   // Number of contradictions that trigger snap-down
const SNAP_DOWN_PENALTY = 15;    // Immediate penalty on snap-down

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY")!;

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

    const serviceClient = createClient(
      supabaseUrl,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Fetch trust history for this user (last 90 days)
    const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
    const { data: history } = await serviceClient
      .from("trust_history")
      .select("*")
      .eq("user_id", user.id)
      .gte("created_at", ninetyDaysAgo)
      .order("created_at", { ascending: true });

    // Fetch current trust score
    const { data: currentTrust } = await serviceClient
      .from("trust_scores")
      .select("trust_score, calculated_at")
      .eq("user_id", user.id)
      .order("calculated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const currentScore = currentTrust?.trust_score ?? 50;
    const lastEvaluatedAt = currentTrust?.calculated_at ? new Date(currentTrust.calculated_at) : new Date();

    // ── Calculate time-based trust decay ──
    const daysSinceLastEvaluation = (Date.now() - lastEvaluatedAt.getTime()) / (1000 * 60 * 60 * 24);
    let decayAmount = 0;

    if (daysSinceLastEvaluation > 7) {
      // Decay starts after 7 days of inactivity
      const decayDays = daysSinceLastEvaluation - 7;
      decayAmount = Math.min(MAX_DECAY_PER_PERIOD, decayDays * DECAY_RATE_PER_DAY);
    }

    // ── Calculate trust provenance ──
    const reinforcements = (history || []).filter(h => h.event_type === "reinforcement");
    const contradictions = (history || []).filter(h => h.event_type === "contradiction");
    const decayEvents = (history || []).filter(h => h.event_type === "decay");

    // Trust provenance: how was trust earned?
    const allRulesSatisfied: Record<string, number> = {};
    const allRulesViolated: Record<string, number> = {};

    for (const event of (history || [])) {
      for (const rule of (event.rules_satisfied || [])) {
        allRulesSatisfied[rule] = (allRulesSatisfied[rule] || 0) + 1;
      }
      for (const rule of (event.rules_violated || [])) {
        allRulesViolated[rule] = (allRulesViolated[rule] || 0) + 1;
      }
    }

    // Time since last contradiction
    const lastContradiction = contradictions.length > 0
      ? contradictions[contradictions.length - 1]
      : null;
    const daysSinceContradiction = lastContradiction
      ? (Date.now() - new Date(lastContradiction.created_at).getTime()) / (1000 * 60 * 60 * 24)
      : Infinity;

    // ── Apply trust inertia ──
    let trustDelta = 0;

    // Reinforcement: slow build
    const recentReinforcements = reinforcements.filter(
      r => (Date.now() - new Date(r.created_at).getTime()) < 30 * 24 * 60 * 60 * 1000
    ).length;
    trustDelta += recentReinforcements * TRUST_GAIN_RATE;

    // Contradiction: rapid degrade
    const recentContradictions = contradictions.filter(
      c => (Date.now() - new Date(c.created_at).getTime()) < 30 * 24 * 60 * 60 * 1000
    );
    for (const c of recentContradictions) {
      trustDelta += (c.trust_delta || 0) * TRUST_LOSS_MULTIPLIER;
    }

    // Snap-down: multiple contradictions in quick succession
    const last7dContradictions = contradictions.filter(
      c => (Date.now() - new Date(c.created_at).getTime()) < 7 * 24 * 60 * 60 * 1000
    ).length;
    let snapDownApplied = false;
    if (last7dContradictions >= SNAP_DOWN_THRESHOLD) {
      trustDelta -= SNAP_DOWN_PENALTY;
      snapDownApplied = true;
    }

    // Apply decay
    trustDelta -= decayAmount;

    // Calculate effective trust adjustment
    const effectiveScore = Math.max(0, Math.min(100, currentScore + trustDelta));

    // Record decay event if applicable
    if (decayAmount > 0) {
      await serviceClient.from("trust_history").insert({
        user_id: user.id,
        event_type: "decay",
        trust_score_at_time: currentScore,
        trust_delta: Math.round(-decayAmount),
        rules_satisfied: [],
        rules_violated: [],
        decay_applied: decayAmount,
        inertia_factor: 1.0,
        metadata: {
          daysSinceLastEvaluation,
          decayRate: DECAY_RATE_PER_DAY,
        },
      });
    }

    // Log security event
    await serviceClient.from("security_events").insert({
      user_id: user.id,
      event_type: "trust_evolution_evaluation",
      event_description: `Trust evolution: ${currentScore} → ${Math.round(effectiveScore)} (Δ${trustDelta.toFixed(1)})`,
      metadata: {
        previousScore: currentScore,
        effectiveScore: Math.round(effectiveScore),
        trustDelta,
        decayAmount,
        snapDownApplied,
        reinforcementCount: recentReinforcements,
        contradictionCount: recentContradictions.length,
        daysSinceContradiction,
      },
    });

    // Weakness 3: Return obfuscated summary only
    return new Response(
      JSON.stringify({
        trustEvolution: {
          currentScore: Math.round(effectiveScore),
          trend: trustDelta > 0 ? "improving" : trustDelta < -5 ? "declining" : "stable",
          daysSinceLastContradiction: daysSinceContradiction === Infinity ? null : Math.round(daysSinceContradiction),
          trustProvenance: {
            reinforcementCount: reinforcements.length,
            contradictionCount: contradictions.length,
            decayEventsCount: decayEvents.length,
            // Obfuscated: don't reveal which rules were satisfied/violated
            consistencyStreak: daysSinceContradiction > 30 ? "strong" : daysSinceContradiction > 7 ? "moderate" : "weak",
          },
          snapDownApplied,
          evaluatedAt: new Date().toISOString(),
        },
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Trust evolution error:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
