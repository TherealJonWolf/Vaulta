import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Shield, Upload, Search, AlertTriangle, Ban, CheckCircle2, X, Play, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface SimulationStep {
  id: string;
  label: string;
  action: string;
  outcome: string;
  icon: typeof Shield;
  status: "pending" | "active" | "pass" | "fail";
}

const INITIAL_STEPS: SimulationStep[] = [
  {
    id: "ingestion",
    label: "Ingestion",
    action: "User uploads a Government PDF.",
    outcome: "Scanned for malware, XSS scripts, and SQL injection patterns.",
    icon: Upload,
    status: "pending",
  },
  {
    id: "validation",
    label: "Validation",
    action: "AI/OCR checks for metadata tampering.",
    outcome: "Magic-byte signature verified against declared MIME type. Content scanned for embedded scripts.",
    icon: Search,
    status: "pending",
  },
  {
    id: "enforcement",
    label: "Enforcement",
    action: 'If "False" or tampered content is detected.',
    outcome: "Trigger: Kill-switch activated. Account locked. Email blacklisted. Security event logged.",
    icon: AlertTriangle,
    status: "pending",
  },
  {
    id: "review",
    label: "Review",
    action: "Admin notification sent via security events log.",
    outcome: "Manual override required to reinstate user access. Full audit trail preserved.",
    icon: Ban,
    status: "pending",
  },
];

interface ThreatSimulationProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const ThreatSimulation = ({ open, onOpenChange }: ThreatSimulationProps) => {
  const [steps, setSteps] = useState<SimulationStep[]>(INITIAL_STEPS);
  const [running, setRunning] = useState(false);
  const [currentStep, setCurrentStep] = useState(-1);
  const [complete, setComplete] = useState(false);

  const runSimulation = async () => {
    setRunning(true);
    setComplete(false);
    setSteps(INITIAL_STEPS);

    for (let i = 0; i < INITIAL_STEPS.length; i++) {
      setCurrentStep(i);
      setSteps((prev) =>
        prev.map((s, idx) => (idx === i ? { ...s, status: "active" } : s))
      );
      await new Promise((r) => setTimeout(r, 1800));

      const finalStatus = i === 2 ? "fail" : i === 3 ? "fail" : "pass";
      setSteps((prev) =>
        prev.map((s, idx) => (idx === i ? { ...s, status: finalStatus } : s))
      );
      await new Promise((r) => setTimeout(r, 600));
    }

    setRunning(false);
    setComplete(true);
    setCurrentStep(-1);
  };

  const reset = () => {
    setSteps(INITIAL_STEPS);
    setRunning(false);
    setComplete(false);
    setCurrentStep(-1);
  };

  if (!open) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-6"
        onClick={() => onOpenChange(false)}
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          className="w-full max-w-3xl cyber-border rounded-2xl bg-card max-h-[90vh] overflow-y-auto"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="p-6 border-b border-border flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-destructive/10 border border-destructive/30 flex items-center justify-center">
                <Shield className="text-destructive" size={24} />
              </div>
              <div>
                <h2 className="font-display text-xl font-bold gradient-text">
                  Threat Simulation
                </h2>
                <p className="text-sm text-muted-foreground font-mono">
                  Security Handshake — Document Interception Demo
                </p>
              </div>
            </div>
            <Button variant="ghost" size="icon" onClick={() => onOpenChange(false)}>
              <X size={20} />
            </Button>
          </div>

          {/* Simulation Steps */}
          <div className="p-6 space-y-4">
            {/* Table Header */}
            <div className="grid grid-cols-12 gap-4 px-4 py-2 text-xs font-mono text-muted-foreground uppercase tracking-wider">
              <div className="col-span-1">Status</div>
              <div className="col-span-2">Step</div>
              <div className="col-span-4">Action</div>
              <div className="col-span-5">Outcome</div>
            </div>

            {steps.map((step, index) => {
              const Icon = step.icon;
              return (
                <motion.div
                  key={step.id}
                  initial={{ opacity: 0.5 }}
                  animate={{
                    opacity: step.status === "pending" ? 0.5 : 1,
                    scale: step.status === "active" ? 1.01 : 1,
                  }}
                  transition={{ duration: 0.3 }}
                  className={`grid grid-cols-12 gap-4 p-4 rounded-xl border transition-colors ${
                    step.status === "active"
                      ? "border-primary/50 bg-primary/5"
                      : step.status === "fail"
                      ? "border-destructive/50 bg-destructive/5"
                      : step.status === "pass"
                      ? "border-primary/30 bg-primary/5"
                      : "border-border bg-card/50"
                  }`}
                >
                  <div className="col-span-1 flex items-center">
                    {step.status === "active" && (
                      <div className="w-6 h-6 rounded-full border-2 border-primary border-t-transparent animate-spin" />
                    )}
                    {step.status === "pass" && (
                      <CheckCircle2 className="text-primary" size={20} />
                    )}
                    {step.status === "fail" && (
                      <AlertTriangle className="text-destructive" size={20} />
                    )}
                    {step.status === "pending" && (
                      <div className="w-5 h-5 rounded-full border border-border" />
                    )}
                  </div>
                  <div className="col-span-2 flex items-center">
                    <span className={`font-display font-bold text-sm ${
                      step.status === "fail" ? "text-destructive" : "text-primary"
                    }`}>
                      {step.label}
                    </span>
                  </div>
                  <div className="col-span-4 flex items-center">
                    <p className="text-sm text-muted-foreground font-rajdhani">
                      {step.action}
                    </p>
                  </div>
                  <div className="col-span-5 flex items-center">
                    <p className={`text-sm font-rajdhani ${
                      step.status === "fail"
                        ? "text-destructive font-semibold"
                        : "text-muted-foreground"
                    }`}>
                      {step.status !== "pending" ? step.outcome : "—"}
                    </p>
                  </div>
                </motion.div>
              );
            })}
          </div>

          {/* Result Summary */}
          {complete && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mx-6 mb-4 p-4 rounded-xl border border-destructive/30 bg-destructive/5"
            >
              <div className="flex items-center gap-3">
                <Ban className="text-destructive" size={20} />
                <div>
                  <p className="font-display font-bold text-destructive text-sm">
                    THREAT NEUTRALIZED — Account Suspended
                  </p>
                  <p className="text-xs text-muted-foreground font-mono mt-1">
                    Fraudulent document intercepted → Account locked → Email blacklisted → Audit trail created → Admin notified
                  </p>
                </div>
              </div>
            </motion.div>
          )}

          {/* Controls */}
          <div className="p-6 border-t border-border flex items-center justify-between">
            <p className="text-xs text-muted-foreground font-mono">
              Simulated flow — no real accounts are affected
            </p>
            <div className="flex gap-3">
              {complete && (
                <Button variant="outline" onClick={reset} className="font-rajdhani">
                  <RotateCcw size={16} className="mr-2" />
                  Reset
                </Button>
              )}
              <Button
                onClick={runSimulation}
                disabled={running}
                className="btn-gradient font-rajdhani font-bold text-primary-foreground"
              >
                {running ? (
                  <>Running...</>
                ) : (
                  <>
                    <Play size={16} className="mr-2" />
                    {complete ? "Run Again" : "Start Simulation"}
                  </>
                )}
              </Button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};
