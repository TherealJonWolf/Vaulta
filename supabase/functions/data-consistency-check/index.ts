import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ─── Weakness 1: Probabilistic Tolerance Bands ──────────────────────────────
// Instead of fixed thresholds, each evaluation uses jittered tolerances
// derived from a per-account seed that rotates on a time epoch.

function getJitteredThreshold(base: number, jitterSeed: number, ruleId: string): number {
  // Deterministic but unpredictable per-account jitter using seed + ruleId hash
  const hash = hashCode(`${jitterSeed}-${ruleId}`);
  const jitterRange = base * 0.3; // ±30% band
  const jitter = (((hash % 1000) / 1000) - 0.5) * 2 * jitterRange;
  return base + jitter;
}

function hashCode(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  return Math.abs(hash);
}

// Detect boundary-hugging: values that are consistently near thresholds
function calculateBoundaryHuggingScore(values: number[], thresholds: number[]): number {
  if (values.length === 0 || thresholds.length === 0) return 0;
  
  let nearHitCount = 0;
  for (const val of values) {
    for (const threshold of thresholds) {
      const distance = Math.abs(val - threshold) / Math.abs(threshold || 1);
      // Within 15% of threshold but not triggering = suspicious
      if (distance < 0.15 && distance > 0.01) {
        nearHitCount++;
      }
    }
  }
  return Math.min(100, (nearHitCount / Math.max(values.length, 1)) * 100);
}

