import { useState } from "react";
import { motion } from "framer-motion";
import { CheckCircle2, XCircle, Download, FileText, ShieldCheck, ShieldAlert } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export interface VerificationCheck {
  name: string;
  passed: boolean;
  explanation: string;
}

export interface DocumentAuditData {
  documentType: string;
  fileName: string;
  submittedBy: string;
  submissionDate: string;
  overallVerified: boolean;
  checks: VerificationCheck[];
}

const DEFAULT_CHECK_EXPLANATIONS: Record<string, { pass: string; fail: string }> = {
  "Magic-Byte Signature Check": {
    pass: "The file's internal signature matches the expected format. This document is genuinely the file type it claims to be.",
    fail: "The file's internal signature does not match its extension. This document may be disguised as a different file type.",
  },
  "Malicious Content Scan": {
    pass: "No embedded scripts, macros, or malicious payloads were detected in this document.",
    fail: "Potentially malicious content such as embedded scripts or macros was detected within this document.",
  },
  "SHA-256 Fingerprint": {
    pass: "This document has a unique file signature. It has not been previously submitted by another applicant in our system.",
    fail: "This document's file signature matches one already submitted by a different applicant, indicating a possible duplicate submission.",
  },
  "EXIF & Metadata Analysis": {
    pass: "The document's internal metadata is consistent — creation and modification dates align with expected patterns.",
    fail: "The document's internal metadata shows it was modified after its creation date, which may indicate the document was altered before submission.",
  },
  "Document Structure Validation": {
    pass: "The internal structure of this document is intact and consistent with a legitimately generated file.",
    fail: "The document's internal structure contains anomalies that suggest it may have been manually reconstructed or tampered with.",
  },
  "Cross-User Duplicate Detection": {
    pass: "This document has not been submitted by any other user in the system.",
    fail: "An identical or near-identical document was found submitted under a different user account.",
  },
  "AI Authenticity Analysis": {
    pass: "AI analysis found no indicators of forgery, templating, or synthetic generation in this document.",
    fail: "AI analysis detected patterns consistent with document fabrication, templating, or synthetic generation.",
  },
  "Data Consistency Check": {
    pass: "The data within this document is internally consistent — amounts, dates, and identifiers align correctly.",
    fail: "Inconsistencies were found between data fields within this document, such as mismatched totals or conflicting dates.",
  },
};

interface Props {
  audit: DocumentAuditData;
}

const DocumentVerificationAudit = ({ audit }: Props) => {
  const [generating, setGenerating] = useState(false);

  const handleDownloadReport = async () => {
    setGenerating(true);
    try {
      const lines = [
        "VAULTA — DOCUMENT VERIFICATION AUDIT REPORT",
        "=".repeat(50),
        "",
        `Document Type:    ${audit.documentType}`,
        `File Name:        ${audit.fileName}`,
        `Submitted By:     ${audit.submittedBy}`,
        `Submission Date:  ${audit.submissionDate}`,
        `Overall Status:   ${audit.overallVerified ? "VERIFIED" : "FLAGGED"}`,
        "",
        "-".repeat(50),
        "",
        ...audit.checks.flatMap((c) => [
          `[${c.passed ? "PASS" : "FAIL"}] ${c.name}`,
          `  ${c.explanation}`,
          "",
        ]),
        "-".repeat(50),
        `Report generated: ${new Date().toISOString()}`,
      ];
      const blob = new Blob([lines.join("\n")], { type: "text/plain" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `vaulta-audit-${audit.fileName.replace(/\s+/g, "_")}.txt`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } finally {
      setGenerating(false);
    }
  };

  const passCount = audit.checks.filter((c) => c.passed).length;

  return (
    <div className="space-y-6">
      {/* Document Header */}
      <Card className="cyber-border overflow-hidden">
        <CardContent className="p-6">
          <div className="flex items-start justify-between flex-wrap gap-4">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-xl border border-border bg-muted/30">
                <FileText size={28} className="text-primary" />
              </div>
              <div>
                <p className="font-mono text-[10px] text-muted-foreground uppercase tracking-widest">
                  Document Type
                </p>
                <h2 className="font-display text-xl font-bold text-foreground">
                  {audit.documentType}
                </h2>
                <p className="font-mono text-xs text-muted-foreground mt-1">
                  {audit.fileName} · Submitted {audit.submissionDate} · by {audit.submittedBy}
                </p>
              </div>
            </div>

            <Badge
              className={`font-mono text-sm px-4 py-1.5 rounded-md border ${
                audit.overallVerified
                  ? "bg-[#1D9E75]/15 text-[#1D9E75] border-[#1D9E75]/30"
                  : "bg-[#E24B4A]/15 text-[#E24B4A] border-[#E24B4A]/30"
              }`}
            >
              {audit.overallVerified ? (
                <ShieldCheck size={14} className="mr-1.5" />
              ) : (
                <ShieldAlert size={14} className="mr-1.5" />
              )}
              {audit.overallVerified ? "VERIFIED" : "FLAGGED"}
            </Badge>
          </div>

          <p className="font-mono text-xs text-muted-foreground mt-4">
            {passCount}/{audit.checks.length} checks passed
          </p>
        </CardContent>
      </Card>

      {/* Verification Checks */}
      <div className="space-y-3">
        {audit.checks.map((check, i) => (
          <motion.div
            key={check.name}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
          >
            <Card
              className={`border ${
                check.passed
                  ? "border-[#1D9E75]/20 bg-[#1D9E75]/[0.03]"
                  : "border-[#E24B4A]/20 bg-[#E24B4A]/[0.03]"
              }`}
            >
              <CardContent className="p-4 flex items-start gap-4">
                <div className="mt-0.5 shrink-0">
                  {check.passed ? (
                    <CheckCircle2 size={20} className="text-[#1D9E75]" />
                  ) : (
                    <XCircle size={20} className="text-[#E24B4A]" />
                  )}
                </div>
                <div className="min-w-0">
                  <p className="font-display text-sm font-bold text-foreground">
                    {check.name}
                  </p>
                  <p className="font-mono text-xs text-muted-foreground mt-1 leading-relaxed">
                    {check.explanation}
                  </p>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Download Button */}
      <div className="flex justify-end">
        <Button
          onClick={handleDownloadReport}
          disabled={generating}
          variant="outline"
          className="font-mono text-xs gap-2"
        >
          <Download size={14} />
          {generating ? "GENERATING..." : "DOWNLOAD AUDIT REPORT"}
        </Button>
      </div>
    </div>
  );
};

export { DEFAULT_CHECK_EXPLANATIONS };
export default DocumentVerificationAudit;
