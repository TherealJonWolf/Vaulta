import { Download, Clock, FileText, ShieldCheck, AlertTriangle, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  type TrustNarrative,
  type ScoreState,
} from "@/lib/trustNarrative";
import { exportNarrativePdf } from "@/lib/narrativePdfExport";
import { deriveDecisionGrade, type DecisionStatus, type SignalImpact } from "@/lib/decisionGrade";

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

const statusBadgeClass: Record<DecisionStatus, string> = {
  "APPROVED": "bg-emerald-500 text-white hover:bg-emerald-500",
  "CONDITIONALLY APPROVED": "bg-yellow-500 text-white hover:bg-yellow-500",
  "NOT RECOMMENDED": "bg-red-500 text-white hover:bg-red-500",
  "INSUFFICIENT DATA": "bg-gray-400 text-white hover:bg-gray-400",
};

const statusBorderClass: Record<DecisionStatus, string> = {
  "APPROVED": "border-l-emerald-500",
  "CONDITIONALLY APPROVED": "border-l-yellow-500",
  "NOT RECOMMENDED": "border-l-red-500",
  "INSUFFICIENT DATA": "border-l-gray-400",
};

const impactClass: Record<SignalImpact, string> = {
  POSITIVE: "text-emerald-600",
  NEGATIVE: "text-red-600",
  NEUTRAL: "text-muted-foreground",
};

export function TrustNarrativeCard({ narrative, compact }: TrustNarrativeCardProps) {
  const decision = deriveDecisionGrade({
    scoreState: narrative.score_state as ScoreState,
    trustScore: narrative.trust_score,
    documentCount: narrative.document_count,
    historyMonths: narrative.history_months,
    flagCount: narrative.flag_count,
    institutionName: narrative.institution_name,
  });

  return (
    <Card className={`border-l-4 ${statusBorderClass[decision.status]} border-border bg-card`}>
      <CardContent className={compact ? "py-4 px-4" : "pt-5"}>
        {/* Classification header */}
        <div className="flex items-start justify-between mb-4 gap-4 flex-wrap">
          <div className="space-y-1.5">
            <p className="text-[10px] font-semibold tracking-wider text-muted-foreground uppercase">
              {decision.classification}
            </p>
            <div className="flex items-center gap-2 flex-wrap">
              <Badge className={`text-xs font-semibold ${statusBadgeClass[decision.status]}`}>
                {decision.status}
              </Badge>
              <Badge variant="outline" className="text-xs font-medium">
                Risk: {decision.riskLevel}
              </Badge>
              {narrative.trust_score !== null && (
                <span className="text-xs text-muted-foreground font-mono">
                  {narrative.trust_score}/100
                </span>
              )}
            </div>
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

        {/* Action guidance */}
        <div className="flex items-start gap-2 mb-4 p-2.5 rounded-md bg-muted/40 border border-border">
          <ShieldCheck size={14} className="mt-0.5 shrink-0 text-foreground/70" />
          <p className="text-xs text-foreground leading-relaxed">
            <span className="font-semibold">Action Guidance:</span> {decision.actionGuidance}
          </p>
        </div>

        {/* Signal Breakdown Table */}
        <div className="mb-4">
          <p className="text-[10px] font-semibold tracking-wider text-muted-foreground uppercase mb-2">
            Signal Breakdown
          </p>
          <div className="rounded-md border border-border overflow-hidden">
            <table className="w-full text-xs">
              <thead className="bg-muted/40">
                <tr>
                  <th className="text-left font-medium px-3 py-1.5 text-muted-foreground">Category</th>
                  <th className="text-left font-medium px-3 py-1.5 text-muted-foreground">Status</th>
                  <th className="text-left font-medium px-3 py-1.5 text-muted-foreground">Impact</th>
                </tr>
              </thead>
              <tbody>
                {decision.signals.map((s) => (
                  <tr key={s.category} className="border-t border-border">
                    <td className="px-3 py-1.5 text-foreground">{s.category}</td>
                    <td className="px-3 py-1.5 font-mono font-medium text-foreground">{s.status}</td>
                    <td className={`px-3 py-1.5 font-medium ${impactClass[s.impact]}`}>{s.impact}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Decision Interpretation */}
        <div className="mb-4">
          <p className="text-[10px] font-semibold tracking-wider text-muted-foreground uppercase mb-2">
            Decision Interpretation
          </p>
          <dl className="space-y-1.5 text-xs">
            <div>
              <dt className="font-semibold text-foreground inline">System belief: </dt>
              <dd className="text-foreground/80 inline">{decision.interpretation.systemBelief}</dd>
            </div>
            <div>
              <dt className="font-semibold text-foreground inline">Source of uncertainty: </dt>
              <dd className="text-foreground/80 inline">{decision.interpretation.uncertaintyCause}</dd>
            </div>
            <div>
              <dt className="font-semibold text-foreground inline">Data that would change the outcome: </dt>
              <dd className="text-foreground/80 inline">{decision.interpretation.additionalDataNeeded}</dd>
            </div>
          </dl>
        </div>

        {/* Compliance statement */}
        <div className="flex items-start gap-2 mb-3 text-[11px] text-muted-foreground italic leading-relaxed">
          <Info size={11} className="mt-0.5 shrink-0" />
          <p>{decision.complianceStatement}</p>
        </div>

        {/* Timestamp — locked, immutable */}
        <div className="flex items-center gap-1 text-xs text-muted-foreground border-t border-border pt-2">
          <Clock size={11} />
          {formatAssessedDate(narrative.assessed_at)}
        </div>
      </CardContent>
    </Card>
  );
}

export function ScoreStateIndicator({ state }: { state: ScoreState }) {
  const decision = deriveDecisionGrade({
    scoreState: state,
    trustScore: state === "insufficient" ? null : 50,
    documentCount: state === "insufficient" ? 0 : 1,
    historyMonths: 0,
    flagCount: state === "flag" ? 1 : 0,
  });
  return (
    <div className="flex items-center gap-1.5">
      <AlertTriangle className={`${impactClass[decision.signals[0].impact]}`} size={10} />
      <span className="text-xs font-medium text-foreground">{decision.status}</span>
    </div>
  );
}
