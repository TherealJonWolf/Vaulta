import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Shield, Eye, EyeOff, Lock, ArrowLeft, KeyRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

const ResetPassword = () => {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isRecovery, setIsRecovery] = useState(false);
  const [checking, setChecking] = useState(true);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    // Check URL hash for recovery token
    const hash = window.location.hash;
    const params = new URLSearchParams(hash.replace("#", ""));
    if (params.get("type") === "recovery" || hash.includes("type=recovery")) {
      setIsRecovery(true);
    }

    // Listen for PASSWORD_RECOVERY event from Supabase
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY") {
        setIsRecovery(true);
        setChecking(false);
      } else if (event === "SIGNED_IN" && session) {
        // User arrived via recovery link and was auto-signed in
        setIsRecovery(true);
        setChecking(false);
      }
    });

    // Also check if there's already an active session (user may have already been signed in by the recovery link)
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setIsRecovery(true);
      }
      setChecking(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (password !== confirmPassword) {
      toast({ variant: "destructive", title: "Mismatch", description: "Passwords do not match." });
      return;
    }
    if (password.length < 6) {
      toast({ variant: "destructive", title: "Too Short", description: "Password must be at least 6 characters." });
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });

    if (error) {
      toast({ variant: "destructive", title: "Error", description: error.message });
    } else {
      // Unlock account on successful password reset (NIST 800-53 AC-7)
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        await supabase.rpc('reset_failed_login', { p_user_id: session.user.id });
      }
      toast({ title: "Password Updated", description: "Your vault access credentials have been reset." });
      navigate("/vault");
    }
    setLoading(false);
  };

  if (checking) {
    return (
      <div className="min-h-screen bg-background grid-bg flex flex-col items-center justify-center p-6">
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center">
          <KeyRound size={48} className="text-primary mx-auto mb-4 animate-pulse" />
          <h1 className="font-display text-2xl font-bold gradient-text mb-2">VERIFYING RECOVERY TOKEN</h1>
          <p className="text-muted-foreground font-mono text-sm">Please wait...</p>
        </motion.div>
      </div>
    );
  }

  if (!isRecovery) {
    return (
      <div className="min-h-screen bg-background grid-bg flex flex-col items-center justify-center p-6">
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center">
          <KeyRound size={48} className="text-primary mx-auto mb-4" />
          <h1 className="font-display text-2xl font-bold gradient-text mb-2">NO RECOVERY TOKEN FOUND</h1>
          <p className="text-muted-foreground font-mono text-sm mb-6">Please request a new password reset link from the login page.</p>
          <Link to="/auth" className="text-primary hover:text-primary/80 font-rajdhani font-semibold">
            ← Return to login
          </Link>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background grid-bg flex flex-col">
      <div className="p-6">
        <Link to="/auth" className="inline-flex items-center gap-2 text-muted-foreground hover:text-primary transition-colors font-mono text-sm">
          <ArrowLeft size={16} />
          Back to login
        </Link>
      </div>

      <div className="flex-1 flex items-center justify-center p-6">
        <motion.div className="w-full max-w-md cyber-border rounded-2xl p-8" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <div className="flex justify-center mb-8">
            <div className="p-4 rounded-xl border border-primary/30 bg-primary/10">
              <Shield size={40} className="text-primary" />
            </div>
          </div>

          <h1 className="font-display text-3xl font-bold text-center gradient-text mb-2">RESET CREDENTIALS</h1>
          <p className="text-center text-muted-foreground font-mono text-sm mb-8">// SET NEW VAULT ACCESS PASSWORD //</p>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="password" className="font-rajdhani">New Password</Label>
              <div className="relative">
                <Input id="password" type={showPassword ? "text" : "password"} placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} className="bg-card/50 border-border focus:border-primary pr-10" required minLength={6} />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirm" className="font-rajdhani">Confirm Password</Label>
              <Input id="confirm" type="password" placeholder="••••••••" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className="bg-card/50 border-border focus:border-primary" required minLength={6} />
            </div>

            <Button type="submit" className="w-full btn-gradient font-rajdhani font-bold tracking-wider text-primary-foreground" disabled={loading}>
              <Lock size={18} className="mr-2" />
              {loading ? "UPDATING..." : "UPDATE PASSWORD"}
            </Button>
          </form>
        </motion.div>
      </div>
    </div>
  );
};

export default ResetPassword;
