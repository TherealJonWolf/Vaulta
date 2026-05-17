import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ShieldCheck, Loader2, Check, Copy } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Props {
  submissionId: string;
  applicantName: string;
  disabled?: boolean;
}

interface IssuedReport {
  reportHash: string;
  reportId: string;
  issuedAt: string;
  idempotent?: boolean;
}

/**
 * Phase 2 — Verifiable Reports: institutional issuance.
 *
 * Calls issue-assessment-report which writes an immutable assessment_reports
 * row. The returned hash resolves at /verify/:hash for third parties.
 */
export const IssueAssessmentReportButton = ({
  submissionId,
  applicantName,
  disabled,
}: Props) => {
  const [loading, setLoading] = useState(false);
  const [issued, setIssued] = useState<IssuedReport | null>(null);
  const [copied, setCopied] = useState(false);

  const handleIssue = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke(
        "issue-assessment-report",
        { body: { submission_id: submissionId } },
      );
      if (error) throw new Error(error.message ?? "Failed to issue report");
      if (!data?.ok) throw new Error(data?.error ?? "Unknown error");
      setIssued({
        reportHash: data.report_hash,
        reportId: data.report_id,
        issuedAt: data.issued_at,
        idempotent: data.idempotent,
      });
      toast.success(
        data.idempotent
          ? "Existing verified report returned (no state change)"
          : "Verified assessment report issued",
      );
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Could not issue report",
      );
    } finally {
      setLoading(false);
    }
  };

  const verifyUrl = issued
    ? `${window.location.origin}/verify/${issued.reportHash}`
    : "";

  const copy = async (text: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <>
      <Button
        onClick={handleIssue}
        disabled={disabled || loading}
        variant="outline"
        className="w-full gap-2 border-slate-300"
      >
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <ShieldCheck className="h-4 w-4" />
        )}
        {loading ? "Issuing…" : "Issue Verified Assessment Report"}
      </Button>

      <Dialog open={!!issued} onOpenChange={(o) => !o && setIssued(null)}>
        <DialogContent className="bg-white">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-emerald-600" />
              Verified Assessment Report Issued
            </DialogTitle>
            <DialogDescription>
              An immutable record has been written for {applicantName}. Anyone
              with the hash can confirm authenticity at the verify URL — no
              personally identifying information is exposed.
            </DialogDescription>
          </DialogHeader>
          {issued && (
            <div className="space-y-3">
              <div className="rounded border bg-slate-50 p-3">
                <div className="text-xs font-semibold text-slate-500">
                  REPORT HASH (SHA-256)
                </div>
                <div className="mt-1 flex items-start justify-between gap-2">
                  <code className="break-all font-mono text-xs">
                    {issued.reportHash}
                  </code>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => copy(issued.reportHash)}
                    className="shrink-0"
                  >
                    {copied ? (
                      <Check className="h-3.5 w-3.5" />
                    ) : (
                      <Copy className="h-3.5 w-3.5" />
                    )}
                  </Button>
                </div>
              </div>
              <div className="rounded border bg-slate-50 p-3 text-xs">
                <div className="font-semibold text-slate-500">VERIFY URL</div>
                <code className="mt-1 block break-all font-mono">
                  {verifyUrl}
                </code>
              </div>
              {issued.idempotent && (
                <p className="text-xs text-slate-500">
                  No change detected since the last issuance — the prior
                  immutable record was returned.
                </p>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};