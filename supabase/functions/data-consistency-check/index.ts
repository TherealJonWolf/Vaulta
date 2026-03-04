import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

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

    // ─── Inline rule evaluation (mirrors client-side engine logic) ─────
    // We run core checks server-side for tamper resistance

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

          if (diff > 0.01) {
            findings.push({
              rule_id: "AR-001",
              rule_category: "arithmetic_reconciliation",
              rule_name: "Balance Reconciliation Failure",
              description: `Opening + transactions ≠ closing. Δ${diff.toFixed(2)}`,
              severity: diff > 100 ? "high" : "medium",
              confidence_impact: diff > 100 ? -25 : -10,
              follow_up_action: diff > 100 ? "hard_review" : "soft_review",
              audit_log_entry: `Balance reconciliation failed. Δ${diff.toFixed(2)}`,
              metadata: { expected, actual, difference: diff },
            });
          }

          // Rounding check
          if (stmt.transactions.length >= 10) {
            const rounded = stmt.transactions.filter(
              (tx: { amount: number }) => tx.amount === Math.round(tx.amount)
            ).length;
            if (rounded / stmt.transactions.length > 0.7) {
              findings.push({
                rule_id: "AR-002",
                rule_category: "arithmetic_reconciliation",
                rule_name: "Excessive Rounding Pattern",
                description: `${((rounded / stmt.transactions.length) * 100).toFixed(0)}% round numbers`,
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

          // Uniform spacing entropy
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

            if (cv < 0.15) {
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
      if (accountAge < 2 && docCount >= 3) {
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
      if (ratio < 0.5 || ratio > 3.0) {
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

    // Log security event
    await serviceClient.from("security_events").insert({
      user_id: user.id,
      event_type: "data_consistency_check",
      event_description: `Data consistency evaluation completed: ${findings.length} finding(s), aggregate impact: ${aggregateImpact.toFixed(1)}`,
      metadata: {
        findingsCount: findings.length,
        aggregateImpact,
        trustCeiling,
        ruleCategories: [...new Set(findings.map((f) => f.rule_category))],
      },
    });

    return new Response(
      JSON.stringify({
        findings,
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
