import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useInstitutionalAuth } from "../hooks/useInstitutionalAuth";
import { ApplicantDetailDrawer } from "../components/ApplicantDetailDrawer";
import { Badge } from "@/components/ui/badge";
import { Loader2, Users, ShieldCheck, FileWarning } from "lucide-react";
import { format } from "date-fns";
import { deriveRiskBadges, badgeStyle } from "@/lib/riskBadges";

interface Submission {
  id: string;
  intake_link_id: string;
  institution_id: string;
  applicant_name: string;
  reference_id: string;
  document_count: number;
  trust_score: number | null;
  score_state: string;
  assessment_narrative: string | null;
  document_types: string[];
  submitted_at: string;
  assessed_at: string | null;
  created_at: string;
}

const columns = [
  { key: "flag", label: "Flagged", dotColor: "bg-red-500", badgeBg: "bg-red-50 text-red-700" },
  { key: "review", label: "Under Review", dotColor: "bg-amber-500", badgeBg: "bg-amber-50 text-amber-700" },
  { key: "insufficient", label: "Insufficient", dotColor: "bg-slate-400", badgeBg: "bg-slate-100 text-slate-600" },
  { key: "clear", label: "Clear", dotColor: "bg-emerald-500", badgeBg: "bg-emerald-50 text-emerald-700" },
];

const scoreBadge: Record<string, { label: string; className: string }> = {
  clear: { label: "Clear", className: "bg-emerald-100 text-emerald-800" },
  review: { label: "Review", className: "bg-amber-100 text-amber-800" },
  flag: { label: "Flagged", className: "bg-red-100 text-red-800" },
  insufficient: { label: "Insufficient", className: "bg-slate-100 text-slate-600" },
};

const InstitutionalDashboard = () => {
  const { institutionId, institutionName } = useInstitutionalAuth();
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Submission | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [noticeIssuedIds, setNoticeIssuedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!institutionId) return;
    (supabase.from as any)("institution_settings")
      .select("display_name")
      .eq("institution_id", institutionId)
      .maybeSingle()
      .then(({ data }: any) => {
        if (data?.display_name) setDisplayName(data.display_name);
      });
  }, [institutionId]);

  const fetchSubmissions = useCallback(async () => {
    if (!institutionId) return;
    const { data, error: err } = await (supabase.from as any)('intake_submissions')
      .select('*')
      .eq('institution_id', institutionId)
      .order('submitted_at', { ascending: false });
    if (err) {
      setError("Failed to load pipeline data. Please refresh the page.");
      return;
    }
    setSubmissions(data || []);
    setLoading(false);
    setError(null);

    // Fetch which submissions have had an adverse action notice issued
    const { data: logs } = await (supabase.from as any)('institutional_review_logs')
      .select('submission_id')
      .eq('institution_id', institutionId)
      .eq('action', 'adverse_action_notice_generated');
    if (logs) {
      setNoticeIssuedIds(new Set(logs.map((l: any) => l.submission_id)));
    }
  }, [institutionId]);

  useEffect(() => {
    fetchSubmissions();
    const interval = setInterval(fetchSubmissions, 60000);
    return () => clearInterval(interval);
  }, [fetchSubmissions]);

  const grouped = columns.map(col => ({
    ...col,
    items: submissions.filter(s => s.score_state === col.key),
  }));

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">{displayName || institutionName}</h1>
          <p className="text-sm text-slate-500 mt-0.5">Applicant Pipeline</p>
        </div>
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <Users className="h-4 w-4" />
          <span>{submissions.length} total applicants</span>
        </div>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-md text-sm text-red-700">{error}</div>
      )}

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
        </div>
      ) : (
        <div className="grid grid-cols-4 gap-4 h-[calc(100vh-180px)]">
          {grouped.map(col => (
            <div key={col.key} className="flex flex-col border border-slate-200 rounded-lg overflow-hidden">
              <div className="flex items-center justify-between p-3 border-b border-slate-200 bg-slate-50">
                <div className="flex items-center gap-2">
                  <div className={`h-2.5 w-2.5 rounded-full ${col.dotColor}`} />
                  <span className="text-sm font-medium text-slate-700">{col.label}</span>
                </div>
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${col.badgeBg}`}>
                  {col.items.length}
                </span>
              </div>
              <div className="flex-1 overflow-auto p-2 space-y-2">
                {col.items.length === 0 && (
                  <p className="text-xs text-slate-400 text-center py-8">No applicants</p>
                )}
                {col.items.map(sub => {
                  const badge = scoreBadge[sub.score_state] || scoreBadge.insufficient;
                  const risks = deriveRiskBadges({
                    trustScore: sub.trust_score,
                    scoreState: sub.score_state,
                    documentCount: sub.document_count,
                  }).slice(0, 2);
                  const incomeKeywords = ["paystub","payslip","income","tax","w-2","w2","1099","salary","bank statement","employment"];
                  const hasIncomeDoc = (sub.document_types || []).some((t: string) =>
                    incomeKeywords.some((k) => t.toLowerCase().includes(k))
                  );
                  const verifiedIncome = sub.score_state === "clear" && hasIncomeDoc && (sub.trust_score ?? 0) >= 70;
                  const noticeIssued = noticeIssuedIds.has(sub.id);
                  return (
                    <button
                      key={sub.id}
                      onClick={() => { setSelected(sub); setDrawerOpen(true); }}
                      className="w-full text-left p-3 rounded-md border border-slate-200 hover:border-slate-300 hover:bg-slate-50 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-medium text-slate-900 truncate flex-1">{sub.applicant_name}</p>
                        {verifiedIncome && (
                          <ShieldCheck className="h-3.5 w-3.5 text-emerald-600 shrink-0" aria-label="Vaulta Verified Income" />
                        )}
                      </div>
                      <p className="text-xs text-slate-500 mt-1">
                        {format(new Date(sub.submitted_at), "MMM d, yyyy HH:mm")}
                      </p>
                      <div className="flex items-center justify-between mt-2">
                        <span className="text-xs text-slate-400">{sub.document_count} docs</span>
                        <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${badge.className}`}>
                          {sub.trust_score ?? "—"}
                        </Badge>
                      </div>
                      {risks.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {risks.map((r) => (
                            <span
                              key={r.code}
                              className={`text-[9px] px-1.5 py-0.5 rounded border ${badgeStyle(r.severity)}`}
                              title={r.detail}
                            >
                              {r.label}
                            </span>
                          ))}
                        </div>
                      )}
                      {noticeIssued && (
                        <div className="mt-2 flex items-center gap-1 text-[10px] text-red-700 bg-red-50 border border-red-200 rounded px-1.5 py-0.5 w-fit">
                          <FileWarning className="h-3 w-3" />
                          Notice Issued
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      <ApplicantDetailDrawer
        submission={selected}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
      />
    </div>
  );
};

export default InstitutionalDashboard;
