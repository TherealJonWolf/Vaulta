// ContributingSignalsCard — Phase 3 read-only surfacing of trust_signals.
//
// Reads the normalized ledger written by evaluate-context-signals (Phase 2)
// and groups signals by category so the user can see *why* their score
// moved. RLS already restricts rows to the authenticated user, so no
// extra filter is needed.
//
// Design choices:
//   - Category rollups (positive/neutral/negative count + net weight) match
//     the institutional visibility model the user picked in Phase 1, so the
//     applicant view never reveals more than the institutional view does.
//   - Pure presentation. No mutations, no recalculation. Score recomputation
//     stays in the existing TrustScoreDashboard "Recalculate" button.
import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, TrendingDown, Minus, Activity } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

type SignalRow = Database["public"]["Tables"]["trust_signals"]["Row"];
type SignalCategory = Database["public"]["Enums"]["signal_category"];
type SignalDirection = Database["public"]["Enums"]["signal_direction"];

const CATEGORY_LABEL: Record<SignalCategory, string> = {
  device_consistency: "Device Consistency",
  geolocation_context: "Geolocation Context",
  behavioral_pattern: "Behavioral Pattern",
  utility_corroboration: "Utility Corroboration",
  cross_account: "Cross-Account",
  identity_verification: "Identity Verification",
  document_consistency: "Document Consistency",
};

interface CategoryRollup {
  category: SignalCategory;
  signals: SignalRow[];
  netWeight: number;
  dominant: SignalDirection;
}

function rollup(signals: SignalRow[]): CategoryRollup[] {
  const byCat = new Map<SignalCategory, SignalRow[]>();
  for (const s of signals) {
    const list = byCat.get(s.category) ?? [];
    list.push(s);
    byCat.set(s.category, list);
  }
  return Array.from(byCat.entries()).map(([category, rows]) => {
    const netWeight = rows.reduce((acc, r) => {
      const sign = r.direction === "negative" ? -1 : r.direction === "positive" ? 1 : 0;
      return acc + sign * Number(r.weight ?? 0) * Number(r.confidence ?? 1);
    }, 0);
    const dominant: SignalDirection =
      netWeight > 0.5 ? "positive" : netWeight < -0.5 ? "negative" : "neutral";
    return { category, signals: rows, netWeight, dominant };
  });
}

export function ContributingSignalsCard() {
  const [loading, setLoading] = useState(true);
  const [signals, setSignals] = useState<SignalRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError(null);
      const sinceIso = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
      const { data, error: err } = await supabase
        .from("trust_signals")
        .select("*")
        .gte("evaluated_at", sinceIso)
        .order("evaluated_at", { ascending: false })
        .limit(200);
      if (cancelled) return;
      if (err) {
        setError(err.message);
      } else {
        setSignals((data ?? []) as SignalRow[]);
      }
      setLoading(false);
    };
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const rollups = useMemo(() => rollup(signals), [signals]);

  return (
    <Card className="border-border">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Activity className="text-primary" size={18} />
          Contributing Trust Signals
          <Badge variant="outline" className="text-[10px] uppercase ml-auto">
            last 90 days
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {loading && (
          <p className="text-xs text-muted-foreground">Loading signal ledger…</p>
        )}
        {error && (
          <p className="text-xs text-destructive">Could not load signals: {error}</p>
        )}
        {!loading && !error && rollups.length === 0 && (
          <p className="text-xs text-muted-foreground">
            No contextual signals projected yet. Enable categories in Trust Signal
            Consents to start contributing.
          </p>
        )}
        {rollups.map((r) => {
          const Icon =
            r.dominant === "positive" ? TrendingUp : r.dominant === "negative" ? TrendingDown : Minus;
          const tone =
            r.dominant === "positive"
              ? "text-emerald-500"
              : r.dominant === "negative"
                ? "text-orange-500"
                : "text-muted-foreground";
          return (
            <div
              key={r.category}
              className="flex items-start gap-3 p-3 rounded-lg border border-border bg-card/60"
            >
              <Icon className={tone} size={18} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm">{CATEGORY_LABEL[r.category]}</span>
                  <Badge variant="outline" className="text-[10px] uppercase">
                    {r.dominant}
                  </Badge>
                  <span className="ml-auto text-xs font-mono text-muted-foreground">
                    {r.netWeight >= 0 ? "+" : ""}
                    {r.netWeight.toFixed(2)}
                  </span>
                </div>
                <p className="text-[11px] text-muted-foreground mt-1 line-clamp-2">
                  {r.signals[0]?.summary ?? "—"}
                </p>
                <p className="text-[10px] text-muted-foreground/60 mt-0.5">
                  {r.signals.length} signal{r.signals.length === 1 ? "" : "s"}
                </p>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

export default ContributingSignalsCard;