import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Shield, Wifi, Lock, Database, CheckCircle } from "lucide-react";

interface InitializingScreenProps {
  onComplete: () => void;
}

const steps = [
  { id: "connecting", label: "CONNECTING", icon: Wifi },
  { id: "encrypting", label: "ENCRYPTING", icon: Lock },
  { id: "syncing", label: "SYNCING", icon: Database },
  { id: "secured", label: "SECURED", icon: CheckCircle },
];

export const InitializingScreen = ({ onComplete }: InitializingScreenProps) => {
  const [progress, setProgress] = useState(0);
  const [currentStep, setCurrentStep] = useState(0);
  const [terminalText, setTerminalText] = useState<string[]>([]);

  const terminalLines = [
    "> SOVEREIGN SECTOR v2.0.47 // CLASSIFIED",
    "> ESTABLISHING SECURE CHANNEL...",
    "> ENCRYPTION PROTOCOLS ACTIVE",
    "> NIST-800-53 COMPLIANCE VERIFIED",
    "> BIOMETRIC SYSTEMS ONLINE",
    "> VAULT ACCESS GRANTED",
  ];

  useEffect(() => {
    // Fast initialization - completes in ~2 seconds
    const duration = 2000;
    const interval = 50;
    const increment = 100 / (duration / interval);

    const progressTimer = setInterval(() => {
      setProgress((prev) => {
        const next = prev + increment;
        if (next >= 100) {
          clearInterval(progressTimer);
          setTimeout(onComplete, 300);
          return 100;
        }
        return next;
      });
    }, interval);

    // Update step based on progress
    const stepInterval = setInterval(() => {
      setProgress((p) => {
        if (p < 25) setCurrentStep(0);
        else if (p < 50) setCurrentStep(1);
        else if (p < 75) setCurrentStep(2);
        else setCurrentStep(3);
        return p;
      });
    }, 100);

    // Terminal text animation
    let lineIndex = 0;
    const terminalTimer = setInterval(() => {
      if (lineIndex < terminalLines.length) {
        setTerminalText((prev) => [...prev, terminalLines[lineIndex]]);
        lineIndex++;
      } else {
        clearInterval(terminalTimer);
      }
    }, 300);

    return () => {
      clearInterval(progressTimer);
      clearInterval(stepInterval);
      clearInterval(terminalTimer);
    };
  }, [onComplete]);

  return (
    <motion.div
      className="fixed inset-0 bg-background grid-bg flex flex-col items-center justify-center p-8 z-50"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      {/* Shield Logo */}
      <motion.div
        className="relative mb-8"
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.5 }}
      >
        <div className="absolute inset-0 bg-primary/20 rounded-full blur-3xl scale-150" />
        <div className="relative p-8 rounded-full border-2 border-primary/40 bg-card/30 backdrop-blur shield-pulse">
          <Shield size={80} className="text-primary" strokeWidth={1} />
        </div>
      </motion.div>

      {/* Title */}
      <motion.h1
        className="font-display text-4xl md:text-5xl font-bold gradient-text mb-2 text-center"
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.2 }}
      >
        INITIALIZING SOVEREIGN VAULT
      </motion.h1>

      <motion.p
        className="text-muted-foreground font-mono text-sm mb-8"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3 }}
      >
        // ESTABLISHING SECURE CONNECTION //
      </motion.p>

      {/* Progress Bar */}
      <motion.div
        className="w-full max-w-xl mb-8"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.4 }}
      >
        <div className="flex justify-between mb-2">
          <span className="text-xs font-mono text-muted-foreground">PROGRESS</span>
          <span className="text-xs font-mono text-primary">{Math.round(progress)}%</span>
        </div>
        <div className="h-1 bg-secondary rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-gradient-to-r from-primary to-accent"
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.1 }}
          />
        </div>
      </motion.div>

      {/* Steps */}
      <motion.div
        className="flex gap-4 mb-8"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
      >
        {steps.map((step, index) => {
          const Icon = step.icon;
          const isActive = index === currentStep;
          const isComplete = index < currentStep;

          return (
            <div
              key={step.id}
              className={`flex flex-col items-center gap-2 px-6 py-4 rounded-lg border transition-all duration-300 ${
                isActive
                  ? "border-primary/50 bg-primary/10 glow-cyan"
                  : isComplete
                  ? "border-secure-green/30 bg-secure-green/5"
                  : "border-border bg-card/30"
              }`}
            >
              <Icon
                size={24}
                className={
                  isActive
                    ? "text-primary"
                    : isComplete
                    ? "text-secure-green"
                    : "text-muted-foreground"
                }
              />
              <span
                className={`text-xs font-mono ${
                  isActive
                    ? "text-primary"
                    : isComplete
                    ? "text-secure-green"
                    : "text-muted-foreground"
                }`}
              >
                {step.label}
              </span>
            </div>
          );
        })}
      </motion.div>

      {/* Terminal */}
      <motion.div
        className="w-full max-w-2xl cyber-border rounded-lg overflow-hidden"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6 }}
      >
        <div className="flex items-center gap-2 px-4 py-2 bg-card/50 border-b border-border">
          <div className="w-3 h-3 rounded-full bg-destructive/80" />
          <div className="w-3 h-3 rounded-full bg-warning-amber/80" />
          <div className="w-3 h-3 rounded-full bg-secure-green/80" />
          <span className="ml-2 text-xs font-mono text-muted-foreground">
            sovereign_terminal_v2.0
          </span>
        </div>
        <div className="p-4 font-mono text-sm min-h-[120px] bg-card/30">
          {terminalText.map((line, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              className="text-terminal-green mb-1"
            >
              {line}
            </motion.div>
          ))}
          <span className="text-terminal-green typing-cursor">_</span>
        </div>
      </motion.div>

      {/* Status Indicators */}
      <motion.div
        className="flex gap-8 mt-8"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.8 }}
      >
        {[
          { icon: "🔐", label: "BIOMETRIC READY" },
          { icon: "🔒", label: "256-BIT ACTIVE" },
          { icon: "🌐", label: "NODE CONNECTED" },
        ].map((item, index) => (
          <div key={index} className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>{item.icon}</span>
            <span className="font-mono">{item.label}</span>
          </div>
        ))}
      </motion.div>
    </motion.div>
  );
};
