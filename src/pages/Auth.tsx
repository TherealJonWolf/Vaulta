import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Shield, Eye, EyeOff, Lock, ArrowLeft, Building2, User, Landmark } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import MFAVerification from "@/components/MFAVerification";
import PasswordStrengthMeter from "@/components/PasswordStrengthMeter";
import { isPasswordAcceptable } from "@/lib/passwordStrength";

type SignupRole = "user" | "landlord";

const Auth = () => {
  const [searchParams] = useSearchParams();
  const isSignup = searchParams.get("mode") === "signup";
  const initialRole = searchParams.get("role") as SignupRole | null;
  const [mode, setMode] = useState<"login" | "signup">(isSignup ? "signup" : "login");
  const [signupRole, setSignupRole] = useState<SignupRole>(initialRole === "landlord" ? "landlord" : "user");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showMFAVerification, setShowMFAVerification] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotLoading, setForgotLoading] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user, mfaRequired, currentLevel, signIn, signUp, checkMFAStatus } = useAuth();

  // Only redirect if user has a valid server-side session
  useEffect(() => {
    const checkExisting = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      // Validate session is still valid server-side
      const { data: { user: validUser }, error } = await supabase.auth.getUser();
      if (error || !validUser) {
        // Stale/invalid session — clear it locally without hitting server
        await supabase.auth.signOut({ scope: 'local' });
        return;
      }

      if (!mfaRequired) {
        roleRedirect(validUser.id);
      }
    };
    checkExisting();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const roleRedirect = async (userId: string) => {
    const { data } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);
    const roles = (data || []).map((r: any) => r.role);

    // Only redirect to institutional if user is a landlord with existing membership
    // Do NOT use ensure_institutional_access here — it auto-creates institutions
    if (roles.includes("landlord")) {
      const { data: membership } = await (supabase.from as any)('institutional_users')
        .select('institution_id')
        .eq('user_id', userId)
        .maybeSingle();

      if (membership?.institution_id) {
        navigate("/institutional/dashboard");
        return;
      }
    }

    navigate("/vault");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;
    
    setLoading(true);
    
    try {
      if (mode === "signup") {
        const check = isPasswordAcceptable(password);
        if (!check.ok) {
          toast({ variant: "destructive", title: "Weak Password", description: check.reason });
          setLoading(false);
          return;
        }
      }
      if (mode === "login") {
        const { error, mfaRequired, accountLocked } = await signIn(email, password);
        
        if (accountLocked) {
          setShowForgotPassword(true);
          toast({
            variant: "destructive",
            title: "Account Locked",
            description: "Too many failed attempts. Please reset your password.",
          });
        } else if (error) {
          toast({
            variant: "destructive",
            title: "Access Denied",
            description: error.message,
          });
        } else if (mfaRequired) {
          setShowMFAVerification(true);
          toast({
            title: "MFA Required",
            description: "Please enter your authenticator code",
          });
        } else {
          toast({
            title: "Welcome back!",
            description: "Accessing your Sovereign Sector...",
          });
          // Role-based redirect after successful login
          const { data: session } = await supabase.auth.getSession();
          if (session?.session?.user) {
            await roleRedirect(session.session.user.id);
          } else {
            navigate("/vault");
          }
        }
      } else {
        const { error } = await signUp(email, password, signupRole);
        
        if (error) {
          toast({
            variant: "destructive",
            title: "Registration Failed",
            description: error.message,
          });
        } else {
          const destination = signupRole === "landlord" ? "/institutional/dashboard" : "/vault";
          toast({
            title: signupRole === "landlord" ? "Dashboard Initialized!" : "Vault Initialized!",
            description: signupRole === "landlord" 
              ? "Your compliance-ready landlord portal is ready."
              : "Your identity has been secured.",
          });
          navigate(destination);
        }
      }
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "An unexpected error occurred.",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleMFAVerified = async () => {
    setShowMFAVerification(false);
    await checkMFAStatus();
    toast({
      title: "Verification Complete",
      description: "Accessing your Sovereign Sector...",
    });
    const { data: session } = await supabase.auth.getSession();
    if (session?.session?.user) {
      await roleRedirect(session.session.user.id);
    } else {
      navigate("/vault");
    }
  };

  const handleMFACancel = async () => {
    setShowMFAVerification(false);
    const { signOut } = await import("@/integrations/supabase/client").then(m => ({ signOut: m.supabase.auth.signOut.bind(m.supabase.auth) }));
    await signOut();
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!forgotEmail) return;
    setForgotLoading(true);
    const { error } = await (await import("@/integrations/supabase/client")).supabase.auth.resetPasswordForEmail(forgotEmail, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (error) {
      toast({ variant: "destructive", title: "Error", description: error.message });
    } else {
      toast({ title: "Reset Link Sent", description: "Check your email for the password reset link." });
      setShowForgotPassword(false);
    }
    setForgotLoading(false);
  };

  if (showMFAVerification) {
    return <MFAVerification onVerified={handleMFAVerified} onCancel={handleMFACancel} />;
  }

  if (showForgotPassword) {
    return (
      <div className="min-h-screen bg-background grid-bg flex flex-col">
        <div className="p-6">
          <button onClick={() => setShowForgotPassword(false)} className="inline-flex items-center gap-2 text-muted-foreground hover:text-primary transition-colors font-mono text-sm">
            <ArrowLeft size={16} />
            Back to login
          </button>
        </div>
        <div className="flex-1 flex items-center justify-center p-6">
          <motion.div className="w-full max-w-md cyber-border rounded-2xl p-8" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <div className="flex justify-center mb-8">
              <div className="p-4 rounded-xl border border-primary/30 bg-primary/10">
                <Shield size={40} className="text-primary" />
              </div>
            </div>
            <h1 className="font-display text-3xl font-bold text-center gradient-text mb-2">RESET ACCESS</h1>
            <p className="text-center text-muted-foreground font-mono text-sm mb-8">// ENTER YOUR EMAIL TO RECEIVE A RESET LINK //</p>
            <form onSubmit={handleForgotPassword} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="forgot-email" className="font-rajdhani">Email Address</Label>
                <Input id="forgot-email" type="email" placeholder="your@email.com" value={forgotEmail} onChange={(e) => setForgotEmail(e.target.value)} className="bg-card/50 border-border focus:border-primary" required />
              </div>
              <Button type="submit" className="w-full btn-gradient font-rajdhani font-bold tracking-wider text-primary-foreground" disabled={forgotLoading}>
                <Lock size={18} className="mr-2" />
                {forgotLoading ? "SENDING..." : "SEND RESET LINK"}
              </Button>
            </form>
          </motion.div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background grid-bg flex flex-col">
      <div className="p-6">
        <Link to="/" className="inline-flex items-center gap-2 text-muted-foreground hover:text-primary transition-colors font-mono text-sm">
          <ArrowLeft size={16} />
          Back to home
        </Link>
      </div>

      <div className="flex-1 flex items-center justify-center p-6">
        <motion.div className="w-full max-w-md cyber-border rounded-2xl p-8" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <div className="flex justify-center mb-8">
            <div className="p-4 rounded-xl border border-primary/30 bg-primary/10">
              <Shield size={40} className="text-primary" />
            </div>
          </div>

          <h1 className="font-display text-3xl font-bold text-center gradient-text mb-2">
            {mode === "login" ? "VAULT ACCESS" : "INITIALIZE VAULT"}
          </h1>
          <p className="text-center text-muted-foreground font-mono text-sm mb-6">
            // {mode === "login" ? "AUTHENTICATE TO ENTER" : "CREATE YOUR SOVEREIGN IDENTITY"} //
          </p>

          {/* Role selector tabs — only shown in signup mode */}
          {mode === "signup" && (
            <div className="mb-6">
              <p className="text-xs text-muted-foreground font-mono text-center mb-3 uppercase tracking-widest">Select Account Type</p>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setSignupRole("user")}
                  className={`flex flex-col items-center gap-1.5 p-3 rounded-lg border-2 transition-all duration-200 ${
                    signupRole === "user"
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border bg-card/30 text-muted-foreground hover:border-primary/40"
                  }`}
                >
                  <User size={20} />
                  <span className="font-rajdhani font-semibold text-sm">Applicant</span>
                  <span className="text-[10px] font-mono opacity-70 leading-tight text-center">
                    Tenants & Individuals
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setSignupRole("landlord")}
                  className={`flex flex-col items-center gap-1.5 p-3 rounded-lg border-2 transition-all duration-200 ${
                    signupRole === "landlord"
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border bg-card/30 text-muted-foreground hover:border-primary/40"
                  }`}
                >
                  <Building2 size={20} />
                  <span className="font-rajdhani font-semibold text-sm">Landlord / Lender</span>
                  <span className="text-[10px] font-mono opacity-70 leading-tight text-center">
                    Property Managers & Banks
                  </span>
                </button>
              </div>

              {/* Compliance badge for landlord/lender */}
              {signupRole === "landlord" && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  className="mt-3 p-2.5 rounded-lg border border-primary/20 bg-primary/5"
                >
                  <div className="flex items-center gap-2 mb-1.5">
                    <Landmark size={14} className="text-primary" />
                    <span className="text-xs font-rajdhani font-semibold text-primary">Enterprise-Grade Compliance</span>
                  </div>
                  <p className="text-[10px] font-mono text-muted-foreground leading-relaxed">
                    SOC 2 · SOX · GDPR · FCRA · FedRAMP · GLBA · ISO 27001 · CCPA
                    <br />
                    End-to-end encrypted · Zero-knowledge architecture
                  </p>
                </motion.div>
              )}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="email" className="font-rajdhani">Email Address</Label>
              <Input id="email" type="email" placeholder="your@email.com" value={email} onChange={(e) => setEmail(e.target.value)} className="bg-card/50 border-border focus:border-primary" required />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="font-rajdhani">Password</Label>
              <div className="relative">
                <Input id="password" type={showPassword ? "text" : "password"} placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} className="bg-card/50 border-border focus:border-primary pr-10" required minLength={8} />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              {mode === "signup" && <PasswordStrengthMeter password={password} />}
            </div>

            <Button type="submit" className="w-full btn-gradient font-rajdhani font-bold tracking-wider text-primary-foreground" disabled={loading}>
              <Lock size={18} className="mr-2" />
              {loading 
                ? "PROCESSING..." 
                : mode === "login" 
                  ? "ACCESS VAULT" 
                  : signupRole === "landlord" 
                    ? "INITIALIZE DASHBOARD" 
                    : "CREATE VAULT"
              }
            </Button>
          </form>

          {mode === "login" && (
            <p className="text-center mt-4">
              <button onClick={() => setShowForgotPassword(true)} className="text-muted-foreground hover:text-primary font-rajdhani text-sm transition-colors">
                Forgot your password?
              </button>
            </p>
          )}

          <p className="text-center mt-4 text-muted-foreground font-rajdhani">
            {mode === "login" ? "No vault yet?" : "Already have a vault?"}{" "}
            <button onClick={() => setMode(mode === "login" ? "signup" : "login")} className="text-primary hover:text-primary/80 font-semibold">
              {mode === "login" ? "Initialize Sovereign Identity" : "Access Vault"}
            </button>
          </p>
        </motion.div>
      </div>
    </div>
  );
};

export default Auth;
