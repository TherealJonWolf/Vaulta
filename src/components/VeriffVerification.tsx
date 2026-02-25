import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Shield,
  ShieldCheck,
  ShieldAlert,
  UserCheck,
  ExternalLink,
  RefreshCw,
  Loader2,
  ScanFace,
  Fingerprint,
  AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";

interface VeriffVerificationProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type VeriffStatus = "idle" | "creating" | "awaiting" | "polling" | "approved" | "declined" | "resubmission_requested" | "expired" | "error";

const statusConfig: Record<string, { icon: typeof Shield; label: string; color: string; description: string }> = {
  idle: { icon: Shield, label: "Not Started", color: "text-muted-foreground", description: "Begin identity verification to increase your trust score." },
  creating: { icon: Loader2, label: "Creating Session", color: "text-primary", description: "Preparing your secure verification session..." },
  awaiting: { icon: ScanFace, label: "Awaiting Verification", color: "text-warning-amber", description: "Complete the verification in the opened window." },
  polling: { icon: RefreshCw, label: "Checking Status", color: "text-primary", description: "Retrieving your verification results..." },
  approved: { icon: ShieldCheck, label: "Verified", color: "text-secure-green", description: "Your identity has been verified successfully." },
  declined: { icon: ShieldAlert, label: "Declined", color: "text-destructive", description: "Verification was not successful. You may try again." },
  resubmission_requested: { icon: AlertTriangle, label: "Resubmission Required", color: "text-warning-amber", description: "Additional information is needed. Please try again." },
  expired: { icon: AlertTriangle, label: "Expired", color: "text-muted-foreground", description: "Your session expired. Start a new verification." },
  error: { icon: ShieldAlert, label: "Error", color: "text-destructive", description: "Something went wrong. Please try again later." },
};

