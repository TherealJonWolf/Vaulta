import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { fetchReviewLog } from "../lib/reviewLog";
import { format } from "date-fns";
import { ScrollText, Eye, ShieldCheck, ShieldOff, Flag, FileDown, Loader2 } from "lucide-react";

interface Props {
  submissionId: string;
}

const actionIcon = (action: string) => {
  switch (action) {
    case "DOCUMENT_VIEWED":
      return <Eye className="h-3 w-3 text-slate-500" />;
    case "MANUAL_VERIFICATION_CONFIRMED":
      return <ShieldCheck className="h-3 w-3 text-emerald-600" />;
    case "MANUAL_VERIFICATION_REVOKED":
      return <ShieldOff className="h-3 w-3 text-amber-600" />;
    case "RISK_BADGE_FLAGGED":
      return <Flag className="h-3 w-3 text-red-600" />;
    case "ADVERSE_ACTION_GENERATED":
      return <FileDown className="h-3 w-3 text-slate-700" />;
    default:
      return <ScrollText className="h-3 w-3 text-slate-500" />;
  }
};

const actionLabel = (action: string): string => {
  switch (action) {
    case "DOCUMENT_VIEWED": return "Viewed document";
    case "MANUAL_VERIFICATION_CONFIRMED": return "Confirmed manual verification";
    case "MANUAL_VERIFICATION_REVOKED": return "Revoked manual verification";
    case "RISK_BADGE_FLAGGED": return "Flagged for review";
    case "ADVERSE_ACTION_GENERATED": return "Generated adverse action notice";
    default: return action.replace(/_/g, " ").toLowerCase();
  }
};

export const ReviewActivityLog = ({ submissionId }: Props) => {
  const [entries, setEntries] = useState<Array<Record<string, any>>>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const data = await fetchReviewLog(submissionId);
        if (!cancelled) setEntries(data);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();

    const channel = supabase
      .channel(`review_log_${submissionId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "institutional_review_logs", filter: `submission_id=eq.${submissionId}` },
        (payload) => {
          setEntries((prev) => [payload.new as any, ...prev]);
        }
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [submissionId]);

  return (
    <div className="space-y-2">
      <p className="text-xs text-slate-500 uppercase tracking-wider">Review Activity Log</p>
      <div className="border border-slate-200 rounded bg-slate-50/50 divide-y divide-slate-200 max-h-56 overflow-auto">
        {loading && (
          <div className="p-3 text-xs text-slate-500 flex items-center gap-2">
            <Loader2 className="h-3 w-3 animate-spin" /> Loading
          </div>
        )}
        {!loading && entries.length === 0 && (
          <div className="p-3 text-xs text-slate-400">No reviewer actions recorded yet.</div>
        )}
        {entries.map((e) => (
          <div key={e.id} className="p-2.5 flex items-start gap-2">
            <div className="mt-0.5">{actionIcon(e.action)}</div>
            <div className="flex-1 min-w-0">
              <p className="text-xs text-slate-800">
                <span className="font-medium">{e.reviewer_name || "Reviewer"}</span>{" "}
                <span className="text-slate-600">{actionLabel(e.action)}</span>
                {e.target_name && (
                  <span className="text-slate-500"> — {e.target_name}</span>
                )}
              </p>
              {e.notes && <p className="text-[11px] text-slate-500 mt-0.5">{e.notes}</p>}
              <p className="text-[10px] text-slate-400 mt-0.5">
                {format(new Date(e.created_at), "MMM d, yyyy HH:mm:ss")}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};