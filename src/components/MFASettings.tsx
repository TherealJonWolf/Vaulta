import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Shield, ShieldCheck, ShieldOff, Settings, RefreshCw, Key } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import MFAEnrollment from "./MFAEnrollment";
import RecoveryCodesDisplay from "./RecoveryCodesDisplay";
import { generateRecoveryCodes, hashRecoveryCode } from "@/lib/crypto";

interface MFASettingsProps {
  isOpen: boolean;
  onClose: () => void;
}

const MFASettings = ({ isOpen, onClose }: MFASettingsProps) => {
  const [mfaEnabled, setMfaEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [enrollmentOpen, setEnrollmentOpen] = useState(false);
  const [disableConfirmOpen, setDisableConfirmOpen] = useState(false);
  const [disabling, setDisabling] = useState(false);
  const [regenerateConfirmOpen, setRegenerateConfirmOpen] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [newRecoveryCodes, setNewRecoveryCodes] = useState<string[]>([]);
  const [showRecoveryCodes, setShowRecoveryCodes] = useState(false);
  const [remainingCodes, setRemainingCodes] = useState<number>(0);
  const { toast } = useToast();

  const checkMFAStatus = async () => {
    try {
      const { data, error } = await supabase.auth.mfa.listFactors();
      if (!error && data?.totp?.length > 0) {
        // Check if any factor is verified
        const hasVerifiedFactor = data.totp.some(f => f.status === "verified");
        setMfaEnabled(hasVerifiedFactor);
        
        if (hasVerifiedFactor) {
          // Check remaining recovery codes
          const { data: { user } } = await supabase.auth.getUser();
          if (user) {
            const { count } = await supabase
              .from("mfa_recovery_codes")
              .select("*", { count: "exact", head: true })
              .eq("user_id", user.id)
              .eq("used", false);
            setRemainingCodes(count || 0);
          }
        }
      } else {
        setMfaEnabled(false);
      }
    } catch (error) {
      console.error("Error checking MFA status:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      checkMFAStatus();
    }
  }, [isOpen]);

  const handleDisableMFA = async () => {
    setDisabling(true);
    try {
      const { data } = await supabase.auth.mfa.listFactors();
      if (data?.totp?.[0]) {
        const { error } = await supabase.auth.mfa.unenroll({
          factorId: data.totp[0].id,
        });

        if (error) throw error;

        // Update profile and delete recovery codes
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          await supabase
            .from("profiles")
            .update({ mfa_enabled: false })
            .eq("user_id", user.id);
          
          await supabase
            .from("mfa_recovery_codes")
            .delete()
            .eq("user_id", user.id);
        }

        setMfaEnabled(false);
        setRemainingCodes(0);
        toast({
          title: "MFA Disabled",
          description: "Two-factor authentication has been removed from your account",
        });
      }
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to disable MFA",
      });
    } finally {
      setDisabling(false);
      setDisableConfirmOpen(false);
    }
  };

  const handleRegenerateRecoveryCodes = async () => {
    setRegenerating(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Generate new codes
      const codes = generateRecoveryCodes(8);
      
      // Delete old codes
      await supabase
        .from("mfa_recovery_codes")
        .delete()
        .eq("user_id", user.id);

      // Store new hashed codes
      const hashedCodes = await Promise.all(
        codes.map(async (code) => ({
          user_id: user.id,
          code_hash: await hashRecoveryCode(code),
        }))
      );

      await supabase.from("mfa_recovery_codes").insert(hashedCodes);

      setNewRecoveryCodes(codes);
      setShowRecoveryCodes(true);
      setRemainingCodes(8);
      
      toast({
        title: "Recovery Codes Regenerated",
        description: "Save your new codes before continuing",
      });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to regenerate recovery codes",
      });
    } finally {
      setRegenerating(false);
      setRegenerateConfirmOpen(false);
    }
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="cyber-border bg-card max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display text-xl gradient-text flex items-center gap-2">
              <Settings size={24} />
              Security Settings
            </DialogTitle>
            <DialogDescription className="text-muted-foreground font-rajdhani">
              Manage your vault's security configuration
            </DialogDescription>
          </DialogHeader>

          <div className="py-4">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Shield className="animate-pulse text-primary" size={32} />
              </div>
            ) : (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-6"
              >
                <div className="p-4 rounded-xl border border-border bg-card/50">
                  <div className="flex items-start gap-4">
                    <div className={`p-3 rounded-lg ${mfaEnabled ? "bg-green-500/10 border border-green-500/30" : "bg-muted"}`}>
                      {mfaEnabled ? (
                        <ShieldCheck className="text-green-500" size={24} />
                      ) : (
                        <ShieldOff className="text-muted-foreground" size={24} />
                      )}
                    </div>
                    <div className="flex-1">
                      <h4 className="font-rajdhani font-semibold text-foreground mb-1">
                        Two-Factor Authentication
                      </h4>
                      <p className="text-sm text-muted-foreground mb-4">
                        {mfaEnabled
                          ? "Your account is protected with an authenticator app"
                          : "Add an extra layer of security to your vault"}
                      </p>
                      {mfaEnabled ? (
                        <div className="flex flex-wrap gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setRegenerateConfirmOpen(true)}
                            className="font-rajdhani"
                          >
                            <RefreshCw size={14} className="mr-1" />
                            Regenerate Codes ({remainingCodes} left)
                          </Button>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => setDisableConfirmOpen(true)}
                            className="font-rajdhani"
                          >
                            Disable MFA
                          </Button>
                        </div>
                      ) : (
                        <Button
                          size="sm"
                          onClick={() => setEnrollmentOpen(true)}
                          className="btn-gradient font-rajdhani"
                        >
                          Enable MFA
                        </Button>
                      )}
                    </div>
                  </div>
                </div>

                <div className="p-4 rounded-xl border border-primary/20 bg-primary/5">
                  <div className="flex items-center gap-3 mb-2">
                    <Shield className="text-primary" size={20} />
                    <h4 className="font-rajdhani font-semibold text-foreground">
                      Security Status
                    </h4>
                  </div>
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">256-bit AES Encryption</span>
                      <span className="text-green-500 font-mono text-xs">ACTIVE</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Zero-Knowledge Architecture</span>
                      <span className="text-green-500 font-mono text-xs">ACTIVE</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Two-Factor Authentication</span>
                      <span className={`font-mono text-xs ${mfaEnabled ? "text-green-500" : "text-yellow-500"}`}>
                        {mfaEnabled ? "ACTIVE" : "DISABLED"}
                      </span>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <MFAEnrollment
        isOpen={enrollmentOpen}
        onClose={() => setEnrollmentOpen(false)}
        onEnrollmentComplete={() => {
          checkMFAStatus();
        }}
      />

      <AlertDialog open={disableConfirmOpen} onOpenChange={setDisableConfirmOpen}>
        <AlertDialogContent className="cyber-border bg-card">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-display text-destructive">
              Disable Two-Factor Authentication?
            </AlertDialogTitle>
            <AlertDialogDescription className="font-rajdhani">
              This will remove the extra layer of security from your vault and delete all recovery codes. You can re-enable it anytime.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="font-rajdhani">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDisableMFA}
              disabled={disabling}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90 font-rajdhani"
            >
              {disabling ? "Disabling..." : "Disable MFA"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={regenerateConfirmOpen} onOpenChange={setRegenerateConfirmOpen}>
        <AlertDialogContent className="cyber-border bg-card">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-display flex items-center gap-2">
              <Key size={20} />
              Regenerate Recovery Codes?
            </AlertDialogTitle>
            <AlertDialogDescription className="font-rajdhani">
              This will invalidate all existing recovery codes and generate new ones. Make sure to save the new codes.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="font-rajdhani">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRegenerateRecoveryCodes}
              disabled={regenerating}
              className="btn-gradient font-rajdhani"
            >
              {regenerating ? "Generating..." : "Generate New Codes"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <RecoveryCodesDisplay
        isOpen={showRecoveryCodes}
        onClose={() => setShowRecoveryCodes(false)}
        codes={newRecoveryCodes}
        onConfirm={() => setShowRecoveryCodes(false)}
      />
    </>
  );
};

export default MFASettings;
