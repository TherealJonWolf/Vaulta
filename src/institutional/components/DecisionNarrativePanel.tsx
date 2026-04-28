import { deriveDecisionGrade } from "@/lib/decisionGrade";
import type { ScoreState } from "@/lib/trustNarrative";
import { CheckCircle2, AlertCircle, XCircle, HelpCircle } from "lucide-react";

interface Props {
  scoreState: string;
  trustScore: number | null;
  documentCount: number;
  documentTypes: string[];
}

const statusColors: Record<string, { bg: string; text: string; border: string; icon: any }> = {
  "APPROVED": { bg: "bg-emerald-50", text: "text-emerald-800", border: "border-emerald-200", icon: CheckCircle2 },
  "CONDITIONALLY APPROVED": { bg: "bg-amber-50", text: "text-amber-800", border: "border-amber-200", icon: AlertCircle },
  "NOT RECOMMENDED": { bg: "bg-red-50", text: "text-red-800", border: "border-red-200", icon: XCircle },
  "INSUFFICIENT DATA": { bg: "bg-slate-50", text: "text-slate-700", border: "border-slate-200", icon: HelpCircle },
};

const impactDot: Record<string, string> = {
  POSITIVE: "bg-emerald-500",
  NEGATIVE: "bg-red-500",
  NEUTRAL: "bg-slate-400",
};

export const DecisionNarrativePanel = ({ scoreState, trustScore, documentCount, documentTypes }: Props) => {
  const flagCount = scoreState === "flag" ? 1 : 0;
  const grade = deriveDecisionGrade({
    scoreState: scoreState as ScoreState,
    trustScore,
    documentCount,
    historyMonths: null,
    flagCount,
  });
  const cfg = statusColors[grade.status];
  const Icon = cfg.icon;

  return (
    <div className="border border-slate-200 rounded-lg overflow-hidden">
      <div className={`${cfg.bg} ${cfg.border} border-b px-4 py-3 flex items-start gap-3`}>
        <Icon className={`h-5 w-5 ${cfg.text} mt-0.5 shrink-0`} />
        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-medium uppercase tracking-wider text-slate-500">
            {grade.classification}
          </p>
          <p className={`text-sm font-semibold ${cfg.text}`}>{grade.status}</p>
          <p className="text-[11px] text-slate-600 mt-0.5">Risk level: <span className="font-medium">{grade.riskLevel}</span></p>
        </div>
      </div>

      <div className="px-4 py-3 bg-white border-b border-slate-100">
        <p className="text-[10px] font-medium uppercase tracking-wider text-slate-500 mb-1">Recommended Action</p>
        <p className="text-xs text-slate-700 leading-relaxed">{grade.actionGuidance}</p>
      </div>

      <div className="px-4 py-3 bg-white border-b border-slate-100">
        <p className="text-[10px] font-medium uppercase tracking-wider text-slate-500 mb-2">Signal Breakdown</p>
        <div className="space-y-1.5">
          {grade.signals.map((s) => (
            <div key={s.category} className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <span className={`h-1.5 w-1.5 rounded-full ${impactDot[s.impact]}`} />
                <span className="text-slate-700">{s.category}</span>
              </div>
              <span className="font-mono text-[10px] text-slate-600">{s.status}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="px-4 py-3 bg-slate-50 space-y-2">
        <div>
          <p className="text-[10px] font-medium uppercase tracking-wider text-slate-500">System Belief</p>
          <p className="text-[11px] text-slate-700 leading-relaxed">{grade.interpretation.systemBelief}</p>
        </div>
        <div>
          <p className="text-[10px] font-medium uppercase tracking-wider text-slate-500">Source of Uncertainty</p>
          <p className="text-[11px] text-slate-700 leading-relaxed">{grade.interpretation.uncertaintyCause}</p>
        </div>
        <div>
          <p className="text-[10px] font-medium uppercase tracking-wider text-slate-500">What Would Change The Outcome</p>
          <p className="text-[11px] text-slate-700 leading-relaxed">{grade.interpretation.additionalDataNeeded}</p>
        </div>
      </div>
    </div>
  );
};