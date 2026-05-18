import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ShieldAlert, RefreshCw, Hash } from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";

interface Signal {
  code: string;
  label: string;
  severity: "low" | "moderate" | "high" | "critical";
  weight: number;
  detail: string;
  _contribution?: number;
}

interface Assessment {
  id: string;
  aggregate_score: number;
  severity: "low" | "moderate" | "high" | "critical";
  top_signals: Signal[];
  methodology_version: string;
  immutable_hash: string;
  created_at: string;
}

interface Props {
  submissionId?: string | null;
  userId?: string | null;
  institutionId?: string | null;
  applicantName?: string | null;
}

const sevStyle: Record<Assessment["severity"], string> = {
  low: "bg-emerald-50 text-emerald-800 border-emerald-200",
  moderate: "bg-amber-50 text-amber-800 border-amber-200",
  high: "bg-orange-50 text-orange-800 border-orange-200",
  critical: "bg-red-50 text-red-800 border-red-200",
};

export const FraudRiskPanel = ({ submissionId, userId, institutionId, applicantName }: Props) => {
  const [latest, setLatest] = useState<Assessment | null>(null);
  const [loading, setLoading] = useState(false);
  const [computing, setComputing] = useState(false);

  const fetchLatest = useCallback(async () => {
    if (!submissionId && !userId) return;
    setLoading(true);
    let query = (supabase.from as any)("fraud_risk_assessments")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(1);
    if (submissionId) query = query.eq("submission_id", submissionId);
    else if (userId) query = query.eq("user_id", userId);
    const { data } = await query;
    setLatest((data && data[0]) || null);
    setLoading(false);
  }, [submissionId, userId]);

  useEffect(() => { fetchLatest(); }, [fetchLatest]);

  const compute = async () => {
    setComputing(true);
    try {
      const { data, error } = await supabase.functions.invoke("aggregate-fraud-risk", {
        body: { submission_id: submissionId, user_id: userId, institution_id: institutionId },
      });
      if (error) throw error;
      setLatest((data as any)?.assessment || null);
      toast.success("Fraud-risk assessment computed");
    } catch (e: any) {
      toast.error(e?.message || "Failed to compute fraud-risk assessment");
    } finally {
      setComputing(false);
    }
  };

  return (
    <div className="space-y-3 border border-slate-200 rounded-lg p-4 bg-white">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ShieldAlert className="h-4 w-4 text-slate-700" />
          <h3 className="text-sm font-semibold text-slate-900">Fraud-Risk Assessment</h3>
          <Badge variant="outline" className="text-[10px] uppercase tracking-wider bg-slate-50 text-slate-600 border-slate-200">
            Evidence-based · {latest?.methodology_version || "v1"}
          </Badge>
        </div>
        <Button size="sm" variant="outline" onClick={compute} disabled={computing}>
          <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${computing ? "animate-spin" : ""}`} />
          {latest ? "Recompute" : "Compute"}
        </Button>
      </div>

      {loading && <p className="text-xs text-slate-400">Loading latest assessment…</p>}

      {!loading && !latest && (
        <p className="text-xs text-slate-500">
          No fraud-risk assessment has been computed yet for {applicantName || "this applicant"}. Click Compute to aggregate available signals.
        </p>
      )}

      {latest && (
        <>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1">
              <p className="text-[10px] text-slate-500 uppercase tracking-wider">Aggregate Risk</p>
              <p className="text-2xl font-semibold text-slate-900 tabular-nums">{latest.aggregate_score}<span className="text-sm text-slate-400">/100</span></p>
            </div>
            <div className="space-y-1">
              <p className="text-[10px] text-slate-500 uppercase tracking-wider">Severity</p>
              <Badge variant="outline" className={sevStyle[latest.severity]}>{latest.severity.toUpperCase()}</Badge>
            </div>
            <div className="space-y-1">
              <p className="text-[10px] text-slate-500 uppercase tracking-wider">Computed</p>
              <p className="text-xs text-slate-700">{formatDistanceToNow(new Date(latest.created_at), { addSuffix: true })}</p>
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-[10px] text-slate-500 uppercase tracking-wider">Top Contributing Signals</p>
            {latest.top_signals.length === 0 ? (
              <p className="text-xs text-slate-500">No signals contributing to risk — clean evidence baseline.</p>
            ) : (
              <div className="space-y-1.5">
                {latest.top_signals.map((s) => (
                  <div key={s.code} className={`border rounded p-2 ${sevStyle[s.severity]}`}>
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-semibold">{s.label}</p>
                      <span className="text-[10px] tabular-nums opacity-80">+{s._contribution ?? s.weight}</span>
                    </div>
                    <p className="text-[11px] mt-0.5 opacity-90">{s.detail}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex items-center gap-1 text-[10px] text-slate-400 font-mono pt-1 border-t border-slate-100">
            <Hash className="h-3 w-3" />
            <span className="truncate">{latest.immutable_hash}</span>
          </div>
        </>
      )}
    </div>
  );
};