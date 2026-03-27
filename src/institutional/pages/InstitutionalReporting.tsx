import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useInstitutionalAuth } from "../hooks/useInstitutionalAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Download, Loader2, ArrowUp, ArrowDown } from "lucide-react";
import { format, startOfMonth, endOfMonth } from "date-fns";

interface Submission {
  id: string;
  applicant_name: string;
  reference_id: string;
  score_state: string;
  submitted_at: string;
  assessed_at: string | null;
  trust_score: number | null;
}

interface ActivityEntry {
  event_type: string;
  created_at: string;
}

const MetricCard = ({ label, value }: { label: string; value: string | number }) => (
  <div className="border border-slate-200 rounded-lg p-4">
    <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">{label}</p>
    <p className="text-2xl font-semibold text-slate-900">{value}</p>
  </div>
);

const stateLabel: Record<string, string> = {
  clear: "Clear", review: "Under Review", flag: "Flagged", insufficient: "Insufficient",
};

const InstitutionalReporting = () => {
  const { institutionId } = useInstitutionalAuth();
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [activity, setActivity] = useState<ActivityEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortCol, setSortCol] = useState("submitted_at");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const now = new Date();
  const [dateFrom, setDateFrom] = useState(format(startOfMonth(now), "yyyy-MM-dd"));
  const [dateTo, setDateTo] = useState(format(endOfMonth(now), "yyyy-MM-dd"));

  const fetchData = async () => {
    if (!institutionId) return;
    setLoading(true);
    const fromISO = new Date(dateFrom).toISOString();
    const toISO = new Date(dateTo + 'T23:59:59').toISOString();
    const [subRes, actRes] = await Promise.all([
      (supabase.from as any)('intake_submissions')
        .select('id, applicant_name, reference_id, score_state, submitted_at, assessed_at, trust_score')
        .eq('institution_id', institutionId)
        .gte('submitted_at', fromISO).lte('submitted_at', toISO)
        .order('submitted_at', { ascending: false }),
      (supabase.from as any)('institutional_activity_log')
        .select('event_type, created_at')
        .eq('institution_id', institutionId)
        .gte('created_at', fromISO).lte('created_at', toISO),
    ]);
    setSubmissions(subRes.data || []);
    setActivity(actRes.data || []);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, [institutionId, dateFrom, dateTo]);

  const metrics = useMemo(() => {
    const total = submissions.length;
    const byState = { clear: 0, review: 0, flag: 0, insufficient: 0 };
    submissions.forEach(s => {
      if (s.score_state in byState) byState[s.score_state as keyof typeof byState]++;
    });
    const pct = (n: number) => total > 0 ? ((n / total) * 100).toFixed(1) : "0.0";
    const assessed = submissions.filter(s => s.assessed_at && s.submitted_at);
    const avgHours = assessed.length > 0
      ? (assessed.reduce((sum, s) => sum + (new Date(s.assessed_at!).getTime() - new Date(s.submitted_at).getTime()) / 3600000, 0) / assessed.length).toFixed(1)
      : "—";
    return {
      total, byState, pct, avgHours,
      pdfExports: activity.filter(a => a.event_type === 'PDF Exported').length,
      linksGenerated: activity.filter(a => a.event_type === 'Intake Link Generated').length,
      docsReceived: activity.filter(a => a.event_type === 'Documents Received').length,
    };
  }, [submissions, activity]);

  const sorted = useMemo(() => {
    return [...submissions].sort((a, b) => {
      const va = (a as any)[sortCol] || '';
      const vb = (b as any)[sortCol] || '';
      const cmp = va < vb ? -1 : va > vb ? 1 : 0;
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [submissions, sortCol, sortDir]);

  const toggleSort = (col: string) => {
    if (sortCol === col) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortCol(col); setSortDir("asc"); }
  };

  const SortIcon = ({ col }: { col: string }) => {
    if (sortCol !== col) return null;
    return sortDir === "asc" ? <ArrowUp className="h-3 w-3 inline ml-1" /> : <ArrowDown className="h-3 w-3 inline ml-1" />;
  };

  const exportCsv = () => {
    const headers = ["Applicant Name", "Reference ID", "Submission Date", "Assessment Date", "Result"];
    const rows = sorted.map(s => [
      s.applicant_name, s.reference_id,
      format(new Date(s.submitted_at), "yyyy-MM-dd HH:mm"),
      s.assessed_at ? format(new Date(s.assessed_at), "yyyy-MM-dd HH:mm") : "Pending",
      stateLabel[s.score_state] || s.score_state,
    ]);
    const csv = [headers, ...rows].map(r => r.map(c => `"${c.replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `vaulta-report-${dateFrom}-to-${dateTo}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Reporting</h1>
          <p className="text-sm text-slate-500 mt-0.5">Assessment metrics and outcomes.</p>
        </div>
        <div className="flex items-center gap-3">
          <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="w-40 border-slate-200" />
          <span className="text-xs text-slate-400">to</span>
          <Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="w-40 border-slate-200" />
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-5 w-5 animate-spin text-slate-400" /></div>
      ) : (
        <>
          <div className="grid grid-cols-4 gap-4 mb-8">
            <MetricCard label="Total Assessed" value={metrics.total} />
            <MetricCard label="Clear" value={`${metrics.byState.clear} (${metrics.pct(metrics.byState.clear)}%)`} />
            <MetricCard label="Under Review" value={`${metrics.byState.review} (${metrics.pct(metrics.byState.review)}%)`} />
            <MetricCard label="Flagged" value={`${metrics.byState.flag} (${metrics.pct(metrics.byState.flag)}%)`} />
            <MetricCard label="Insufficient" value={`${metrics.byState.insufficient} (${metrics.pct(metrics.byState.insufficient)}%)`} />
            <MetricCard label="Avg Assessment Time" value={`${metrics.avgHours} hrs`} />
            <MetricCard label="PDF Exports" value={metrics.pdfExports} />
            <MetricCard label="Intake Links" value={`${metrics.linksGenerated} generated / ${metrics.docsReceived} submitted`} />
          </div>

          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-slate-900">Assessments</h2>
            <Button variant="outline" onClick={exportCsv} size="sm"><Download className="h-3.5 w-3.5 mr-2" />Export CSV</Button>
          </div>

          {sorted.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-8">No assessments in this date range.</p>
          ) : (
            <div className="border border-slate-200 rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    {[
                      { key: "applicant_name", label: "Applicant" },
                      { key: "reference_id", label: "Reference ID" },
                      { key: "submitted_at", label: "Submitted" },
                      { key: "assessed_at", label: "Assessed" },
                      { key: "score_state", label: "Result" },
                    ].map(h => (
                      <th key={h.key} onClick={() => toggleSort(h.key)} className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider cursor-pointer hover:text-slate-700 select-none">
                        {h.label}<SortIcon col={h.key} />
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {sorted.map(s => (
                    <tr key={s.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3 text-slate-700">{s.applicant_name}</td>
                      <td className="px-4 py-3 font-mono text-xs text-slate-600">{s.reference_id}</td>
                      <td className="px-4 py-3 text-xs text-slate-500">{format(new Date(s.submitted_at), "MMM d, HH:mm")}</td>
                      <td className="px-4 py-3 text-xs text-slate-500">{s.assessed_at ? format(new Date(s.assessed_at), "MMM d, HH:mm") : "Pending"}</td>
                      <td className="px-4 py-3 text-xs font-medium text-slate-700">{stateLabel[s.score_state] || s.score_state}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default InstitutionalReporting;
