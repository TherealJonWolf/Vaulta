import { useState } from "react";
import { motion } from "framer-motion";
import { Copy, Check, Download, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

interface RecoveryCodesDisplayProps {
  isOpen: boolean;
  onClose: () => void;
  codes: string[];
  onConfirm: () => void;
}

const RecoveryCodesDisplay = ({ isOpen, onClose, codes, onConfirm }: RecoveryCodesDisplayProps) => {
  const [copied, setCopied] = useState(false);
  const [confirmed, setConfirmed] = useState(false);

  const copyToClipboard = () => {
    const text = codes.join("\n");
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const downloadCodes = () => {
    const text = `VAULTA MFA RECOVERY CODES
========================
Generated: ${new Date().toISOString()}

Keep these codes safe! Each code can only be used once.

${codes.join("\n")}

WARNING: Store these codes in a secure location.
If you lose access to your authenticator app, these are
the only way to regain access to your vault.`;

    const blob = new Blob([text], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "vaulta-recovery-codes.txt";
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleConfirm = () => {
    setConfirmed(true);
    onConfirm();
  };

  const handleClose = () => {
    if (confirmed) {
      onClose();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="cyber-border bg-card max-w-lg" onPointerDownOutside={(e) => !confirmed && e.preventDefault()}>
        <DialogHeader>
          <DialogTitle className="font-display text-xl gradient-text">
            Save Your Recovery Codes
          </DialogTitle>
          <DialogDescription className="text-muted-foreground font-rajdhani">
            These codes will help you regain access if you lose your authenticator
          </DialogDescription>
        </DialogHeader>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-4 py-4"
        >
          <div className="p-4 rounded-lg bg-destructive/10 border border-destructive/30 flex items-start gap-3">
            <AlertTriangle className="text-destructive shrink-0 mt-0.5" size={20} />
            <div className="text-sm">
              <p className="font-rajdhani font-semibold text-destructive mb-1">
                Save these codes now!
              </p>
              <p className="text-muted-foreground">
                You won't be able to see them again. Each code can only be used once.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 p-4 bg-card/50 rounded-lg border border-border">
            {codes.map((code, index) => (
              <div
                key={index}
                className="font-mono text-sm text-foreground bg-background/50 px-3 py-2 rounded border border-border/50"
              >
                {code}
              </div>
            ))}
          </div>

          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={copyToClipboard}
              className="flex-1 font-rajdhani"
            >
              {copied ? <Check size={16} className="mr-2" /> : <Copy size={16} className="mr-2" />}
              {copied ? "Copied!" : "Copy All"}
            </Button>
            <Button
              variant="outline"
              onClick={downloadCodes}
              className="flex-1 font-rajdhani"
            >
              <Download size={16} className="mr-2" />
              Download
            </Button>
          </div>

          <Button
            onClick={handleConfirm}
            disabled={confirmed}
            className="w-full btn-gradient font-rajdhani font-bold"
          >
            {confirmed ? "Codes Saved!" : "I've Saved These Codes"}
          </Button>
        </motion.div>
      </DialogContent>
    </Dialog>
  );
};

export default RecoveryCodesDisplay;