const VeriffVerification = ({ open, onOpenChange }: VeriffVerificationProps) => {
  const [status, setStatus] = useState<VeriffStatus>("idle");
  const [sessionUrl, setSessionUrl] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [decision, setDecision] = useState<string | null>(null);
  const { user } = useAuth();
  const { toast } = useToast();

  // Check for existing session on open
  useEffect(() => {
    if (open && user) {
      checkExistingSession();
    }
  }, [open, user]);

  const checkExistingSession = async () => {
    try {
      const { data, error } = await supabase.functions.invoke("veriff-session", {
        body: null,
        method: "GET",
        headers: {},
      });

      // Use query params approach
      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/veriff-session?action=latest`,
        {
          headers: {
            Authorization: `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
        }
      );

      if (response.ok) {
        const result = await response.json();
        if (result.session) {
          const s = result.session;
          if (s.status === "approved" || s.decision === "9001") {
            setStatus("approved");
            setDecision(s.decision);
          } else if (s.status === "declined" || s.decision === "9102") {
            setStatus("declined");
          } else if (s.status === "resubmission_requested" || s.decision === "9103") {
            setStatus("resubmission_requested");
          } else if (s.status === "expired" || s.decision === "9104") {
            setStatus("expired");
          } else if (s.status === "created" || s.status === "started") {
            setStatus("awaiting");
            setSessionUrl(s.verification_url);
            setSessionId(s.session_id);
          }
        }
      }
    } catch (err) {
      console.error("Error checking existing session:", err);
    }
  };

  const createSession = async () => {
    if (!user) return;
    setStatus("creating");

    try {
      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/veriff-session?action=create`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            person: {
              firstName: user.user_metadata?.full_name?.split(" ")[0] || undefined,
              lastName: user.user_metadata?.full_name?.split(" ").slice(1).join(" ") || undefined,
            },
          }),
        }
      );

      if (!response.ok) {
        throw new Error("Failed to create session");
      }

      const data = await response.json();
      setSessionUrl(data.url);
      setSessionId(data.sessionId);
      setStatus("awaiting");

      // Open Veriff in new window
      window.open(data.url, "_blank", "noopener,noreferrer");

      toast({
        title: "Verification Session Created",
        description: "Complete the verification in the new window, then check your status here.",
      });
    } catch (err) {
      console.error("Error creating Veriff session:", err);
      setStatus("error");
      toast({
        variant: "destructive",
        title: "Session Creation Failed",
        description: "Could not create verification session. Please try again.",
      });
    }
  };

  const checkStatus = useCallback(async () => {
    if (!sessionId || !user) return;
    setStatus("polling");

    try {
      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/veriff-session?action=status&sessionId=${sessionId}`,
        {
          headers: {
            Authorization: `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
        }
      );

      if (!response.ok) throw new Error("Status check failed");

      const data = await response.json();

      if (data.decision === "9001" || data.status === "approved") {
        setStatus("approved");
        setDecision(data.decision);
        toast({ title: "✅ Identity Verified", description: "Your identity has been confirmed." });
      } else if (data.decision === "9102" || data.status === "declined") {
        setStatus("declined");
      } else if (data.decision === "9103" || data.status === "resubmission_requested") {
        setStatus("resubmission_requested");
      } else if (data.decision === "9104" || data.status === "expired") {
        setStatus("expired");
      } else {
        setStatus("awaiting");
        toast({ title: "Still Pending", description: "Verification is still in progress. Check back shortly." });
      }
    } catch (err) {
      console.error("Error checking status:", err);
      setStatus("awaiting");
    }
  }, [sessionId, user, toast]);

  const resetSession = () => {
    setStatus("idle");
    setSessionUrl(null);
    setSessionId(null);
    setDecision(null);
  };

  const config = statusConfig[status] || statusConfig.idle;
  const StatusIcon = config.icon;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md border-border bg-card">
        <DialogHeader>
          <DialogTitle className="font-display text-xl gradient-text flex items-center gap-2">
            <Fingerprint className="text-primary" size={22} />
            Government ID Verification
          </DialogTitle>
          <DialogDescription className="text-muted-foreground font-rajdhani">
            Verify your identity with a government-issued ID and liveness check powered by Veriff.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Status Display */}
          <motion.div
            key={status}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="cyber-border rounded-xl p-6 text-center"
          >
            <div className={`w-16 h-16 mx-auto mb-4 rounded-full border-2 border-current flex items-center justify-center ${config.color}`}>
              <StatusIcon
                size={28}
                className={status === "creating" || status === "polling" ? "animate-spin" : ""}
              />
            </div>
            <h3 className={`font-display text-lg font-bold mb-1 ${config.color}`}>
              {config.label}
            </h3>
            <p className="text-sm text-muted-foreground font-rajdhani">
              {config.description}
            </p>
          </motion.div>

          {/* Verification Steps Info */}
          {status === "idle" && (
            <div className="space-y-3">
              <p className="text-xs font-mono text-muted-foreground uppercase tracking-wider">
                What to expect:
              </p>
              {[
                { icon: ScanFace, label: "Photo of your government-issued ID" },
                { icon: UserCheck, label: "Selfie with liveness detection" },
                { icon: ShieldCheck, label: "Automated authenticity verification" },
              ].map((step, i) => (
                <div key={i} className="flex items-center gap-3 p-2 rounded-lg bg-muted/30">
                  <step.icon size={16} className="text-primary shrink-0" />
                  <span className="text-sm text-foreground font-rajdhani">{step.label}</span>
                </div>
              ))}
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex flex-col gap-3">
            {(status === "idle" || status === "expired" || status === "declined" || status === "resubmission_requested") && (
              <Button onClick={createSession} className="btn-gradient text-primary-foreground font-display w-full">
                <Fingerprint className="mr-2" size={16} />
                {status === "idle" ? "Start Verification" : "Try Again"}
              </Button>
            )}

            {status === "awaiting" && (
              <>
                {sessionUrl && (
                  <Button
                    variant="outline"
                    onClick={() => window.open(sessionUrl, "_blank", "noopener,noreferrer")}
                    className="w-full border-primary/30"
                  >
                    <ExternalLink className="mr-2" size={16} />
                    Open Verification Window
                  </Button>
                )}
                <Button onClick={checkStatus} className="btn-gradient text-primary-foreground font-display w-full">
                  <RefreshCw className="mr-2" size={16} />
                  Check Verification Status
                </Button>
              </>
            )}

            {status === "approved" && (
              <div className="p-3 rounded-lg border border-secure-green/30 bg-secure-green/5 text-center">
                <p className="text-sm font-mono text-secure-green">
                  ✓ Identity verified — Trust score boosted
                </p>
              </div>
            )}

            {(status === "approved" || status === "error") && (
              <Button variant="ghost" onClick={() => onOpenChange(false)} className="w-full text-muted-foreground">
                Close
              </Button>
            )}
          </div>

          {/* Security Note */}
          <p className="text-[10px] text-muted-foreground text-center font-mono leading-relaxed">
            Powered by Veriff — 190+ countries supported. Your data is processed securely and never stored on our servers.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default VeriffVerification;
