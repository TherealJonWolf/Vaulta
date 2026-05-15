import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Loader2, ShieldCheck, ShieldAlert, FileText, AlertTriangle, CircleDot, Hash } from "lucide-react";
import { format } from "date-fns";
import { fetchUserTrustTimeline, type TrustEvent, type TrustEventSeverity } from "@/lib/trustEvents";
import { useAuth } from "@/hooks/useAuth";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Optional override; defaults to the signed-in user. */
  userId?: string;
}

const severityClass: Record<TrustEventSeverity, string> = {
  info: "bg-slate-500/10 text-slate-300 border-slate-500/30",
  low: "bg-emerald-500/10 text-emerald-300 border-emerald-500/30",
  moderate: "bg-amber-500/10 text-amber-300 border-amber-500/30",
  high: "bg-orange-500/10 text-orange-300 border-orange-500/30",
  critical: "bg-red-500/10 text-red-300 border-red-500/30",
};

const severityIcon = (s: TrustEventSeverity, delta: number) => {
  if (s === "critical" || s === "high") return <ShieldAlert size={14} />;
  if (s === "moderate") return <AlertTriangle size={14} />;
  if (delta > 0) return <ShieldCheck size={14} />;
  return <CircleDot size={14} />;
};

const reviewLabel: Record<string, string> = {
  unreviewed: "Unreviewed",
  acknowledged: "Acknowledged",
  overridden: "Overridden",
  confirmed: "Confirmed",
};

export const TrustTimeline = ({ open, onOpenChange, userId }: Props) => {
  const { user } = useAuth();
  const targetUserId = userId ?? user?.id;
  const [events, setEvents] = useState<TrustEvent[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !targetUserId) return;
    setLoading(true);
    fetchUserTrustTimeline(targetUserId)
      .then(setEvents)
      .finally(() => setLoading(false));
  }, [open, targetUserId]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] bg-background border-border">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg font-semibold tracking-tight">
            <FileText className="h-5 w-5 text-primary" />
            Trust Timeline
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Append-only provenance of every event that contributes to your trust evidence.
            Each entry is hash-locked and cannot be edited or deleted.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : events.length === 0 ? (
          <div className="py-12 text-center text-sm text-muted-foreground">
            No trust events recorded yet. New entries appear here as documents are
            verified, consistency checks run, or reviewers act on your account.
          </div>
        ) : (
          <ScrollArea className="h-[60vh] pr-3">
            <ol className="relative border-l border-border/60 ml-3">
              {events.map((evt) => {
                const sev = evt.severity;
                const deltaSign = evt.trust_delta > 0 ? "+" : evt.trust_delta < 0 ? "" : "";
                return (
                  <li key={evt.id} className="mb-5 ml-5">
                    <span className={`absolute -left-2.5 flex items-center justify-center w-5 h-5 rounded-full border ${severityClass[sev]}`}>
                      {severityIcon(sev, evt.trust_delta)}
                    </span>
                    <div className="rounded-md border border-border/60 bg-card/40 p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-foreground truncate">
                            {evt.event_type}
                          </p>
                          <p className="text-[11px] text-muted-foreground mt-0.5">
                            {format(new Date(evt.created_at), "MMM d, yyyy HH:mm:ss")} · {evt.source_system}
                          </p>
                        </div>
                        <div className="flex flex-col items-end gap-1 shrink-0">
                          <Badge variant="outline" className={`text-[10px] ${severityClass[sev]}`}>
                            {sev}
                          </Badge>
                          {evt.trust_delta !== 0 && (
                            <span className={`text-[11px] font-mono ${evt.trust_delta > 0 ? "text-emerald-400" : "text-red-400"}`}>
                              {deltaSign}{evt.trust_delta}
                            </span>
                          )}
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground mt-2 leading-relaxed">
                        {evt.explanation}
                      </p>
                      <div className="mt-2 flex flex-wrap items-center gap-2 text-[10px]">
                        <span className="text-muted-foreground">
                          Confidence: <span className="text-foreground/80">{evt.confidence}%</span>
                        </span>
                        <span className="text-muted-foreground">
                          Review: <span className="text-foreground/80">{reviewLabel[evt.review_status] ?? evt.review_status}</span>
                        </span>
                        {evt.reversed && (
                          <Badge variant="outline" className="text-[10px] border-amber-500/40 text-amber-300">
                            Reversed
                          </Badge>
                        )}
                      </div>
                      <div className="mt-2 flex items-center gap-1 text-[10px] text-muted-foreground/70 font-mono truncate" title={evt.immutable_hash}>
                        <Hash size={10} />
                        {evt.immutable_hash.slice(0, 24)}…
                      </div>
                    </div>
                  </li>
                );
              })}
            </ol>
          </ScrollArea>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default TrustTimeline;