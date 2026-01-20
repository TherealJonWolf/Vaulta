import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Shield, Copy, CheckCircle2, X, Smartphone, Key } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface MFAEnrollProps {
  isOpen: boolean;
  onClose: () => void;
  onEnrollComplete: () => void;
}

const MFAEnroll = ({ isOpen, onClose, onEnrollComplete }: MFAEnrollProps) => {
  const [step, setStep] = useState<"intro" | "qr" | "verify">("intro");
  const [qrCode, setQrCode] = useState<string>("");
  const [secret, setSecret] = useState<string>("");
  const [factorId, setFactorId] = useState<string>("");
  const [verifyCode, setVerifyCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  const startEnrollment = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.mfa.enroll({
        factorType: "totp",
        friendlyName: "Authenticator App",
      });

      if (error) throw error;

      if (data.totp) {
        setQrCode(data.totp.qr_code);
        setSecret(data.totp.secret);
        setFactorId(data.id);
        setStep("qr");
      }
    } catch (error) {
      console.error("MFA enrollment error:", error);
      toast({
        variant: "destructive",
        title: "Enrollment Failed",
        description: "Unable to start MFA enrollment. Please try again.",
      });
    } finally {
      setLoading(false);
    }
  };

  const verifyAndActivate = async () => {
    if (verifyCode.length !== 6) return;

    setLoading(true);
    try {
      const { data: challengeData, error: challengeError } =
        await supabase.auth.mfa.challenge({ factorId });

      if (challengeError) throw challengeError;

      const { error: verifyError } = await supabase.auth.mfa.verify({
        factorId,
        challengeId: challengeData.id,
        code: verifyCode,
      });

      if (verifyError) throw verifyError;

      // Update profile to indicate MFA is enabled
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase
          .from("profiles")
          .update({ mfa_enabled: true })
          .eq("user_id", user.id);
      }

      toast({
        title: "MFA Activated!",
        description: "Your account is now protected with two-factor authentication.",
      });

      onEnrollComplete();
      onClose();
      resetState();
    } catch (error) {
      console.error("MFA verification error:", error);
      toast({
        variant: "destructive",
        title: "Verification Failed",
        description: "Invalid code. Please try again.",
      });
    } finally {
      setLoading(false);
    }
  };

  const copySecret = () => {
    navigator.clipboard.writeText(secret);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const resetState = () => {
    setStep("intro");
    setQrCode("");
    setSecret("");
    setFactorId("");
    setVerifyCode("");
    setLoading(false);
  };

  if (!isOpen) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-6"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        className="w-full max-w-md cyber-border rounded-2xl bg-card p-8"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-primary/10 border border-primary/30 flex items-center justify-center">
              <Shield className="text-primary" size={24} />
            </div>
            <div>
              <h2 className="font-display text-xl font-bold gradient-text">
                Enable MFA
              </h2>
              <p className="text-sm text-muted-foreground font-mono">
                Two-Factor Authentication
              </p>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X size={20} />
          </Button>
        </div>

        {/* Step: Intro */}
        {step === "intro" && (
          <div className="space-y-6">
            <div className="p-4 rounded-xl bg-muted/30 border border-border space-y-4">
              <div className="flex items-start gap-3">
                <Smartphone className="text-accent mt-0.5" size={20} />
                <div>
                  <h3 className="font-display font-bold text-foreground">
                    Authenticator App Required
                  </h3>
                  <p className="text-sm text-muted-foreground font-rajdhani">
                    You'll need an authenticator app like Google Authenticator,
                    Authy, or 1Password.
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Key className="text-primary mt-0.5" size={20} />
                <div>
                  <h3 className="font-display font-bold text-foreground">
                    Military-Grade Security
                  </h3>
                  <p className="text-sm text-muted-foreground font-rajdhani">
                    Time-based one-time passwords add an extra layer of
                    protection to your Sovereign Sector.
                  </p>
                </div>
              </div>
            </div>

            <Button
              onClick={startEnrollment}
              className="w-full btn-gradient font-rajdhani font-bold text-primary-foreground"
              disabled={loading}
            >
              {loading ? "Initializing..." : "Begin Setup"}
            </Button>
          </div>
        )}

        {/* Step: QR Code */}
        {step === "qr" && (
          <div className="space-y-6">
            <div className="text-center">
              <p className="text-sm text-muted-foreground font-rajdhani mb-4">
                Scan this QR code with your authenticator app
              </p>
              <div className="inline-block p-4 bg-white rounded-xl">
                <img
                  src={qrCode}
                  alt="MFA QR Code"
                  className="w-48 h-48"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label className="font-rajdhani text-muted-foreground">
                Or enter this code manually:
              </Label>
              <div className="flex gap-2">
                <Input
                  value={secret}
                  readOnly
                  className="font-mono text-xs bg-muted/50"
                />
                <Button
                  variant="outline"
                  size="icon"
                  onClick={copySecret}
                  className="shrink-0"
                >
                  {copied ? (
                    <CheckCircle2 size={16} className="text-green-500" />
                  ) : (
                    <Copy size={16} />
                  )}
                </Button>
              </div>
            </div>

            <Button
              onClick={() => setStep("verify")}
              className="w-full btn-gradient font-rajdhani font-bold text-primary-foreground"
            >
              I've Added the Code
            </Button>
          </div>
        )}

        {/* Step: Verify */}
        {step === "verify" && (
          <div className="space-y-6">
            <div className="text-center">
              <p className="text-sm text-muted-foreground font-rajdhani">
                Enter the 6-digit code from your authenticator app
              </p>
            </div>

            <div className="space-y-2">
              <Label className="font-rajdhani">Verification Code</Label>
              <Input
                value={verifyCode}
                onChange={(e) =>
                  setVerifyCode(e.target.value.replace(/\D/g, "").slice(0, 6))
                }
                placeholder="000000"
                className="text-center text-2xl tracking-[0.5em] font-mono bg-muted/50"
                maxLength={6}
              />
            </div>

            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={() => setStep("qr")}
                className="flex-1"
              >
                Back
              </Button>
              <Button
                onClick={verifyAndActivate}
                className="flex-1 btn-gradient font-rajdhani font-bold text-primary-foreground"
                disabled={loading || verifyCode.length !== 6}
              >
                {loading ? "Verifying..." : "Activate MFA"}
              </Button>
            </div>
          </div>
        )}

        {/* Security Note */}
        <div className="mt-6 pt-4 border-t border-border">
          <p className="text-xs text-muted-foreground font-mono flex items-center gap-2">
            <Shield size={12} className="text-primary" />
            NIST 800-53 Compliant Authentication
          </p>
        </div>
      </motion.div>
    </motion.div>
  );
};

export default MFAEnroll;
