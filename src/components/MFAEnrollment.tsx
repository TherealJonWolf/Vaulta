import { useState } from "react";
import { motion } from "framer-motion";
import { Shield, Copy, Check, Smartphone, Key } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface MFAEnrollmentProps {
  isOpen: boolean;
  onClose: () => void;
  onEnrollmentComplete: () => void;
}

const MFAEnrollment = ({ isOpen, onClose, onEnrollmentComplete }: MFAEnrollmentProps) => {
  const [step, setStep] = useState<"start" | "qr" | "verify">("start");
  const [factorId, setFactorId] = useState<string>("");
  const [qrCode, setQrCode] = useState<string>("");
  const [secret, setSecret] = useState<string>("");
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

      if (data) {
        setFactorId(data.id);
        setQrCode(data.totp.qr_code);
        setSecret(data.totp.secret);
        setStep("qr");
      }
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Enrollment Failed",
        description: error.message || "Failed to start MFA enrollment",
      });
    } finally {
      setLoading(false);
    }
  };

  const verifyAndEnroll = async () => {
    if (verifyCode.length !== 6) {
      toast({
        variant: "destructive",
        title: "Invalid Code",
        description: "Please enter a 6-digit verification code",
      });
      return;
    }

    setLoading(true);
    try {
      const { data: challengeData, error: challengeError } = await supabase.auth.mfa.challenge({
        factorId,
      });

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
        title: "MFA Enabled!",
        description: "Your account is now protected with two-factor authentication",
      });

      onEnrollmentComplete();
      handleClose();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Verification Failed",
        description: error.message || "Invalid verification code",
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

  const handleClose = () => {
    setStep("start");
    setFactorId("");
    setQrCode("");
    setSecret("");
    setVerifyCode("");
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="cyber-border bg-card max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display text-xl gradient-text flex items-center gap-2">
            <Shield size={24} />
            Enable Two-Factor Authentication
          </DialogTitle>
          <DialogDescription className="text-muted-foreground font-rajdhani">
            Add an extra layer of security to your vault
          </DialogDescription>
        </DialogHeader>

        {step === "start" && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6 py-4"
          >
            <div className="flex items-start gap-4 p-4 rounded-lg bg-primary/5 border border-primary/20">
              <Smartphone className="text-primary shrink-0 mt-1" size={24} />
              <div>
                <h4 className="font-rajdhani font-semibold text-foreground mb-1">
                  Authenticator App Required
                </h4>
                <p className="text-sm text-muted-foreground">
                  You'll need an authenticator app like Google Authenticator, Authy, or 1Password to complete setup.
                </p>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center gap-3 text-sm text-muted-foreground">
                <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center text-xs font-bold text-primary">1</div>
                <span>Scan QR code with your authenticator app</span>
              </div>
              <div className="flex items-center gap-3 text-sm text-muted-foreground">
                <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center text-xs font-bold text-primary">2</div>
                <span>Enter the 6-digit code from your app</span>
              </div>
              <div className="flex items-center gap-3 text-sm text-muted-foreground">
                <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center text-xs font-bold text-primary">3</div>
                <span>Your vault will be protected with MFA</span>
              </div>
            </div>

            <Button
              onClick={startEnrollment}
              disabled={loading}
              className="w-full btn-gradient font-rajdhani font-bold"
            >
              <Key size={18} className="mr-2" />
              {loading ? "Initializing..." : "Begin Setup"}
            </Button>
          </motion.div>
        )}

        {step === "qr" && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6 py-4"
          >
            <div className="text-center">
              <div className="inline-block p-4 bg-white rounded-xl mb-4">
                <img src={qrCode} alt="QR Code" className="w-48 h-48" />
              </div>
              <p className="text-sm text-muted-foreground font-rajdhani">
                Scan this QR code with your authenticator app
              </p>
            </div>

            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">
                Can't scan? Enter this code manually:
              </Label>
              <div className="flex gap-2">
                <Input
                  value={secret}
                  readOnly
                  className="font-mono text-xs bg-card/50"
                />
                <Button
                  variant="outline"
                  size="icon"
                  onClick={copySecret}
                  className="shrink-0"
                >
                  {copied ? <Check size={16} /> : <Copy size={16} />}
                </Button>
              </div>
            </div>

            <Button
              onClick={() => setStep("verify")}
              className="w-full btn-gradient font-rajdhani font-bold"
            >
              Continue to Verification
            </Button>
          </motion.div>
        )}

        {step === "verify" && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6 py-4"
          >
            <div className="text-center">
              <div className="w-16 h-16 mx-auto mb-4 rounded-xl bg-accent/10 border border-accent/30 flex items-center justify-center">
                <Key className="text-accent" size={32} />
              </div>
              <p className="text-muted-foreground font-rajdhani">
                Enter the 6-digit code from your authenticator app
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="verify-code" className="font-rajdhani">
                Verification Code
              </Label>
              <Input
                id="verify-code"
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                placeholder="000000"
                value={verifyCode}
                onChange={(e) => setVerifyCode(e.target.value.replace(/\D/g, ""))}
                className="text-center text-2xl font-mono tracking-[0.5em] bg-card/50"
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
                onClick={verifyAndEnroll}
                disabled={loading || verifyCode.length !== 6}
                className="flex-1 btn-gradient font-rajdhani font-bold"
              >
                {loading ? "Verifying..." : "Enable MFA"}
              </Button>
            </div>
          </motion.div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default MFAEnrollment;
