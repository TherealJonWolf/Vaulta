import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Shield,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Download,
  RefreshCw,
  FileText,
  Lock,
  Key,
  Activity,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  runComplianceCheck,
  exportComplianceReport,
  getStatusLabel,
  type ComplianceReport,
  type ComplianceCheck,
  type ComplianceStatus,
} from "@/lib/complianceChecker";
import { getEncryptionMetadata } from "@/lib/encryption";

interface ComplianceDashboardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const StatusIcon = ({ status }: { status: ComplianceStatus }) => {
  switch (status) {
    case "pass":
      return <CheckCircle2 className="text-secure-green" size={18} />;
    case "fail":
      return <XCircle className="text-destructive" size={18} />;
    case "warning":
      return <AlertTriangle className="text-warning-amber" size={18} />;
    case "not_applicable":
      return <Activity className="text-muted-foreground" size={18} />;
  }
};

const ControlFamilyIcon = ({ family }: { family: string }) => {
  switch (family) {
    case "SC":
      return <Lock size={16} />;
    case "IA":
      return <Key size={16} />;
    case "AC":
      return <Shield size={16} />;
    case "AU":
      return <FileText size={16} />;
    default:
      return <Activity size={16} />;
  }
};

export const ComplianceDashboard = ({
  open,
  onOpenChange,
}: ComplianceDashboardProps) => {
  const [report, setReport] = useState<ComplianceReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);

  const runCheck = async () => {
    setLoading(true);
    setProgress(0);

    // Simulate progress
    const progressInterval = setInterval(() => {
      setProgress((prev) => Math.min(prev + 10, 90));
    }, 100);

    try {
      const result = await runComplianceCheck();
      setReport(result);
      setProgress(100);
    } finally {
      clearInterval(progressInterval);
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open && !report) {
      runCheck();
    }
  }, [open]);

  const downloadReport = () => {
    if (!report) return;

    const json = exportComplianceReport(report);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `compliance-report-${new Date().toISOString().split("T")[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const encryptionMeta = getEncryptionMetadata();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/10 border border-primary/30 flex items-center justify-center">
              <Shield className="text-primary" size={20} />
            </div>
            <div>
              <span className="gradient-text font-display">
                NIST 800-53 Compliance Check
              </span>
              <p className="text-xs text-muted-foreground font-mono font-normal">
                Automated Security Verification
              </p>
            </div>
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-6 pr-2">
          {/* Loading State */}
          {loading && (
            <div className="space-y-4 py-8">
              <div className="text-center">
                <RefreshCw className="mx-auto text-primary animate-spin mb-4" size={32} />
                <p className="text-muted-foreground font-mono text-sm">
                  Running compliance checks...
                </p>
              </div>
              <Progress value={progress} className="h-2" />
            </div>
          )}

          {/* Report Content */}
          {report && !loading && (
            <>
              {/* Summary Card */}
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`p-4 rounded-xl border ${
                  report.overallStatus === "pass"
                    ? "bg-secure-green/10 border-secure-green/30"
                    : report.overallStatus === "fail"
                    ? "bg-destructive/10 border-destructive/30"
                    : "bg-warning-amber/10 border-warning-amber/30"
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <StatusIcon status={report.overallStatus} />
                    <div>
                      <h3 className="font-display font-bold">
                        {getStatusLabel(report.overallStatus)}
                      </h3>
                      <p className="text-xs text-muted-foreground font-mono">
                        {report.summary.passed}/{report.summary.total} checks passed
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={runCheck}>
                      <RefreshCw size={14} className="mr-1" />
                      Recheck
                    </Button>
                    <Button variant="outline" size="sm" onClick={downloadReport}>
                      <Download size={14} className="mr-1" />
                      Export
                    </Button>
                  </div>
                </div>
              </motion.div>

              {/* Encryption Info */}
              <div className="cyber-border rounded-lg p-4">
                <h4 className="font-display font-bold text-primary mb-3 flex items-center gap-2">
                  <Lock size={16} />
                  Encryption Standards
                </h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Algorithm:</span>
                    <span className="ml-2 font-mono text-foreground">
                      {encryptionMeta.algorithm}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Key Length:</span>
                    <span className="ml-2 font-mono text-foreground">
                      {encryptionMeta.keyLength}-bit
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Key Derivation:</span>
                    <span className="ml-2 font-mono text-foreground">
                      {encryptionMeta.keyDerivation}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Iterations:</span>
                    <span className="ml-2 font-mono text-foreground">
                      {encryptionMeta.keyDerivationIterations.toLocaleString()}
                    </span>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {encryptionMeta.compliance.map((standard) => (
                    <span
                      key={standard}
                      className="px-2 py-1 text-xs font-mono bg-primary/10 text-primary rounded border border-primary/20"
                    >
                      {standard}
                    </span>
                  ))}
                </div>
              </div>

              {/* Individual Checks */}
              <div className="space-y-3">
                <h4 className="font-display font-bold text-foreground">
                  Compliance Checks
                </h4>
                {report.checks.map((check, index) => (
                  <motion.div
                    key={check.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className="p-3 rounded-lg border border-border bg-card/50 hover:bg-card transition-colors"
                  >
                    <div className="flex items-start gap-3">
                      <StatusIcon status={check.status} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="px-1.5 py-0.5 text-xs font-mono bg-muted rounded flex items-center gap-1">
                            <ControlFamilyIcon family={check.controlFamily} />
                            {check.controlId}
                          </span>
                          <h5 className="font-medium text-sm truncate">
                            {check.name}
                          </h5>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {check.details}
                        </p>
                        {check.remediation && (
                          <p className="text-xs text-warning-amber mt-1 flex items-center gap-1">
                            <AlertTriangle size={12} />
                            {check.remediation}
                          </p>
                        )}
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>

              {/* Report Timestamp */}
              <div className="text-center text-xs text-muted-foreground font-mono pt-4 border-t border-border">
                Report generated: {new Date(report.generatedAt).toLocaleString()}
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ComplianceDashboard;
