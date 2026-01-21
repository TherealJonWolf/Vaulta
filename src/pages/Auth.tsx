import { useState, useEffect } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Shield, Eye, EyeOff, Lock, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import MFAVerification from "@/components/MFAVerification";

const Auth = () => {
  const [searchParams] = useSearchParams();
  const isSignup = searchParams.get("mode") === "signup";
  const [mode, setMode] = useState<"login" | "signup">(isSignup ? "signup" : "login");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showMFAVerification, setShowMFAVerification] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user, mfaRequired, currentLevel, signIn, signUp, checkMFAStatus } = useAuth();

  useEffect(() => {
    // Only navigate if user is authenticated AND MFA is not required
    if (user && !mfaRequired && currentLevel !== "aal1") {
      navigate("/vault");
    }
  }, [user, mfaRequired, currentLevel, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;
    
    setLoading(true);
    
    try {
      if (mode === "login") {
        const { error, mfaRequired } = await signIn(email, password);
        
        if (error) {
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
          navigate("/vault");
        }
      } else {
        const { error } = await signUp(email, password);
        
        if (error) {
          toast({
            variant: "destructive",
            title: "Registration Failed",
            description: error.message,
          });
        } else {
          toast({
            title: "Vault Initialized!",
            description: "Your identity has been secured.",
          });
          navigate("/vault");
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
    navigate("/vault");
  };

  const handleMFACancel = async () => {
    setShowMFAVerification(false);
    // Sign out since MFA was cancelled
    const { signOut } = await import("@/integrations/supabase/client").then(m => ({ signOut: m.supabase.auth.signOut.bind(m.supabase.auth) }));
    await signOut();
  };

  if (showMFAVerification) {
    return <MFAVerification onVerified={handleMFAVerified} onCancel={handleMFACancel} />;
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
          <p className="text-center text-muted-foreground font-mono text-sm mb-8">
            // {mode === "login" ? "AUTHENTICATE TO ENTER" : "CREATE YOUR SOVEREIGN IDENTITY"} //
          </p>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="email" className="font-rajdhani">Email Address</Label>
              <Input id="email" type="email" placeholder="your@email.com" value={email} onChange={(e) => setEmail(e.target.value)} className="bg-card/50 border-border focus:border-primary" required />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="font-rajdhani">Password</Label>
              <div className="relative">
                <Input id="password" type={showPassword ? "text" : "password"} placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} className="bg-card/50 border-border focus:border-primary pr-10" required minLength={6} />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <Button type="submit" className="w-full btn-gradient font-rajdhani font-bold tracking-wider text-primary-foreground" disabled={loading}>
              <Lock size={18} className="mr-2" />
              {loading ? "PROCESSING..." : mode === "login" ? "ACCESS VAULT" : "CREATE VAULT"}
            </Button>
          </form>

          <p className="text-center mt-6 text-muted-foreground font-rajdhani">
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
