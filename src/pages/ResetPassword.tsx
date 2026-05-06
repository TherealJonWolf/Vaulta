import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Shield, Eye, EyeOff, Lock, ArrowLeft, KeyRound, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
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
  const [statusMsg, setStatusMsg] = useState<string>("Verifying your recovery link...");
  const [formError, setFormError] = useState<string>("");
  const [success, setSuccess] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    // Listen for PASSWORD_RECOVERY / SIGNED_IN events from Supabase
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" || (event === "SIGNED_IN" && session)) {
        setIsRecovery(true);
        setChecking(false);
      }
    });

    (async () => {
      try {
        const url = new URL(window.location.href);
        const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));

        // 1. Surface error from email link (e.g., expired/invalid)
        const errDesc = url.searchParams.get("error_description") || hashParams.get("error_description");
        if (errDesc) {
          toast({ variant: "destructive", title: "Recovery link error", description: errDesc });
          setStatusMsg(errDesc);
          setChecking(false);
          return;
        }

        // 2. PKCE flow: ?code=...
        const code = url.searchParams.get("code");
        if (code) {
          setStatusMsg("Validating secure recovery code...");
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) {
            toast({ variant: "destructive", title: "Recovery link invalid", description: error.message });
            setStatusMsg(error.message);
            setChecking(false);
            return;
          }
          // Clean URL
          window.history.replaceState({}, document.title, "/reset-password");
          setIsRecovery(true);
          setChecking(false);
          return;
        }

        // 3. Implicit flow: #access_token=...&type=recovery
        if (hashParams.get("type") === "recovery" && hashParams.get("access_token")) {
          setStatusMsg("Establishing recovery session...");
          const { error } = await supabase.auth.setSession({
            access_token: hashParams.get("access_token")!,
            refresh_token: hashParams.get("refresh_token") || "",
          });
          if (error) {
            toast({ variant: "destructive", title: "Recovery link invalid", description: error.message });
            setStatusMsg(error.message);
            setChecking(false);
            return;
          }
          window.history.replaceState({}, document.title, "/reset-password");
          setIsRecovery(true);
          setChecking(false);
          return;
        }

        // 4. Existing session (already exchanged via auth listener)
        const { data: { session } } = await supabase.auth.getSession();
        if (session) setIsRecovery(true);
        setChecking(false);
      } catch (e) {
        toast({ variant: "destructive", title: "Recovery error", description: (e as Error).message });
        setStatusMsg((e as Error).message);
        setChecking(false);
      }
    })();

    return () => subscription.unsubscribe();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");

    if (password !== confirmPassword) {
      setFormError("Passwords do not match.");
      toast({ variant: "destructive", title: "Mismatch", description: "Passwords do not match." });
      return;
    }
    if (password.length < 6) {
      setFormError("Password must be at least 6 characters.");
      toast({ variant: "destructive", title: "Too Short", description: "Password must be at least 6 characters." });
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });

      if (error) {
        setFormError(error.message);
        toast({ variant: "destructive", title: "Error", description: error.message });
        setLoading(false);
        return;
      }

      // Unlock account on successful password reset (NIST 800-53 AC-7)
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        await supabase.rpc('reset_failed_login', { p_user_id: session.user.id });
      }
      setSuccess(true);
      toast({ title: "Password Updated", description: "Redirecting to your vault..." });
      // Role-aware redirect: landlords/lenders with institutional membership go to dashboard
      let destination = "/vault";
      if (session?.user) {
        const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", session.user.id);
        const roleList = (roles || []).map((r: any) => r.role);
        if (roleList.includes("landlord") || roleList.includes("lender")) {
          const { data: membership } = await (supabase.from as any)("institutional_users")
            .select("institution_id").eq("user_id", session.user.id).maybeSingle();
          if (membership?.institution_id) destination = "/institutional/dashboard";
          else if (roleList.includes("landlord")) destination = "/landlord";
          else destination = "/lender";
        }
      }
      setTimeout(() => navigate(destination), 1500);
    } catch (err) {
      const msg = (err as Error).message || "Unexpected error. Please try again.";
      setFormError(msg);
      toast({ variant: "destructive", title: "Error", description: msg });
      setLoading(false);
    }
  };

  if (checking) {
    return (
      <div className="min-h-screen bg-background grid-bg flex flex-col items-center justify-center p-6">
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center">
          <Loader2 size={48} className="text-primary mx-auto mb-4 animate-spin" />
          <h1 className="font-display text-2xl font-bold gradient-text mb-2">VERIFYING RECOVERY TOKEN</h1>
          <p className="text-muted-foreground font-mono text-sm">{statusMsg}</p>
        </motion.div>
      </div>
    );
  }

  if (!isRecovery) {
    return (
      <div className="min-h-screen bg-background grid-bg flex flex-col items-center justify-center p-6">
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center max-w-md">
          <AlertCircle size={48} className="text-destructive mx-auto mb-4" />
          <h1 className="font-display text-2xl font-bold gradient-text mb-2">RECOVERY LINK UNAVAILABLE</h1>
          <p className="text-muted-foreground font-mono text-sm mb-6">{statusMsg !== "Verifying your recovery link..." ? statusMsg : "No valid recovery token was found in this URL. Please request a new password reset link from the login page."}</p>
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
              {success ? <CheckCircle2 size={40} className="text-primary" /> : <Shield size={40} className="text-primary" />}
            </div>
          </div>

          <h1 className="font-display text-3xl font-bold text-center gradient-text mb-2">
            {success ? "PASSWORD UPDATED" : "RESET CREDENTIALS"}
          </h1>
          <p className="text-center text-muted-foreground font-mono text-sm mb-8">
            {success ? "// REDIRECTING TO YOUR VAULT //" : "// SET NEW VAULT ACCESS PASSWORD //"}
          </p>

          {success && (
            <div className="flex items-center gap-2 p-3 rounded-md border border-primary/40 bg-primary/10 text-primary mb-4 text-sm font-mono">
              <CheckCircle2 size={16} />
              <span>Credentials reset successfully.</span>
            </div>
          )}

          {formError && !success && (
            <div className="flex items-start gap-2 p-3 rounded-md border border-destructive/40 bg-destructive/10 text-destructive mb-4 text-sm font-mono" role="alert">
              <AlertCircle size={16} className="mt-0.5 shrink-0" />
              <span>{formError}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="password" className="font-rajdhani">New Password</Label>
              <div className="relative">
                <Input id="password" type={showPassword ? "text" : "password"} placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} className="bg-card/50 border-border focus:border-primary pr-10" required minLength={6} disabled={loading || success} />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirm" className="font-rajdhani">Confirm Password</Label>
              <Input id="confirm" type="password" placeholder="••••••••" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className="bg-card/50 border-border focus:border-primary" required minLength={6} disabled={loading || success} />
            </div>

            <Button type="submit" className="w-full btn-gradient font-rajdhani font-bold tracking-wider text-primary-foreground" disabled={loading || success} aria-busy={loading}>
              {loading ? (
                <>
                  <Loader2 size={18} className="mr-2 animate-spin" />
                  UPDATING PASSWORD...
                </>
              ) : success ? (
                <>
                  <CheckCircle2 size={18} className="mr-2" />
                  PASSWORD UPDATED
                </>
              ) : (
                <>
                  <Lock size={18} className="mr-2" />
                  UPDATE PASSWORD
                </>
              )}
            </Button>

            {loading && (
              <p className="text-center text-xs font-mono text-muted-foreground" aria-live="polite">
                Securing your new credentials...
              </p>
            )}
          </form>
        </motion.div>
      </div>
    </div>
  );
};

export default ResetPassword;