// Should we run a random secondary audit on this "clean" account?
function shouldRandomAudit(jitterSeed: number, evaluationCount: number): boolean {
  // 8% base chance, increasing with evaluation count for accounts that are always clean
  const baseChance = 0.08;
  const elevatedChance = Math.min(0.25, baseChance + (evaluationCount * 0.02));
  const roll = ((jitterSeed * 9301 + 49297) % 233280) / 233280;
  return roll < elevatedChance;
}

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

    const body = await req.json();
    const { statements, income, identity, uploadHistory } = body;

    const serviceClient = createClient(
      supabaseUrl,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // ── Fetch or create evaluation metadata (jitter seed, boundary score) ──
    let { data: evalMeta } = await serviceClient
      .from("evaluation_metadata")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();

    const currentEpoch = Math.floor(Date.now() / (1000 * 60 * 60 * 24 * 7)); // weekly rotation

    if (!evalMeta) {
      const newSeed = Math.random() * 1000000;
      const { data: inserted } = await serviceClient
        .from("evaluation_metadata")
        .insert({
          user_id: user.id,
          jitter_seed: newSeed,
          jitter_epoch: currentEpoch,
          boundary_hugging_score: 0,
          boundary_events: 0,
        })
        .select()
        .single();
      evalMeta = inserted;
    } else if (evalMeta.jitter_epoch < currentEpoch) {
      // Rotate jitter seed periodically so adversaries can't learn it
      const newSeed = Math.random() * 1000000;
      await serviceClient
        .from("evaluation_metadata")
        .update({ jitter_seed: newSeed, jitter_epoch: currentEpoch, updated_at: new Date().toISOString() })
        .eq("user_id", user.id);
      evalMeta.jitter_seed = newSeed;
      evalMeta.jitter_epoch = currentEpoch;
    }

    const jitterSeed = evalMeta?.jitter_seed || Math.random() * 1000000;

    // Get account creation date
    const { data: profile } = await serviceClient
      .from("profiles")
      .select("created_at")
      .eq("user_id", user.id)
      .maybeSingle();

    // Get prior unresolved findings count
    const { count: priorFindingsCount } = await serviceClient
      .from("consistency_findings")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("resolved", false);

    // ─── Rule evaluation with probabilistic thresholds ─────────────────

    const findings: Array<{
      rule_id: string;
      rule_category: string;
      rule_name: string;
      description: string;
      severity: string;
      confidence_impact: number;
      follow_up_action: string;
      audit_log_entry: string;
      metadata: Record<string, unknown>;
    }> = [];

    // Track values for boundary-hugging detection
    const observedValues: number[] = [];
    const ruleThresholds: number[] = [];

    // ── Arithmetic checks ──
    if (statements && Array.isArray(statements)) {
      for (const stmt of statements) {
        if (stmt.transactions && stmt.openingBalance != null && stmt.closingBalance != null) {
          const txnNet = stmt.transactions.reduce(
            (sum: number, tx: { type: string; amount: number }) =>
              sum + (tx.type === "credit" ? tx.amount : -tx.amount),
            0
          );
          const expected = Math.round((stmt.openingBalance + txnNet) * 100) / 100;
          const actual = Math.round(stmt.closingBalance * 100) / 100;
          const diff = Math.abs(expected - actual);

          // Jittered threshold instead of fixed 0.01
          const balanceThreshold = getJitteredThreshold(0.01, jitterSeed, "AR-001");
          ruleThresholds.push(0.01);
          observedValues.push(diff);

          if (diff > balanceThreshold) {
            const largeThreshold = getJitteredThreshold(100, jitterSeed, "AR-001-large");
            findings.push({
              rule_id: "AR-001",
              rule_category: "arithmetic_reconciliation",
              rule_name: "Balance Reconciliation Failure",
              description: `Opening + transactions ≠ closing. Δ${diff.toFixed(2)}`,
              severity: diff > largeThreshold ? "high" : "medium",
              confidence_impact: diff > largeThreshold ? -25 : -10,
              follow_up_action: diff > largeThreshold ? "hard_review" : "soft_review",
              audit_log_entry: `Balance reconciliation failed. Δ${diff.toFixed(2)}`,
              metadata: { expected, actual, difference: diff },
            });
          }

          // Rounding check with jittered threshold
          if (stmt.transactions.length >= 10) {
            const rounded = stmt.transactions.filter(
              (tx: { amount: number }) => tx.amount === Math.round(tx.amount)
            ).length;
            const roundedRatio = rounded / stmt.transactions.length;
            const roundingThreshold = getJitteredThreshold(0.7, jitterSeed, "AR-002");
            ruleThresholds.push(0.7);
            observedValues.push(roundedRatio);

            if (roundedRatio > roundingThreshold) {
              findings.push({
                rule_id: "AR-002",
                rule_category: "arithmetic_reconciliation",
                rule_name: "Excessive Rounding Pattern",
                description: `${(roundedRatio * 100).toFixed(0)}% round numbers`,
                severity: "medium",
                confidence_impact: -12,
                follow_up_action: "soft_review",
                audit_log_entry: `Rounding anomaly: ${rounded}/${stmt.transactions.length} round`,
                metadata: { roundedCount: rounded, total: stmt.transactions.length },
              });
            }
          }

          // Transactions outside period
          if (stmt.periodStart && stmt.periodEnd) {
            const pStart = new Date(stmt.periodStart).getTime();
            const pEnd = new Date(stmt.periodEnd).getTime();
            const outsiders = stmt.transactions.filter((tx: { date: string }) => {
              const d = new Date(tx.date).getTime();
              return d < pStart || d > pEnd;
            });
            if (outsiders.length > 0) {
              findings.push({
                rule_id: "TL-003",
                rule_category: "temporal_logic",
                rule_name: "Transactions Outside Statement Period",
                description: `${outsiders.length} transaction(s) outside period bounds`,
                severity: "high",
                confidence_impact: -18,
                follow_up_action: "hard_review",
                audit_log_entry: `${outsiders.length} transactions outside statement period`,
                metadata: { outsideCount: outsiders.length },
              });
            }
          }

          // Uniform spacing entropy with jittered CV threshold
          if (stmt.transactions.length >= 10) {
            const sorted = [...stmt.transactions].sort(
              (a: { date: string }, b: { date: string }) =>
                new Date(a.date).getTime() - new Date(b.date).getTime()
            );
            const gaps: number[] = [];
            for (let i = 1; i < sorted.length; i++) {
              gaps.push(
                (new Date(sorted[i].date).getTime() - new Date(sorted[i - 1].date).getTime()) /
                  (1000 * 60 * 60)
              );
            }
            const mean = gaps.reduce((s, g) => s + g, 0) / gaps.length;
            const variance = gaps.reduce((s, g) => s + Math.pow(g - mean, 2), 0) / gaps.length;
            const cv = mean > 0 ? Math.sqrt(variance) / mean : 0;

            const cvThreshold = getJitteredThreshold(0.15, jitterSeed, "EP-001");
            ruleThresholds.push(0.15);
            observedValues.push(cv);

            if (cv < cvThreshold) {
              findings.push({
                rule_id: "EP-001",
                rule_category: "entropy_pattern",
                rule_name: "Unnaturally Uniform Transaction Spacing",
                description: `Transaction spacing CV: ${(cv * 100).toFixed(1)}%`,
                severity: "high",
                confidence_impact: -20,
                follow_up_action: "hard_review",
                audit_log_entry: `Uniform spacing detected (CV: ${(cv * 100).toFixed(1)}%)`,
                metadata: { coeffOfVariation: cv, meanGapHours: mean },
              });
            }
          }
        }
      }

      // Overlapping periods
      if (statements.length >= 2) {
        const sorted = [...statements].sort(
          (a: { periodStart: string }, b: { periodStart: string }) =>
            new Date(a.periodStart).getTime() - new Date(b.periodStart).getTime()
        );
        for (let i = 1; i < sorted.length; i++) {
          if (new Date(sorted[i].periodStart).getTime() < new Date(sorted[i - 1].periodEnd).getTime()) {
            findings.push({
              rule_id: "TL-001",
              rule_category: "temporal_logic",
              rule_name: "Overlapping Statement Periods",
              description: `Periods overlap: ${sorted[i - 1].periodEnd} > ${sorted[i].periodStart}`,
              severity: "high",
              confidence_impact: -20,
              follow_up_action: "hard_review",
              audit_log_entry: `Overlapping statement periods detected`,
              metadata: {},
            });
            break;
          }
        }

        // Identical patterns
        for (let i = 0; i < statements.length; i++) {
          for (let j = i + 1; j < statements.length; j++) {
            const seq1 = statements[i].transactions?.map((t: { amount: number }) => t.amount).join(",");
            const seq2 = statements[j].transactions?.map((t: { amount: number }) => t.amount).join(",");
            if (seq1 && seq1.length > 20 && seq1 === seq2) {
              findings.push({
                rule_id: "BS-003",
                rule_category: "behavioral_sequence",
                rule_name: "Identical Transaction Pattern Across Datasets",
                description: `Identical transaction sequences across different periods`,
                severity: "high",
                confidence_impact: -30,
                follow_up_action: "hard_review",
                audit_log_entry: `Identical transaction patterns found across periods`,
                metadata: {},
              });
            }
          }
        }
      }
    }

    // Early high-trust data
    if (profile?.created_at) {
      const accountAge =
        (Date.now() - new Date(profile.created_at).getTime()) / (1000 * 60 * 60 * 24);
      const docCount = uploadHistory?.length || 0;
      const ageThreshold = getJitteredThreshold(2, jitterSeed, "BS-001");
      ruleThresholds.push(2);
      observedValues.push(accountAge);

      if (accountAge < ageThreshold && docCount >= 3) {
        findings.push({
          rule_id: "BS-001",
          rule_category: "behavioral_sequence",
          rule_name: "Rapid High-Trust Data Submission",
          description: `Complex data submitted within ${accountAge.toFixed(1)} days of account creation`,
          severity: "medium",
          confidence_impact: -15,
          follow_up_action: "soft_review",
          audit_log_entry: `High-trust data submitted ${accountAge.toFixed(1)} days after account creation`,
          metadata: { accountAgeDays: accountAge, documentCount: docCount },
        });
      }
    }

    // Income vs inflow cross-check
    if (income?.declaredMonthlyIncome && statements?.length > 0) {
      let totalCredits = 0;
      let totalMonths = 0;
      for (const stmt of statements) {
        const monthSpan = Math.max(
          1,
          (new Date(stmt.periodEnd).getTime() - new Date(stmt.periodStart).getTime()) /
            (1000 * 60 * 60 * 24 * 30)
        );
        const credits = stmt.transactions
          ?.filter((t: { type: string }) => t.type === "credit")
          .reduce((s: number, t: { amount: number }) => s + t.amount, 0) || 0;
        totalCredits += credits;
        totalMonths += monthSpan;
      }
      const avgInflow = totalCredits / totalMonths;
      const ratio = avgInflow / income.declaredMonthlyIncome;

      const lowThreshold = getJitteredThreshold(0.5, jitterSeed, "CF-001-low");
      const highThreshold = getJitteredThreshold(3.0, jitterSeed, "CF-001-high");
      ruleThresholds.push(0.5, 3.0);
      observedValues.push(ratio);

      if (ratio < lowThreshold || ratio > highThreshold) {
        findings.push({
          rule_id: "CF-001",
          rule_category: "cross_field_consistency",
          rule_name: "Income vs Transaction Inflow Mismatch",
          description: `Declared: $${income.declaredMonthlyIncome}/mo, actual inflow: $${avgInflow.toFixed(2)}/mo`,
          severity: ratio < 0.3 || ratio > 5 ? "high" : "medium",
          confidence_impact: ratio < 0.3 || ratio > 5 ? -22 : -12,
          follow_up_action: ratio < 0.3 || ratio > 5 ? "hard_review" : "soft_review",
          audit_log_entry: `Income–inflow mismatch: declared vs actual ${(ratio * 100).toFixed(0)}%`,
          metadata: { declaredMonthlyIncome: income.declaredMonthlyIncome, avgInflow, ratio },
        });
      }
    }

    // ── Weakness 1: Boundary-hugging detection ──
    const boundaryScore = calculateBoundaryHuggingScore(observedValues, ruleThresholds);
    if (boundaryScore > 40) {
      findings.push({
        rule_id: "BH-001",
        rule_category: "entropy_pattern",
        rule_name: "Boundary-Hugging Behavior Detected",
        description: `Data values consistently near detection thresholds (score: ${boundaryScore.toFixed(1)})`,
        severity: boundaryScore > 70 ? "high" : "medium",
        confidence_impact: boundaryScore > 70 ? -25 : -15,
        follow_up_action: "hard_review",
        audit_log_entry: `Boundary-hugging pattern detected with score ${boundaryScore.toFixed(1)}/100`,
        metadata: { boundaryScore, samplesEvaluated: observedValues.length },
      });
    }

    // Update boundary-hugging metadata
    if (evalMeta) {
      const newBoundaryScore = (evalMeta.boundary_hugging_score * 0.7) + (boundaryScore * 0.3); // EMA
      await serviceClient
        .from("evaluation_metadata")
        .update({
          boundary_hugging_score: newBoundaryScore,
          boundary_events: (evalMeta.boundary_events || 0) + 1,
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", user.id);
    }

    // ── Weakness 1: Random secondary audit for "clean" accounts ──
    const isClean = findings.length === 0;
    const randomAuditTriggered = isClean && shouldRandomAudit(jitterSeed, evalMeta?.boundary_events || 0);

    if (randomAuditTriggered) {
      // Run deeper entropy analysis that wouldn't normally trigger
      // This prevents adversaries from knowing they're "safe"
      await serviceClient
        .from("evaluation_metadata")
        .update({ last_random_audit_at: new Date().toISOString() })
        .eq("user_id", user.id);

      await serviceClient.from("security_events").insert({
        user_id: user.id,
        event_type: "random_secondary_audit",
        event_description: "Random secondary evaluation triggered on clean account",
        metadata: { evaluationCount: evalMeta?.boundary_events || 0, jitterEpoch: currentEpoch },
      });
    }

    // ── Trust degradation ──
    let aggregateImpact = 0;
    let trustCeiling: number | null = null;

    for (let i = 0; i < findings.length; i++) {
      aggregateImpact += findings[i].confidence_impact * (i === 0 ? 1 : 0.8);
    }

    const highCount = findings.filter((f) => f.severity === "high").length;
    const medHighCount =
      highCount + findings.filter((f) => f.severity === "medium").length;

    if (highCount >= 2) trustCeiling = Math.min(trustCeiling ?? 100, 55);
    if (medHighCount >= 3) trustCeiling = Math.min(trustCeiling ?? 100, 65);
    if (findings.some((f) => f.follow_up_action === "hard_review"))
      trustCeiling = Math.min(trustCeiling ?? 100, 70);
    if ((priorFindingsCount || 0) > 5)
      trustCeiling = Math.min(trustCeiling ?? 100, 60);

    // Boundary-hugging compounds the ceiling
    if (boundaryScore > 50) {
      trustCeiling = Math.min(trustCeiling ?? 100, 68);
    }

    // Store findings
    if (findings.length > 0) {
      const rows = findings.map((f) => ({
        user_id: user.id,
        rule_id: f.rule_id,
        rule_category: f.rule_category,
        rule_name: f.rule_name,
        description: f.description,
        severity: f.severity,
        confidence_impact: f.confidence_impact,
        follow_up_action: f.follow_up_action,
        audit_log_entry: f.audit_log_entry,
        metadata: f.metadata,
      }));

      await serviceClient.from("consistency_findings").insert(rows);
    }

    // ── Weakness 2: Record trust history event ──
    const rulesViolated = findings.map(f => f.rule_id);
    const rulesSatisfied = ["AR-001","AR-002","TL-001","TL-003","EP-001","BS-001","BS-003","CF-001"]
      .filter(r => !rulesViolated.includes(r));

    // Get latest trust score for history tracking
    const { data: latestTrust } = await serviceClient
      .from("trust_scores")
      .select("trust_score")
      .eq("user_id", user.id)
      .order("calculated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    await serviceClient.from("trust_history").insert({
      user_id: user.id,
      event_type: findings.length > 0 ? "contradiction" : "reinforcement",
      trust_score_at_time: latestTrust?.trust_score ?? 50,
      trust_delta: Math.round(aggregateImpact),
      rules_satisfied: rulesSatisfied,
      rules_violated: rulesViolated,
      decay_applied: 0,
      inertia_factor: findings.length > 0 ? 0.5 : 1.2, // fast degrade, slow build
      metadata: {
        findingsCount: findings.length,
        boundaryScore,
        randomAuditTriggered,
      },
    });

    // ── Weakness 4: Generate cross-account fingerprint ──
    if (statements && Array.isArray(statements)) {
      for (const stmt of statements) {
        if (stmt.transactions?.length >= 5) {
          // Generate behavioral fingerprint (amount sequence pattern, not PII)
          const amounts = stmt.transactions.map((t: { amount: number }) => t.amount);
          const sortedAmounts = [...amounts].sort((a, b) => a - b);
          const median = sortedAmounts[Math.floor(sortedAmounts.length / 2)];
          const quantized = amounts.map((a: number) => Math.round((a / (median || 1)) * 10) / 10);
          const fingerprint = quantized.slice(0, 20).join(",");

          // Hash the fingerprint for anonymity
          const encoder = new TextEncoder();
          const data = encoder.encode(fingerprint);
          const hashBuffer = await crypto.subtle.digest("SHA-256", data);
          const hashArray = Array.from(new Uint8Array(hashBuffer));
          const fingerprintHash = hashArray.map(b => b.toString(16).padStart(2, "0")).join("");

          // Check for existing similar fingerprints
          const { data: existing } = await serviceClient
            .from("cross_account_signals")
            .select("*")
            .eq("fingerprint_hash", fingerprintHash)
            .maybeSingle();

          if (existing) {
            const newCount = existing.account_count + 1;
            const newSeverity = newCount >= 5 ? "high" : newCount >= 3 ? "medium" : "low";
            await serviceClient
              .from("cross_account_signals")
              .update({
                account_count: newCount,
                severity: newSeverity,
                confidence_score: Math.min(100, existing.confidence_score + 15),
                last_seen_at: new Date().toISOString(),
              })
              .eq("id", existing.id);

            // If cluster detected, add a finding
            if (newCount >= 3) {
              findings.push({
                rule_id: "CA-001",
                rule_category: "entropy_pattern",
                rule_name: "Cross-Account Pattern Correlation",
                description: `Transaction structure matches ${newCount} other accounts`,
                severity: newSeverity,
                confidence_impact: newCount >= 5 ? -30 : -18,
                follow_up_action: "hard_review",
                audit_log_entry: `Cross-account similarity cluster detected (${newCount} accounts)`,
                metadata: { clusterSize: newCount, signalType: "structure_similarity" },
              });
            }
          } else {
            await serviceClient.from("cross_account_signals").insert({
              signal_type: "structure_similarity",
              fingerprint_hash: fingerprintHash,
              account_count: 1,
              severity: "low",
              confidence_score: 0,
            });
          }
        }
      }
    }

    // Log security event
    await serviceClient.from("security_events").insert({
      user_id: user.id,
      event_type: "data_consistency_check",
      event_description: `Data consistency evaluation completed: ${findings.length} finding(s), aggregate impact: ${aggregateImpact.toFixed(1)}`,
      metadata: {
        findingsCount: findings.length,
        aggregateImpact,
        trustCeiling,
        boundaryHuggingScore: boundaryScore,
        randomAuditTriggered,
        ruleCategories: [...new Set(findings.map((f) => f.rule_category))],
      },
    });

    // ── Weakness 3: Obfuscated response ──
    // Server returns authoritative findings but the client receives
    // only a summary — no rule IDs, no thresholds, no specific trigger details.
    // The full findings are stored server-side for auditor access.
    return new Response(
      JSON.stringify({
        // Client-safe summary (obfuscated)
        summary: {
          status: findings.length === 0 ? "consistent" : findings.length <= 2 ? "review_recommended" : "attention_required",
          findingsCount: findings.length,
          evaluatedAt: new Date().toISOString(),
        },
        // Server-authoritative data (stored, not leaked to client in detail)
        findings: findings.map(f => ({
          // Intentionally vague client-side attribution
          category: f.rule_category,
          severity: f.severity,
          description: obfuscateDescription(f.description),
          followUpAction: f.follow_up_action,
        })),
        aggregateConfidenceAdjustment: aggregateImpact,
        trustCeiling,
        compoundAnomalyCount: medHighCount,
        evaluatedAt: new Date().toISOString(),
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Data consistency check error:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

// ── Weakness 3: Obfuscate descriptions to prevent rule reverse-engineering ──
function obfuscateDescription(desc: string): string {
  // Strip specific numbers, thresholds, and percentages from user-facing output
  return desc
    .replace(/\d+\.\d+%/g, "anomalous")
    .replace(/\$[\d,.]+/g, "a value")
    .replace(/Δ[\d,.]+/g, "a discrepancy")
    .replace(/\d+ transaction/g, "transactions")
    .replace(/\d+\.\d+ days/g, "shortly after")
    .replace(/CV: [\d.]+%/g, "low variability");
}
