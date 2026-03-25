import { useState, useEffect } from "react";
import { History, ChevronDown, ChevronUp, Circle, Clock, FileText, Download, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  getNarrativesForApplicant,
  type TrustNarrative,
  type ScoreState,
  getScoreStateConfig,
} from "@/lib/trustNarrative";
import { TrustNarrativeCard } from "@/components/TrustNarrativeCard";
import { exportNarrativePdf } from "@/lib/narrativePdfExport";

interface NarrativeTimelineProps {
  applicantUserId: string;
  applicantLabel?: string;
}

function formatShortDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatFullDate(iso: string): string {
  const d = new Date(iso);
  return (
    d.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }) +
    " at " +
    d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", timeZoneName: "short" })
  );
}

function scoreDelta(current: TrustNarrative, previous: TrustNarrative | null): string | null {
  if (!previous || current.trust_score === null || previous.trust_score === null) return null;
  const diff = current.trust_score - previous.trust_score;
  if (diff === 0) return null;
  return diff > 0 ? `+${diff}` : `${diff}`;
}

export function NarrativeTimeline({ applicantUserId, applicantLabel }: NarrativeTimelineProps) {
  const [narratives, setNarratives] = useState<TrustNarrative[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getNarrativesForApplicant(applicantUserId).then((data) => {
      if (!cancelled) {
        setNarratives(data);
        setLoading(false);
      }
    });
    return () => { cancelled = true; };
  }, [applicantUserId]);

  if (loading) {
    return (
      <div className="text-xs text-muted-foreground font-mono py-4 text-center">
        Loading assessment history...
      </div>
    );
  }

  if (narratives.length === 0) {
    return (
      <div className="text-center py-8">
        <History className="mx-auto text-muted-foreground mb-3" size={32} />
        <p className="text-sm text-muted-foreground">No assessment history available</p>
      </div>
    );
  }

  return (
    <div className="space-y-0">
      {/* Summary bar */}
      <div className="flex items-center justify-between mb-4 px-1">
        <div className="flex items-center gap-2">
          <History size={14} className="text-primary" />
          <span className="text-xs font-mono text-muted-foreground">
            {narratives.length} ASSESSMENT{narratives.length !== 1 ? "S" : ""}
          </span>
        </div>
        <span className="text-[10px] text-muted-foreground font-mono">
          {formatShortDate(narratives[narratives.length - 1].assessed_at)} — {formatShortDate(narratives[0].assessed_at)}
        </span>
      </div>

      {/* Timeline */}
      <div className="relative">
        {/* Vertical line */}
        <div className="absolute left-[7px] top-3 bottom-3 w-px bg-border" />

        {narratives.map((narrative, idx) => {
          const config = getScoreStateConfig(narrative.score_state as ScoreState);
          const isExpanded = expanded === narrative.id;
          const prev = idx < narratives.length - 1 ? narratives[idx + 1] : null;
          const delta = scoreDelta(narrative, prev);
          const isLatest = idx === 0;
          const version = narratives.length - idx;

          return (
            <div key={narrative.id} className="relative pl-7 pb-4 last:pb-0">
              {/* Timeline dot */}
              <div
                className={`absolute left-0 top-2.5 w-[15px] h-[15px] rounded-full border-2 border-background flex items-center justify-center ${
                  isLatest ? config.bgColor : "bg-muted"
                }`}
              >
                <Circle
                  size={7}
                  className={isLatest ? "text-white fill-white" : "text-muted-foreground fill-muted-foreground"}
                />
              </div>

              {/* Entry card */}
              <Card
                className={`border-border transition-colors ${
                  isLatest ? `border-l-2 ${config.borderColor}` : ""
                } ${isExpanded ? "bg-card" : "bg-card/60 hover:bg-card/80"}`}
              >
                <CardContent className="py-3 px-4">
                  {/* Header */}
                  <button
                    className="w-full flex items-center justify-between gap-2 text-left"
                    onClick={() => setExpanded(isExpanded ? null : narrative.id)}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <Badge variant={config.badgeVariant} className="text-[10px] font-medium shrink-0">
                        {config.label}
                      </Badge>
                      {isLatest && (
                        <Badge variant="outline" className="text-[9px] font-mono shrink-0 border-primary/30 text-primary">
                          CURRENT
                        </Badge>
                      )}
                      <span className="text-[10px] text-muted-foreground font-mono">
                        v{version}
                      </span>
                      {narrative.trust_score !== null && (
                        <span className="text-xs font-mono text-foreground font-bold">
                          {narrative.trust_score}
                        </span>
                      )}
                      {delta && (
                        <span
                          className={`text-[10px] font-mono font-bold ${
                            delta.startsWith("+") ? "text-emerald-500" : "text-red-500"
                          }`}
                        >
                          {delta}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-[10px] text-muted-foreground font-mono hidden sm:inline">
                        {formatShortDate(narrative.assessed_at)}
                      </span>
                      {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    </div>
                  </button>

                  {/* Expanded content */}
                  {isExpanded && (
                    <div className="mt-3 pt-3 border-t border-border space-y-3">
                      <p className="text-sm text-foreground leading-relaxed">
                        {narrative.narrative_text}
                      </p>

                      {/* Metadata row */}
                      <div className="flex flex-wrap items-center gap-3 text-[10px] text-muted-foreground font-mono">
                        <span className="flex items-center gap-1">
                          <Clock size={10} />
                          {formatFullDate(narrative.assessed_at)}
                        </span>
                        <span className="flex items-center gap-1">
                          <FileText size={10} />
                          {narrative.document_count} doc{narrative.document_count !== 1 ? "s" : ""}
                        </span>
                        <span>ID: {narrative.assessment_id.slice(0, 8).toUpperCase()}</span>
                      </div>

                      {/* State transition indicator */}
                      {prev && prev.score_state !== narrative.score_state && (
                        <div className="flex items-center gap-2 text-[10px] font-mono text-muted-foreground bg-muted/30 rounded px-2 py-1.5">
                          <Badge variant={getScoreStateConfig(prev.score_state as ScoreState).badgeVariant} className="text-[9px]">
                            {getScoreStateConfig(prev.score_state as ScoreState).label}
                          </Badge>
                          <ArrowRight size={10} />
                          <Badge variant={config.badgeVariant} className="text-[9px]">
                            {config.label}
                          </Badge>
                          <span className="ml-1">State changed</span>
                        </div>
                      )}

                      {/* Export */}
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs gap-1 font-mono"
                        onClick={() => exportNarrativePdf(narrative)}
                      >
                        <Download size={12} />
                        Export PDF
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** Dialog wrapper for opening the timeline in a modal */
interface NarrativeTimelineDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  applicantUserId: string;
  applicantLabel?: string;
}

export function NarrativeTimelineDialog({
  open,
  onOpenChange,
  applicantUserId,
  applicantLabel,
}: NarrativeTimelineDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto bg-card border-border">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-display text-lg">
            <History className="text-primary" size={20} />
            Assessment History
            {applicantLabel && (
              <span className="text-sm text-muted-foreground font-mono font-normal ml-2">
                — {applicantLabel}
              </span>
            )}
          </DialogTitle>
        </DialogHeader>
        <NarrativeTimeline applicantUserId={applicantUserId} applicantLabel={applicantLabel} />
      </DialogContent>
    </Dialog>
  );
}
