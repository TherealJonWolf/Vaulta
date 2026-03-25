import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Shield, Upload, Bot, Building2, TrendingUp, Fingerprint, Share2, ChevronRight, ChevronLeft, X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface TourStep {
  icon: React.ReactNode;
  title: string;
  description: string;
  detail: string;
}

const TOUR_STEPS: TourStep[] = [
  {
    icon: <Shield size={32} className="text-primary" />,
    title: "Your Sovereign Sector",
    description: "This is your encrypted vault — a secure, private space where only you control access.",
    detail: "All documents are encrypted before they leave your device using AES-256 encryption with a passphrase only you know.",
  },
  {
    icon: <Upload size={32} className="text-primary" />,
    title: "Upload Documents",
    description: "Add pay stubs, bank statements, tax returns, and ID documents to build your verified profile.",
    detail: "Each document goes through a 9-layer verification pipeline including fraud detection, duplicate scanning, and AI analysis.",
  },
  {
    icon: <Fingerprint size={32} className="text-secure-green" />,
    title: "Verify Your Identity",
    description: "Complete government ID verification with liveness detection to strengthen your trust score.",
    detail: "Powered by Veriff — a bank-grade identity verification provider used by financial institutions worldwide.",
  },
  {
    icon: <TrendingUp size={32} className="text-primary" />,
    title: "Build Your Trust Score",
    description: "As you add verified documents, Vaulta calculates a trust score that institutions can review.",
    detail: "Your score reflects document consistency, verification history, and behavioral patterns — not just volume.",
  },
  {
    icon: <Share2 size={32} className="text-accent" />,
    title: "Share With Institutions",
    description: "Generate secure, time-limited links to share your verified profile with landlords or lenders.",
    detail: "You control who sees your data and for how long. Links expire automatically, and you can revoke access at any time.",
  },
  {
    icon: <Bot size={32} className="text-accent" />,
    title: "AI Oracle Assistant",
    description: "Get 24/7 guidance on housing applications, document requirements, and your trust profile.",
    detail: "The AI Oracle understands your vault contents and can help you prepare for applications.",
  },
  {
    icon: <Building2 size={32} className="text-accent" />,
    title: "Institution Connect",
    description: "Link directly to banks, credit unions, and government agencies to auto-import verified records.",
    detail: "Premium feature — securely pull statements and records directly from supported institutions.",
  },
];

const STORAGE_KEY = "vaulta_onboarding_complete";

interface Props {
  onComplete: () => void;
}

const OnboardingTour = ({ onComplete }: Props) => {
  const [step, setStep] = useState(0);
  const [direction, setDirection] = useState(1);

  const currentStep = TOUR_STEPS[step];
  const isLast = step === TOUR_STEPS.length - 1;

  const handleNext = () => {
    if (isLast) {
      localStorage.setItem(STORAGE_KEY, "true");
      onComplete();
    } else {
      setDirection(1);
      setStep((s) => s + 1);
    }
  };

  const handlePrev = () => {
    setDirection(-1);
    setStep((s) => Math.max(0, s - 1));
  };

  const handleSkip = () => {
    localStorage.setItem(STORAGE_KEY, "true");
    onComplete();
  };

  return (
    <div className="fixed inset-0 z-[100] bg-background/95 backdrop-blur-sm flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-lg cyber-border rounded-2xl p-8 bg-card relative"
      >
        <button
          onClick={handleSkip}
          className="absolute top-4 right-4 text-muted-foreground hover:text-foreground transition-colors"
        >
          <X size={20} />
        </button>

        {/* Progress dots */}
        <div className="flex justify-center gap-1.5 mb-8">
          {TOUR_STEPS.map((_, i) => (
            <div
              key={i}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                i === step ? "w-6 bg-primary" : i < step ? "w-1.5 bg-primary/50" : "w-1.5 bg-border"
              }`}
            />
          ))}
        </div>

        <AnimatePresence mode="wait" custom={direction}>
          <motion.div
            key={step}
            custom={direction}
            initial={{ opacity: 0, x: direction * 60 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -direction * 60 }}
            transition={{ duration: 0.25 }}
            className="text-center"
          >
            <div className="w-16 h-16 mx-auto mb-6 rounded-xl border border-primary/30 bg-primary/10 flex items-center justify-center">
              {currentStep.icon}
            </div>
            <h2 className="font-display text-2xl font-bold gradient-text mb-3">
              {currentStep.title}
            </h2>
            <p className="text-foreground font-rajdhani text-base mb-3">
              {currentStep.description}
            </p>
            <p className="text-muted-foreground font-mono text-xs leading-relaxed">
              {currentStep.detail}
            </p>
          </motion.div>
        </AnimatePresence>

        <div className="flex items-center justify-between mt-8">
          <Button
            variant="ghost"
            onClick={handlePrev}
            disabled={step === 0}
            className="font-rajdhani"
          >
            <ChevronLeft size={16} className="mr-1" />
            Back
          </Button>

          <span className="text-xs font-mono text-muted-foreground">
            {step + 1} / {TOUR_STEPS.length}
          </span>

          <Button onClick={handleNext} className="btn-gradient font-rajdhani font-bold text-primary-foreground">
            {isLast ? "Enter Vault" : "Next"}
            {!isLast && <ChevronRight size={16} className="ml-1" />}
          </Button>
        </div>

        <button
          onClick={handleSkip}
          className="block mx-auto mt-4 text-xs text-muted-foreground hover:text-foreground font-mono transition-colors"
        >
          Skip tour
        </button>
      </motion.div>
    </div>
  );
};

export { STORAGE_KEY as ONBOARDING_STORAGE_KEY };
export default OnboardingTour;
