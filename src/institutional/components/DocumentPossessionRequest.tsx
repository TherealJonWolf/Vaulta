import { useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useInstitutionalAuth } from "../hooks/useInstitutionalAuth";
import { toast } from "sonner";
import { Loader2, FileText, Scale, Clock, Send } from "lucide-react";

const DOCUMENT_CATEGORIES = [
  { id: "gov_id", label: "Government-issued photo ID" },
  { id: "proof_income", label: "Proof of income (pay stubs, offer letter, tax return)" },
  { id: "bank_statements", label: "Bank statements" },
  { id: "employment_verification", label: "Employment verification" },
  { id: "rental_history", label: "Rental history / prior landlord reference" },
  { id: "credit_authorization", label: "Credit authorization form" },
];

const LEGAL_BASES = [
  { value: "ecoa", label: "ECOA compliance — credit application record retention (25 months)" },
  { value: "fha", label: "FHA compliance — fair housing documentation" },
  { value: "hud", label: "HUD program compliance — federally assisted housing tenant file" },
  { value: "internal", label: "Internal policy — institution's own document retention policy" },
];

const RETENTION_PERIODS = [
  { value: "25_months", label: "25 months (ECOA minimum)" },
  { value: "3_years", label: "3 years" },
  { value: "5_years", label: "5 years" },
  { value: "7_years", label: "7 years" },
  { value: "tenancy_plus_3", label: "Duration of tenancy plus 3 years (HUD standard)" },
  { value: "custom", label: "Custom" },
];

interface Props {
  open: boolean;
  onClose: () => void;
  applicantName: string;
  applicantUserId?: string;
  submissionId: string;
  referenceId: string;
}

