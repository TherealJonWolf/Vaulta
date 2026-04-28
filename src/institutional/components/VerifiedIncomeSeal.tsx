import { ShieldCheck } from "lucide-react";

interface Props {
  trustScore: number | null;
  scoreState: string;
  documentTypes: string[];
}

/**
 * Vaulta Verified Income seal — surfaced when:
 *  - score_state is "clear" (no flags), AND
 *  - at least one income-bearing document type is present, AND
 *  - trust_score >= 70
 */
export const VerifiedIncomeSeal = ({ trustScore, scoreState, documentTypes }: Props) => {
  const incomeKeywords = ["paystub", "payslip", "income", "tax", "w-2", "w2", "1099", "salary", "bank statement", "employment"];
  const hasIncomeDoc = (documentTypes || []).some((t) =>
    incomeKeywords.some((k) => t.toLowerCase().includes(k))
  );
  const eligible = scoreState === "clear" && hasIncomeDoc && (trustScore ?? 0) >= 70;
  if (!eligible) return null;

  return (
    <div className="flex items-center gap-2.5 px-3 py-2 rounded-md bg-gradient-to-r from-emerald-50 to-emerald-100/50 border border-emerald-200">
      <div className="h-8 w-8 rounded-full bg-emerald-600 flex items-center justify-center shrink-0">
        <ShieldCheck className="h-4 w-4 text-white" />
      </div>
      <div className="min-w-0">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-emerald-700">Vaulta Verified Income</p>
        <p className="text-[10px] text-emerald-800/80 leading-tight">Cryptographically validated income evidence on file.</p>
      </div>
    </div>
  );
};