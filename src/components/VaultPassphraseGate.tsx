import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import { Shield, Lock, KeyRound, Eye, EyeOff, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";

interface VaultPassphraseGateProps {
  hasPassphrase: boolean | null;
  onCreatePassphrase: (passphrase: string) => Promise<void>;
  onUnlock: (passphrase: string) => Promise<boolean>;
  loading?: boolean;
}

const getPassphraseStrength = (passphrase: string) => {
  if (!passphrase) return { score: 0, label: "", color: "" };
  let score = 0;
  if (passphrase.length >= 8) score++;
  if (passphrase.length >= 12) score++;
  if (passphrase.length >= 16) score++;
  if (/[a-z]/.test(passphrase) && /[A-Z]/.test(passphrase)) score++;
  if (/\d/.test(passphrase)) score++;
  if (/[^a-zA-Z0-9]/.test(passphrase)) score++;
  if (/\s/.test(passphrase) && passphrase.split(/\s+/).length >= 3) score++;

  if (score <= 2) return { score, label: "Weak", color: "hsl(var(--destructive))" };
  if (score <= 4) return { score, label: "Fair", color: "hsl(var(--warning-amber))" };
  if (score <= 5) return { score, label: "Strong", color: "hsl(var(--secure-green))" };
  return { score, label: "Excellent", color: "hsl(var(--primary))" };
};

const MAX_SCORE = 7;

const VaultPassphraseGate = ({ hasPassphrase, onCreatePassphrase, onUnlock, loading }: VaultPassphraseGateProps) => {
  const [passphrase, setPassphrase] = useState("");
  const [confirmPassphrase, setConfirmPassphrase] = useState("");
  const [showPassphrase, setShowPassphrase] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const { toast } = useToast();

  const strength = useMemo(() => getPassphraseStrength(passphrase), [passphrase]);

  const handleCreate = async () => {
    if (passphrase.length < 8) {
      setError("Passphrase must be at least 8 characters");
      return;
    }
    if (passphrase !== confirmPassphrase) {
      setError("Passphrases do not match");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      await onCreatePassphrase(passphrase);
      toast({ title: "Vault Secured", description: "Your end-to-end encryption passphrase has been set." });
    } catch (err) {
      setError("Failed to set passphrase. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleUnlock = async () => {
    if (!passphrase) return;
    setSubmitting(true);
    setError("");
    try {
      const success = await onUnlock(passphrase);
      if (!success) {
        setError("Incorrect passphrase. Please try again.");
      }
    } catch {
      setError("Failed to unlock vault.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading || hasPassphrase === null) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="text-center">
          <Shield className="mx-auto text-primary animate-pulse" size={48} />
          <p className="mt-4 text-muted-foreground font-mono">Checking encryption status...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[60vh] flex items-center justify-center px-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md"
      >
        <div className="cyber-border rounded-2xl p-8 bg-card/80 backdrop-blur">
          <div className="text-center mb-6">
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-primary/10 border border-primary/30 flex items-center justify-center">
              <KeyRound className="text-primary" size={32} />
            </div>
            <h2 className="font-display text-2xl font-bold gradient-text mb-2">
              {hasPassphrase ? "Unlock Your Vault" : "Set Your Vault Passphrase"}
            </h2>
            <p className="text-sm text-muted-foreground font-rajdhani">
              {hasPassphrase
                ? "Enter your passphrase to decrypt your documents"
                : "Create a passphrase to enable end-to-end encryption. This passphrase never leaves your device."}
            </p>
          </div>

          {!hasPassphrase && (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-warning-amber/10 border border-warning-amber/20 mb-4">
              <AlertTriangle size={16} className="text-warning-amber mt-0.5 flex-shrink-0" />
              <p className="text-xs text-muted-foreground">
                <strong className="text-foreground">Important:</strong> If you forget this passphrase, your encrypted documents cannot be recovered. Write it down and store it safely.
              </p>
            </div>
          )}

          <div className="space-y-4">
            <div className="relative">
              <Lock size={16} className="absolute left-3 top-3 text-muted-foreground" />
              <Input
                type={showPassphrase ? "text" : "password"}
                placeholder={hasPassphrase ? "Enter vault passphrase" : "Create vault passphrase (min 8 chars)"}
                value={passphrase}
                onChange={(e) => { setPassphrase(e.target.value); setError(""); }}
                className="pl-9 pr-10 font-mono"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    if (hasPassphrase) handleUnlock();
                    else if (confirmPassphrase) handleCreate();
                  }
                }}
              />
              <button
                type="button"
                onClick={() => setShowPassphrase(!showPassphrase)}
                className="absolute right-3 top-3 text-muted-foreground hover:text-foreground"
              >
                {showPassphrase ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>

            {/* Strength Meter — only during creation */}
            {!hasPassphrase && passphrase.length > 0 && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                className="space-y-1.5"
              >
                <div className="flex gap-1 h-1.5">
                  {[...Array(4)].map((_, i) => {
                    const segmentThreshold = ((i + 1) / 4) * MAX_SCORE;
                    const filled = strength.score >= segmentThreshold;
                    return (
                      <motion.div
                        key={i}
                        className="flex-1 rounded-full"
                        initial={{ scaleX: 0 }}
                        animate={{
                          scaleX: 1,
                          backgroundColor: filled ? strength.color : "hsl(var(--muted))",
                        }}
                        transition={{ delay: i * 0.05, duration: 0.2 }}
                        style={{ originX: 0 }}
                      />
                    );
                  })}
                </div>
                <div className="flex justify-between items-center">
                  <span
                    className="text-xs font-mono font-semibold"
                    style={{ color: strength.color }}
                  >
                    {strength.label}
                  </span>
                  <span className="text-xs text-muted-foreground font-mono">
                    {passphrase.length < 8
                      ? `${8 - passphrase.length} more chars needed`
                      : passphrase.length < 16
                        ? "Try 16+ chars or a multi-word phrase"
                        : "Great length!"}
                  </span>
                </div>
              </motion.div>
            )}

            {!hasPassphrase && (
              <div className="relative">
                <Lock size={16} className="absolute left-3 top-3 text-muted-foreground" />
                <Input
                  type={showPassphrase ? "text" : "password"}
                  placeholder="Confirm passphrase"
                  value={confirmPassphrase}
                  onChange={(e) => { setConfirmPassphrase(e.target.value); setError(""); }}
                  className="pl-9 font-mono"
                  onKeyDown={(e) => { if (e.key === "Enter") handleCreate(); }}
                />
              </div>
            )}

            {error && (
              <p className="text-xs text-destructive font-mono">{error}</p>
            )}

            <Button
              onClick={hasPassphrase ? handleUnlock : handleCreate}
              disabled={submitting || !passphrase || (!hasPassphrase && !confirmPassphrase)}
              className="w-full btn-gradient font-rajdhani font-bold tracking-wider text-primary-foreground hover:opacity-90 transition-opacity"
            >
              {submitting ? "Processing..." : hasPassphrase ? "Unlock Vault" : "Set Passphrase & Enter Vault"}
            </Button>
          </div>

          <div className="mt-6 pt-4 border-t border-border">
            <div className="flex items-center gap-2 justify-center">
              <div className="w-1.5 h-1.5 rounded-full bg-secure-green animate-pulse" />
              <span className="text-xs font-mono text-muted-foreground">
                AES-256-GCM • PBKDF2 • Zero-Knowledge
              </span>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default VaultPassphraseGate;
