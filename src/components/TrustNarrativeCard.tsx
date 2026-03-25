import { Download, Clock, FileText, Circle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  type TrustNarrative,
  type ScoreState,
  getScoreStateConfig,
} from "@/lib/trustNarrative";
import { exportNarrativePdf } from "@/lib/narrativePdfExport";

interface TrustNarrativeCardProps {
  narrative: TrustNarrative;
  compact?: boolean;
}

function formatAssessedDate(iso: string): string {
  const d = new Date(iso);
  return `Assessed on ${d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  })} at ${d.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    timeZoneName: "short",
  })}`;
}

export function TrustNarrativeCard({ narrative, compact }: TrustNarrativeCardProps) {
  const config = getScoreStateConfig(narrative.score_state as ScoreState);

  return (
    <Card
      className={`border-l-4 ${config.borderColor} border-border bg-card`}
    >
      <CardContent className={compact ? "py-3 px-4" : "pt-5"}>
        {/* Header row */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Circle
              className={`${config.textColor} fill-current`}
              size={10}
            />
            <Badge variant={config.badgeVariant} className="text-xs font-medium">
              {config.label}
            </Badge>
            {narrative.trust_score !== null && (
              <span className="text-xs text-muted-foreground font-mono">
                Score: {narrative.trust_score}/100
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <FileText size={12} />
              {narrative.document_count} doc{narrative.document_count !== 1 ? "s" : ""}
            </span>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs gap-1"
              onClick={() => exportNarrativePdf(narrative)}
            >
              <Download size={12} />
              Export PDF
            </Button>
          </div>
        </div>

        {/* Narrative text */}
        <p className="text-sm text-foreground leading-relaxed mb-3">
          {narrative.narrative_text}
        </p>

        {/* Timestamp — locked, immutable */}
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <Clock size={11} />
          {formatAssessedDate(narrative.assessed_at)}
        </div>
      </CardContent>
    </Card>
  );
}

export function ScoreStateIndicator({ state }: { state: ScoreState }) {
  const config = getScoreStateConfig(state);
  return (
    <div className="flex items-center gap-1.5">
      <Circle className={`${config.textColor} fill-current`} size={8} />
      <span className={`text-xs font-medium ${config.textColor}`}>
        {config.label}
      </span>
    </div>
  );
}
