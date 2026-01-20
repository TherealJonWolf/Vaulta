import { useState } from "react";
import { motion } from "framer-motion";
import { Shield, Lock, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface MFAVerifyProps {
  factorId: string;
  onVerified: () => void;
  onCancel: () => void;
}

const MFAVerify = ({ factorId, onVerified, onCancel }: MFAVerifyProps) => {
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleVerify = async () => {
    if (code.length !== 6) return;

    setLoading(true);
    try {
      const { data: challengeData, error: challengeError } =
        await supabase.auth.mfa.challenge({ factorId });

      if (challengeError) throw challengeError;

      const { error: verifyError } = await supabase.auth.mfa.verify({
        factorId,
        challengeId: challengeData.id,
        code,
      });

      if (verifyError) throw verifyError;

      toast({
        title: "Verification Successful",
        description: "Welcome to your Sovereign Sector.",
      });

      onVerified();
    } catch (error) {
      console.error("MFA verify error:", error);
      toast({
        variant: "destructive",
        title: "Verification Failed",
        description: "Invalid code. Please try again.",
      });
      setCode("");
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
          Back to login
        </button>
      </div>

      <div className="flex-1 flex items-center justify-center p-6">
        <motion.div
          className="w-full max-w-md cyber-border rounded-2xl p-8"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="flex justify-center mb-8">
            <div className="p-4 rounded-xl border border-primary/30 bg-primary/10">
              <Shield size={40} className="text-primary" />
            </div>
          </div>

          <h1 className="font-display text-3xl font-bold text-center gradient-text mb-2">
            VERIFY IDENTITY
          </h1>
          <p className="text-center text-muted-foreground font-mono text-sm mb-8">
            // ENTER YOUR AUTHENTICATOR CODE //
          </p>

          <div className="space-y-6">
            <div className="p-4 rounded-xl bg-muted/30 border border-border">
              <p className="text-sm text-muted-foreground font-rajdhani">
                Open your authenticator app and enter the 6-digit code to
                complete the security verification.
              </p>
            </div>

            <div className="space-y-2">
              <Label className="font-rajdhani">Authentication Code</Label>
              <Input
                value={code}
                onChange={(e) =>
                  setCode(e.target.value.replace(/\D/g, "").slice(0, 6))
                }
                placeholder="000000"
                className="text-center text-2xl tracking-[0.5em] font-mono bg-card/50 border-border focus:border-primary"
                maxLength={6}
                autoFocus
              />
            </div>

            <Button
              onClick={handleVerify}
              className="w-full btn-gradient font-rajdhani font-bold tracking-wider text-primary-foreground"
              disabled={loading || code.length !== 6}
            >
              <Lock size={18} className="mr-2" />
              {loading ? "VERIFYING..." : "COMPLETE VERIFICATION"}
            </Button>
          </div>

          <div className="mt-8 pt-6 border-t border-border text-center">
            <p className="text-xs text-muted-foreground font-mono flex items-center justify-center gap-2">
              <Shield size={12} className="text-primary" />
              Multi-Factor Authentication Active
            </p>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default MFAVerify;