export const DocumentPossessionRequest = ({ open, onClose, applicantName, applicantUserId, submissionId, referenceId }: Props) => {
  const { institutionId, user } = useInstitutionalAuth();
  const [step, setStep] = useState(1);
  const [sending, setSending] = useState(false);

  // Step 1
  const [selectedDocs, setSelectedDocs] = useState<string[]>([]);
  const [otherDocType, setOtherDocType] = useState("");

  // Step 2
  const [legalBasis, setLegalBasis] = useState("");
  const [legalBasisDetail, setLegalBasisDetail] = useState("");

  // Step 3
  const [retentionPeriod, setRetentionPeriod] = useState("");
  const [customDate, setCustomDate] = useState("");

  const toggleDoc = (id: string) => {
    setSelectedDocs((prev) => prev.includes(id) ? prev.filter((d) => d !== id) : [...prev, id]);
  };

  const allDocTypes = [
    ...selectedDocs.map((id) => DOCUMENT_CATEGORIES.find((c) => c.id === id)?.label || id),
    ...(otherDocType.trim() ? [otherDocType.trim()] : []),
  ];

  const legalBasisLabel = legalBasis === "other"
    ? legalBasisDetail
    : LEGAL_BASES.find((b) => b.value === legalBasis)?.label || legalBasis;

  const retentionLabel = retentionPeriod === "custom"
    ? `Until ${customDate}`
    : RETENTION_PERIODS.find((r) => r.value === retentionPeriod)?.label || retentionPeriod;

  const calculateRetentionExpiry = (): string | null => {
    const now = new Date();
    switch (retentionPeriod) {
      case "25_months": return new Date(now.setMonth(now.getMonth() + 25)).toISOString();
      case "3_years": return new Date(now.setFullYear(now.getFullYear() + 3)).toISOString();
      case "5_years": return new Date(now.setFullYear(now.getFullYear() + 5)).toISOString();
      case "7_years": return new Date(now.setFullYear(now.getFullYear() + 7)).toISOString();
      case "custom": return customDate ? new Date(customDate).toISOString() : null;
      default: return null; // tenancy_plus_3 is open-ended
    }
  };

  const handleSend = async () => {
    if (!institutionId || !user) return;
    setSending(true);
    try {
      const { error } = await (supabase.from as any)("document_possession_requests").insert({
        institution_id: institutionId,
        applicant_user_id: applicantUserId || "00000000-0000-0000-0000-000000000000",
        submission_id: submissionId,
        requested_by: user.id,
        document_types: allDocTypes,
        legal_basis: legalBasisLabel,
        legal_basis_detail: legalBasis === "other" ? legalBasisDetail : null,
        retention_period: retentionLabel,
        retention_expires_at: calculateRetentionExpiry(),
        reference_id: referenceId,
        applicant_name: applicantName,
      });

      if (error) throw error;

      // Log activity
      await (supabase.from as any)("institutional_activity_log").insert({
        institution_id: institutionId,
        user_id: user.id,
        event_type: "Document Request Sent",
        reference_id: referenceId,
        applicant_name: applicantName,
        detail: `Requested ${allDocTypes.length} document type(s) under ${legalBasis.toUpperCase()} compliance`,
      });

      toast.success("Document request sent to applicant");
      onClose();
      resetForm();
    } catch (err: any) {
      console.error("Send request error:", err);
      toast.error(err.message || "Failed to send request");
    } finally {
      setSending(false);
    }
  };

  const resetForm = () => {
    setStep(1);
    setSelectedDocs([]);
    setOtherDocType("");
    setLegalBasis("");
    setLegalBasisDetail("");
    setRetentionPeriod("");
    setCustomDate("");
  };

  const canProceedStep1 = allDocTypes.length > 0;
  const canProceedStep2 = legalBasis && (legalBasis !== "other" || legalBasisDetail.trim());
  const canProceedStep3 = retentionPeriod && (retentionPeriod !== "custom" || customDate);

  return (
    <Sheet open={open} onOpenChange={(o) => { if (!o) { onClose(); resetForm(); } }}>
      <SheetContent className="w-[500px] sm:w-[560px] overflow-auto">
        <SheetHeader>
          <SheetTitle className="text-lg font-semibold">Request Documents — {applicantName}</SheetTitle>
        </SheetHeader>

        {/* Step indicators */}
        <div className="flex items-center gap-2 mt-4 mb-6">
          {[1, 2, 3, 4].map((s) => (
            <div key={s} className={`h-1.5 flex-1 rounded-full transition-colors ${step >= s ? "bg-slate-900" : "bg-slate-200"}`} />
          ))}
        </div>

        {step === 1 && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm font-medium text-slate-700">
              <FileText className="h-4 w-4" /> Select Document Types
            </div>
            <div className="space-y-3">
              {DOCUMENT_CATEGORIES.map((cat) => (
                <label key={cat.id} className="flex items-start gap-3 cursor-pointer">
                  <Checkbox checked={selectedDocs.includes(cat.id)} onCheckedChange={() => toggleDoc(cat.id)} className="mt-0.5" />
                  <span className="text-sm text-slate-700">{cat.label}</span>
                </label>
              ))}
              <div className="space-y-1 pt-2 border-t border-slate-100">
                <Label className="text-xs text-slate-500">Other (specify)</Label>
                <Input value={otherDocType} onChange={(e) => setOtherDocType(e.target.value)} placeholder="e.g. Lease agreement" />
              </div>
            </div>
            <Button onClick={() => setStep(2)} disabled={!canProceedStep1} className="w-full">Next — Legal Basis</Button>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm font-medium text-slate-700">
              <Scale className="h-4 w-4" /> Legal Basis for Retention
            </div>
            <div className="space-y-3">
              {LEGAL_BASES.map((b) => (
                <label key={b.value} className="flex items-start gap-3 cursor-pointer">
                  <input type="radio" name="legalBasis" value={b.value} checked={legalBasis === b.value}
                    onChange={() => setLegalBasis(b.value)} className="mt-1" />
                  <span className="text-sm text-slate-700">{b.label}</span>
                </label>
              ))}
              <label className="flex items-start gap-3 cursor-pointer">
                <input type="radio" name="legalBasis" value="other" checked={legalBasis === "other"}
                  onChange={() => setLegalBasis("other")} className="mt-1" />
                <span className="text-sm text-slate-700">Other</span>
              </label>
              {legalBasis === "other" && (
                <Textarea value={legalBasisDetail} onChange={(e) => setLegalBasisDetail(e.target.value)} placeholder="Specify legal basis..." rows={2} />
              )}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep(1)} className="flex-1">Back</Button>
              <Button onClick={() => setStep(3)} disabled={!canProceedStep2} className="flex-1">Next — Retention Period</Button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm font-medium text-slate-700">
              <Clock className="h-4 w-4" /> Retention Period
            </div>
            <div className="space-y-3">
              {RETENTION_PERIODS.map((r) => (
                <label key={r.value} className="flex items-start gap-3 cursor-pointer">
                  <input type="radio" name="retention" value={r.value} checked={retentionPeriod === r.value}
                    onChange={() => setRetentionPeriod(r.value)} className="mt-1" />
                  <span className="text-sm text-slate-700">{r.label}</span>
                </label>
              ))}
              {retentionPeriod === "custom" && (
                <Input type="date" value={customDate} onChange={(e) => setCustomDate(e.target.value)} />
              )}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep(2)} className="flex-1">Back</Button>
              <Button onClick={() => setStep(4)} disabled={!canProceedStep3} className="flex-1">Review</Button>
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm font-medium text-slate-700">
              <Send className="h-4 w-4" /> Confirm & Send
            </div>
            <div className="bg-slate-50 rounded-lg p-4 space-y-3 text-sm">
              <div>
                <span className="text-xs text-slate-500 uppercase tracking-wider">Applicant</span>
                <p className="font-medium text-slate-900">{applicantName}</p>
              </div>
              <div>
                <span className="text-xs text-slate-500 uppercase tracking-wider">Documents Requested</span>
                <ul className="list-disc list-inside text-slate-700">
                  {allDocTypes.map((d, i) => <li key={i}>{d}</li>)}
                </ul>
              </div>
              <div>
                <span className="text-xs text-slate-500 uppercase tracking-wider">Legal Basis</span>
                <p className="text-slate-700">{legalBasisLabel}</p>
              </div>
              <div>
                <span className="text-xs text-slate-500 uppercase tracking-wider">Retention Period</span>
                <p className="text-slate-700">{retentionLabel}</p>
              </div>
            </div>
            <p className="text-xs text-slate-500">
              The applicant will receive a notification and must explicitly approve the transfer before any documents are shared.
            </p>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep(3)} className="flex-1">Back</Button>
              <Button onClick={handleSend} disabled={sending} className="flex-1 gap-2">
                {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                Send Request
              </Button>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
};
