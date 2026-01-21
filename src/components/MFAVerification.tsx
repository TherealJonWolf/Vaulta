import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Shield, Key, ArrowLeft, LifeBuoy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { hashRecoveryCode } from "@/lib/crypto";

interface MFAVerificationProps {
  onVerified: () => void;
  onCancel: () => void;
}

const MFAVerification = ({ onVerified, onCancel }: MFAVerificationProps) => {
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [factorId, setFactorId] = useState<string>("");
  const [useRecoveryCode, setUseRecoveryCode] = useState(false);
  const [recoveryCode, setRecoveryCode] = useState("");
  const { toast } = useToast();

  useEffect(() => {
    const getFactors = async () => {
      const { data, error } = await supabase.auth.mfa.listFactors();
      if (!error && data?.totp?.[0]) {
        setFactorId(data.totp[0].id);
      }
    };
    getFactors();
  }, []);

  const handleVerify = async () => {
    if (code.length !== 6) {
      toast({
        variant: "destructive",
        title: "Invalid Code",
        description: "Please enter a 6-digit verification code",
      });
      return;
    }

    if (!factorId) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "MFA factor not found",
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
        code,
      });

      if (verifyError) throw verifyError;

      onVerified();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Verification Failed",
        description: error.message || "Invalid verification code",
      });
      setCode("");
    } finally {
      setLoading(false);
    }
  };

  const handleRecoveryCodeVerify = async () => {
    const normalizedCode = recoveryCode.replace(/\s/g, "").toUpperCase();
    if (normalizedCode.length < 10) {
      toast({
        variant: "destructive",
        title: "Invalid Code",
        description: "Please enter a valid recovery code",
      });
      return;
    }

    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const codeHash = await hashRecoveryCode(normalizedCode);

      // Call the verify function
      const { data, error } = await supabase.rpc("verify_recovery_code", {
        p_user_id: user.id,
        p_code_hash: codeHash,
      });

      if (error) throw error;

      if (data) {
        toast({
          title: "Recovery Code Accepted",
          description: "One-time code used. Consider regenerating your recovery codes.",
        });
        onVerified();
      } else {
        toast({
          variant: "destructive",
          title: "Invalid Recovery Code",
          description: "This code is invalid or has already been used",
        });
        setRecoveryCode("");
      }
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Verification Failed",
        description: error.message || "Failed to verify recovery code",
      });
      setRecoveryCode("");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background grid-bg flex flex-col">
      <div className="p-6">
        <button
          onClick={onCancel}
          className="inline-flex items-center gap-2 text-muted-foreground hover:text-primary transition-colors font-mono text-sm"
        >
          <ArrowLeft size={16} />
          Cancel verification
        </button>
      </div>

      <div className="flex-1 flex items-center justify-center p-6">
        <motion.div
          className="w-full max-w-md cyber-border rounded-2xl p-8"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="flex justify-center mb-8">
            <div className="p-4 rounded-xl border border-accent/30 bg-accent/10">
              <Shield size={40} className="text-accent" />
            </div>
          </div>

          <h1 className="font-display text-3xl font-bold text-center gradient-text mb-2">
            {useRecoveryCode ? "RECOVERY CODE" : "MFA VERIFICATION"}
          </h1>
          <p className="text-center text-muted-foreground font-mono text-sm mb-8">
            // {useRecoveryCode ? "ENTER YOUR BACKUP CODE" : "ENTER YOUR AUTHENTICATOR CODE"} //
          </p>

          {useRecoveryCode ? (
            <div className="space-y-6">
              <div className="text-center">
                <div className="w-16 h-16 mx-auto mb-4 rounded-xl bg-accent/10 border border-accent/30 flex items-center justify-center">
                  <LifeBuoy className="text-accent" size={32} />
                </div>
                <p className="text-muted-foreground font-rajdhani text-sm">
                  Enter one of your saved recovery codes
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="recovery-code" className="font-rajdhani">
                  Recovery Code
                </Label>
                <Input
                  id="recovery-code"
                  type="text"
                  placeholder="XXXXX-XXXXX"
                  value={recoveryCode}
                  onChange={(e) => setRecoveryCode(e.target.value.toUpperCase())}
                  onKeyDown={(e) => e.key === "Enter" && handleRecoveryCodeVerify()}
                  className="text-center text-xl font-mono tracking-widest bg-card/50 border-border focus:border-primary"
                  autoFocus
                />
              </div>

              <Button
                onClick={handleRecoveryCodeVerify}
                disabled={loading || recoveryCode.length < 10}
                className="w-full btn-gradient font-rajdhani font-bold tracking-wider text-primary-foreground"
              >
                {loading ? "VERIFYING..." : "USE RECOVERY CODE"}
              </Button>

              <button
                onClick={() => {
                  setUseRecoveryCode(false);
                  setRecoveryCode("");
                }}
                className="w-full text-center text-sm text-muted-foreground hover:text-primary transition-colors font-rajdhani"
              >
                Use authenticator app instead
              </button>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="text-center">
                <div className="w-16 h-16 mx-auto mb-4 rounded-xl bg-primary/10 border border-primary/30 flex items-center justify-center">
                  <Key className="text-primary" size={32} />
                </div>
                <p className="text-muted-foreground font-rajdhani text-sm">
                  Open your authenticator app and enter the 6-digit code
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="mfa-code" className="font-rajdhani">
                  Verification Code
                </Label>
                <Input
                  id="mfa-code"
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={6}
                  placeholder="000000"
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                  onKeyDown={(e) => e.key === "Enter" && handleVerify()}
                  className="text-center text-2xl font-mono tracking-[0.5em] bg-card/50 border-border focus:border-primary"
                  autoFocus
                />
              </div>

              <Button
                onClick={handleVerify}
                disabled={loading || code.length !== 6}
                className="w-full btn-gradient font-rajdhani font-bold tracking-wider text-primary-foreground"
              >
                {loading ? "VERIFYING..." : "VERIFY & ACCESS VAULT"}
              </Button>

              <button
                onClick={() => {
                  setUseRecoveryCode(true);
                  setCode("");
                }}
                className="w-full text-center text-sm text-muted-foreground hover:text-primary transition-colors font-rajdhani"
              >
                Lost access? Use a recovery code
              </button>
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
};

export default MFAVerification;
