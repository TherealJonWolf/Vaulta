import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useInstitutionalAuth } from "../hooks/useInstitutionalAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Download, Loader2, Search, ArrowUp, ArrowDown } from "lucide-react";
import { format } from "date-fns";

interface LogEntry {
  id: string;
  event_type: string;
  reference_id: string | null;
  applicant_name: string | null;
  detail: string | null;
  created_at: string;
}

const eventTypes = ["All", "Intake Link Generated", "Documents Received", "Assessment Complete", "PDF Exported", "Login", "Logout"];

const InstitutionalActivity = () => {
  const { institutionId } = useInstitutionalAuth();
  const [entries, setEntries] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [eventFilter, setEventFilter] = useState("All");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [sortCol, setSortCol] = useState("created_at");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const fetchLog = async () => {
    if (!institutionId) return;
    let query = (supabase.from as any)('institutional_activity_log')
      .select('*')
      .eq('institution_id', institutionId)
      .order('created_at', { ascending: false })
      .limit(500);
    if (eventFilter !== "All") query = query.eq('event_type', eventFilter);
    if (dateFrom) query = query.gte('created_at', new Date(dateFrom).toISOString());
    if (dateTo) query = query.lte('created_at', new Date(dateTo + 'T23:59:59').toISOString());
    const { data } = await query;
    setEntries(data || []);
    setLoading(false);
  };

  useEffect(() => { fetchLog(); }, [institutionId, eventFilter, dateFrom, dateTo]);

  const filtered = useMemo(() => {
    let result = entries;
    if (search) {
      const s = search.toLowerCase();
      result = result.filter(e =>
        e.event_type.toLowerCase().includes(s) ||
        (e.reference_id || '').toLowerCase().includes(s) ||
        (e.applicant_name || '').toLowerCase().includes(s) ||
        (e.detail || '').toLowerCase().includes(s)
      );
    }
    return [...result].sort((a, b) => {
      const va = (a as any)[sortCol] || '';
      const vb = (b as any)[sortCol] || '';
      const cmp = va < vb ? -1 : va > vb ? 1 : 0;
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [entries, search, sortCol, sortDir]);

  const toggleSort = (col: string) => {
    if (sortCol === col) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortCol(col); setSortDir("asc"); }
  };

  const SortIcon = ({ col }: { col: string }) => {
    if (sortCol !== col) return null;
    return sortDir === "asc" ? <ArrowUp className="h-3 w-3 inline ml-1" /> : <ArrowDown className="h-3 w-3 inline ml-1" />;
  };

  const exportCsv = () => {
    const headers = ["Timestamp", "Event Type", "Reference ID", "Applicant Name", "Detail"];
    const rows = filtered.map(e => [
      format(new Date(e.created_at), "yyyy-MM-dd HH:mm:ss"),
      e.event_type, e.reference_id || "", e.applicant_name || "", e.detail || "",
    ]);
    const csv = [headers, ...rows].map(r => r.map(c => `"${c.replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `vaulta-activity-log-${format(new Date(), "yyyy-MM-dd")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Activity Log</h1>
          <p className="text-sm text-slate-500 mt-0.5">Append-only audit trail of all institutional actions.</p>
        </div>
        <Button variant="outline" onClick={exportCsv} className="text-sm">
          <Download className="h-4 w-4 mr-2" />Export CSV
        </Button>
      </div>

      <div className="flex items-center gap-3 mb-6 flex-wrap">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search..." className="pl-9 border-slate-200" />
        </div>
        <Select value={eventFilter} onValueChange={setEventFilter}>
          <SelectTrigger className="w-48 border-slate-200"><SelectValue /></SelectTrigger>
          <SelectContent>{eventTypes.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
        </Select>
        <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="w-40 border-slate-200" />
        <span className="text-xs text-slate-400">to</span>
        <Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="w-40 border-slate-200" />
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-5 w-5 animate-spin text-slate-400" /></div>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-slate-400 text-center py-12">No activity recorded yet.</p>
      ) : (
        <div className="border border-slate-200 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                {[
                  { key: "created_at", label: "Timestamp" },
                  { key: "event_type", label: "Event Type" },
                  { key: "reference_id", label: "Reference ID" },
                  { key: "applicant_name", label: "Applicant" },
                  { key: "detail", label: "Detail" },
                ].map(h => (
                  <th key={h.key} onClick={() => toggleSort(h.key)} className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider cursor-pointer hover:text-slate-700 select-none">
                    {h.label}<SortIcon col={h.key} />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map(e => (
                <tr key={e.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 text-xs text-slate-500 whitespace-nowrap">{format(new Date(e.created_at), "MMM d, HH:mm:ss")}</td>
                  <td className="px-4 py-3 text-slate-700 font-medium">{e.event_type}</td>
                  <td className="px-4 py-3 font-mono text-xs text-slate-600">{e.reference_id || "—"}</td>
                  <td className="px-4 py-3 text-slate-700">{e.applicant_name || "—"}</td>
                  <td className="px-4 py-3 text-slate-500 text-xs max-w-xs truncate">{e.detail || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default InstitutionalActivity;
