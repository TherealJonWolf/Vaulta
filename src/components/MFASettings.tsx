import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Shield, ShieldCheck, ShieldOff, Trash2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import MFAEnroll from "./MFAEnroll";

interface Factor {
  id: string;
  friendly_name?: string;
  factor_type: string;
  status: string;
  created_at: string;
}

const MFASettings = () => {
  const [factors, setFactors] = useState<Factor[]>([]);
  const [loading, setLoading] = useState(true);
  const [enrollOpen, setEnrollOpen] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchFactors();
  }, []);

  const fetchFactors = async () => {
    try {
      const { data, error } = await supabase.auth.mfa.listFactors();
      if (error) throw error;
      setFactors(data.totp || []);
    } catch (error) {
      console.error("Error fetching MFA factors:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleUnenroll = async (factorId: string) => {
    try {
      const { error } = await supabase.auth.mfa.unenroll({ factorId });
      if (error) throw error;

      // Update profile
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase
          .from("profiles")
          .update({ mfa_enabled: false })
          .eq("user_id", user.id);
      }

      setFactors((prev) => prev.filter((f) => f.id !== factorId));
      toast({
        title: "MFA Removed",
        description: "Two-factor authentication has been disabled.",
      });
    } catch (error) {
      console.error("Unenroll error:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Unable to remove MFA. Please try again.",
      });
    }
  };

  const verifiedFactors = factors.filter((f) => f.status === "verified");
  const hasMFA = verifiedFactors.length > 0;

  if (loading) {
    return (
      <div className="cyber-border rounded-xl p-6 animate-pulse">
        <div className="h-6 bg-muted rounded w-1/3 mb-4" />
        <div className="h-4 bg-muted rounded w-2/3" />
      </div>
    );
  }

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="cyber-border rounded-xl p-6"
      >
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div
              className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                hasMFA
                  ? "bg-green-500/10 border border-green-500/30"
                  : "bg-yellow-500/10 border border-yellow-500/30"
              }`}
            >
              {hasMFA ? (
                <ShieldCheck className="text-green-500" size={24} />
              ) : (
                <ShieldOff className="text-yellow-500" size={24} />
              )}
            </div>
            <div>
              <h3 className="font-display font-bold text-foreground">
                Two-Factor Authentication
              </h3>
              <p className="text-sm text-muted-foreground font-rajdhani">
                {hasMFA
                  ? "Your account is protected with MFA"
                  : "Add an extra layer of security"}
              </p>
            </div>
          </div>

          {!hasMFA && (
            <Button
              onClick={() => setEnrollOpen(true)}
              className="btn-gradient font-rajdhani font-bold text-primary-foreground"
            >
              <Plus size={18} className="mr-2" />
              Enable MFA
            </Button>
          )}
        </div>

        {hasMFA && (
          <div className="space-y-3">
            {verifiedFactors.map((factor) => (
              <div
                key={factor.id}
                className="flex items-center justify-between p-4 rounded-xl bg-muted/30 border border-border"
              >
                <div className="flex items-center gap-3">
                  <Shield className="text-primary" size={20} />
                  <div>
                    <p className="font-display font-bold text-foreground">
                      {factor.friendly_name || "Authenticator App"}
                    </p>
                    <p className="text-xs text-muted-foreground font-mono">
                      Added{" "}
                      {new Date(factor.created_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-destructive hover:bg-destructive/10"
                  onClick={() => handleUnenroll(factor.id)}
                >
                  <Trash2 size={18} />
                </Button>
              </div>
            ))}
          </div>
        )}

        <div className="mt-6 pt-4 border-t border-border">
          <p className="text-xs text-muted-foreground font-mono flex items-center gap-2">
            <Shield size={12} className="text-primary" />
            NIST 800-53 compliant multi-factor authentication
          </p>
        </div>
      </motion.div>

      <MFAEnroll
        isOpen={enrollOpen}
        onClose={() => setEnrollOpen(false)}
        onEnrollComplete={fetchFactors}
      />
    </>
  );
};

export default MFASettings;
