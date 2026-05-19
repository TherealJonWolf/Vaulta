import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ShieldAlert, RefreshCw, Hash, ChevronDown, FileText, Cpu, AlertTriangle, ShieldCheck, Clock } from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

interface Signal {
  code: string;
  label: string;
  severity: "low" | "moderate" | "high" | "critical";
  weight: number;
  detail: string;
  _contribution?: number;
  evidence_ref?: {
    source?: string;
    rule_id?: string;
    category?: string;
    file_name?: string;
    alert_type?: string;
    issue_count?: number;
    [k: string]: unknown;
  };
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

const EVIDENCE_TTL_MS = 5 * 60 * 1000;

const sevStyle: Record<Assessment["severity"], string> = {
  low: "bg-emerald-50 text-emerald-800 border-emerald-200",
  moderate: "bg-amber-50 text-amber-800 border-amber-200",
  high: "bg-orange-50 text-orange-800 border-orange-200",
  critical: "bg-red-50 text-red-800 border-red-200",
};

const SOURCE_META: Record<string, { label: string; Icon: typeof FileText }> = {
  consistency_findings: { label: "Consistency engine", Icon: ShieldCheck },
  manual_review_queue: { label: "Manual review queue", Icon: Cpu },
  device_telemetry_alerts: { label: "Device telemetry", Icon: AlertTriangle },
  documents: { label: "Document verification", Icon: FileText },
};

interface EvidenceRecord {
  recorded_at?: string | null;
  fields: Array<{ key: string; value: string }>;
  notFound?: boolean;
}

const fmtVal = (v: unknown): string => {
  if (v === null || v === undefined) return "—";
  if (typeof v === "object") {
    try { return JSON.stringify(v); } catch { return String(v); }
  }
  return String(v);
};

async function fetchEvidence(signal: Signal, userId?: string | null): Promise<EvidenceRecord> {
  const ref = signal.evidence_ref || {};
  const source = ref.source as string | undefined;
  if (!source) return { fields: [], notFound: true };
  try {
    if (source === "consistency_findings" && userId && ref.rule_id) {
      const { data } = await (supabase.from as any)("consistency_findings")
        .select("rule_id, rule_name, rule_category, severity, confidence_impact, description, detected_at, created_at, resolved")
        .eq("user_id", userId).eq("rule_id", ref.rule_id).order("created_at", { ascending: false }).limit(1).maybeSingle();
      if (!data) return { fields: [], notFound: true };
      return {
        recorded_at: data.detected_at || data.created_at,
        fields: [
          { key: "Rule", value: `${data.rule_name} (${data.rule_id})` },
          { key: "Category", value: fmtVal(data.rule_category) },
          { key: "Severity", value: fmtVal(data.severity) },
          { key: "Confidence impact", value: fmtVal(data.confidence_impact) },
          { key: "Resolved", value: data.resolved ? "yes" : "no" },
          { key: "Description", value: fmtVal(data.description) },
        ],
      };
    }
    if (source === "manual_review_queue" && userId && ref.file_name) {
      const { data } = await (supabase.from as any)("manual_review_queue")
        .select("file_name, ai_confidence, ai_generated_likelihood, ai_summary, status, created_at, updated_at")
        .eq("user_id", userId).eq("file_name", ref.file_name).order("created_at", { ascending: false }).limit(1).maybeSingle();
      if (!data) return { fields: [], notFound: true };
      return {
        recorded_at: data.updated_at || data.created_at,
        fields: [
          { key: "File", value: fmtVal(data.file_name) },
          { key: "AI likelihood", value: fmtVal(data.ai_generated_likelihood) },
          { key: "AI confidence", value: `${fmtVal(data.ai_confidence)}%` },
          { key: "Status", value: fmtVal(data.status) },
          { key: "Summary", value: fmtVal(data.ai_summary) },
        ],
      };
    }
    if (source === "device_telemetry_alerts" && userId && ref.alert_type) {
      const { data } = await (supabase.from as any)("device_telemetry_alerts")
        .select("rule_name, severity, alert_type, description, resolved, created_at")
        .eq("user_id", userId).eq("alert_type", ref.alert_type).order("created_at", { ascending: false }).limit(1).maybeSingle();
      if (!data) return { fields: [], notFound: true };
      return {
        recorded_at: data.created_at,
        fields: [
          { key: "Rule", value: fmtVal(data.rule_name) },
          { key: "Alert type", value: fmtVal(data.alert_type) },
          { key: "Severity", value: fmtVal(data.severity) },
          { key: "Resolved", value: data.resolved ? "yes" : "no" },
          { key: "Description", value: fmtVal(data.description) },
        ],
      };
    }
    if (source === "documents" && userId && ref.file_name) {
      const { data } = await (supabase.from as any)("documents")
        .select("file_name, is_verified, verification_result, uploaded_at, created_at")
        .eq("user_id", userId).eq("file_name", ref.file_name).order("created_at", { ascending: false }).limit(1).maybeSingle();
      if (!data) return { fields: [], notFound: true };
      const vr = (data.verification_result as any) || {};
      const issues = Array.isArray(vr.issues) ? vr.issues : [];
      return {
        recorded_at: data.uploaded_at || data.created_at,
        fields: [
          { key: "File", value: fmtVal(data.file_name) },
          { key: "Verified", value: data.is_verified ? "yes" : "no" },
          { key: "Issues", value: String(issues.length) },
          ...(issues.slice(0, 3).map((i: any, idx: number) => ({
            key: `Issue ${idx + 1}`,
            value: typeof i === "string" ? i : fmtVal(i?.message ?? i),
          }))),
        ],
      };
    }
  } catch (e) {
    console.error("[FraudRiskPanel] fetchEvidence failed", e);
  }
  return { fields: [], notFound: true };
}

const SignalRow = ({
  signal,
  userId,
  cached,
  cachedAt,
  onCache,
}: {
  signal: Signal;
  userId?: string | null;
  cached?: EvidenceRecord;
  cachedAt?: number;
  onCache?: (ev: EvidenceRecord) => void;
}) => {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const sourceKey = (signal.evidence_ref?.source as string) || "";
  const meta = SOURCE_META[sourceKey];
  const SourceIcon = meta?.Icon || FileText;

  const isStale = cachedAt === undefined || Date.now() - cachedAt > EVIDENCE_TTL_MS;

  const onToggle = async (next: boolean) => {
    setOpen(next);
    if (next && (!cached || isStale)) {
      setLoading(true);
      const ev = await fetchEvidence(signal, userId);
      onCache?.(ev);
      setLoading(false);
    }
  };

  return (
    <Collapsible open={open} onOpenChange={onToggle} className={`border rounded ${sevStyle[signal.severity]}`}>
      <CollapsibleTrigger className="w-full text-left p-2">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <SourceIcon className="h-3.5 w-3.5 shrink-0 opacity-80" />
            <p className="text-xs font-semibold truncate">{signal.label}</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-[10px] tabular-nums opacity-80">+{signal._contribution ?? signal.weight}</span>
            <ChevronDown className={`h-3.5 w-3.5 transition-transform ${open ? "rotate-180" : ""}`} />
          </div>
        </div>
        <p className="text-[11px] mt-0.5 opacity-90">{signal.detail}</p>
      </CollapsibleTrigger>
      <CollapsibleContent className="px-2 pb-2">
        <div className="bg-white/70 border border-current/10 rounded p-2 mt-1 space-y-2">
          <div className="flex items-center justify-between gap-2 text-[10px] uppercase tracking-wider opacity-70">
            <span>Source · {meta?.label || sourceKey || "unknown"}</span>
            {cached?.recorded_at && (
              <span className="flex items-center gap-1 normal-case tracking-normal">
                <Clock className="h-3 w-3" />
                {formatDistanceToNow(new Date(cached.recorded_at), { addSuffix: true })}
              </span>
            )}
          </div>
          {loading && <p className="text-[11px] opacity-70">Loading evidence…</p>}
          {!loading && cached?.notFound && (
            <p className="text-[11px] opacity-70">
              Underlying record not available (may be RLS-restricted or since cleared). Reference:
              <code className="ml-1 font-mono text-[10px] break-all">{JSON.stringify(signal.evidence_ref || {})}</code>
            </p>
          )}
          {!loading && cached && !cached.notFound && (
            <dl className="grid grid-cols-[110px_1fr] gap-x-2 gap-y-1 text-[11px]">
              {cached.fields.map((f) => (
                <div key={f.key} className="contents">
                  <dt className="opacity-70">{f.key}</dt>
                  <dd className="font-mono break-words">{f.value}</dd>
                </div>
              ))}
            </dl>
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
};

export const FraudRiskPanel = ({ submissionId, userId, institutionId, applicantName }: Props) => {
  const [latest, setLatest] = useState<Assessment | null>(null);
  const [loading, setLoading] = useState(false);
  const [computing, setComputing] = useState(false);
  const [evidenceCache, setEvidenceCache] = useState<Record<string, { record: EvidenceRecord; ts: number }>>({});

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

  useEffect(() => {
    setEvidenceCache({});
  }, [latest?.id, userId]);

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
            <p className="text-[10px] text-slate-500 uppercase tracking-wider">Top Contributing Signals · click to drill down</p>
            {latest.top_signals.length === 0 ? (
              <p className="text-xs text-slate-500">No signals contributing to risk — clean evidence baseline.</p>
            ) : (
              <div className="space-y-1.5">
                {latest.top_signals.map((s) => (
                  <SignalRow
                    key={s.code}
                    signal={s}
                    userId={userId}
                    cached={evidenceCache[s.code]}
                    onCache={(ev) => setEvidenceCache((prev) => ({ ...prev, [s.code]: ev }))}
                  />
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