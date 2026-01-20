import { useState, useEffect } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Shield, Eye, EyeOff, Lock, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import MFAVerify from "@/components/MFAVerify";

const Auth = () => {
  const [searchParams] = useSearchParams();
  const isSignup = searchParams.get("mode") === "signup";
  const [mode, setMode] = useState<"login" | "signup">(isSignup ? "signup" : "login");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mfaRequired, setMfaRequired] = useState(false);
  const [mfaFactorId, setMfaFactorId] = useState("");
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();

  useEffect(() => {
    if (user && !mfaRequired) {
      navigate("/vault");
    }
  }, [user, mfaRequired, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;
    
    setLoading(true);
    
    try {
      if (mode === "signup") {
        const redirectUrl = `${window.location.origin}/vault`;
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: redirectUrl },
        });
        
        if (error) throw error;
        
        toast({
          title: "Vault Initialized!",
          description: "Your sovereign identity has been created.",
        });
        navigate("/vault");
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (error) throw error;

        // Check if MFA is required
        const { data: factorsData } = await supabase.auth.mfa.listFactors();
        const verifiedFactors = factorsData?.totp?.filter(
          (f) => f.status === "verified"
        );

        if (verifiedFactors && verifiedFactors.length > 0) {
          // MFA is required
          setMfaFactorId(verifiedFactors[0].id);
          setMfaRequired(true);
        } else {
          toast({
            title: "Welcome back!",
            description: "Accessing your Sovereign Sector...",
          });
          navigate("/vault");
        }
      }
    } catch (error: any) {
      let message = "An unexpected error occurred.";
      
      if (error.message?.includes("User already registered")) {
        message = "This email is already registered. Please sign in instead.";
      } else if (error.message?.includes("Invalid login credentials")) {
        message = "Invalid email or password.";
      } else if (error.message) {
        message = error.message;
      }
      
      toast({
        variant: "destructive",
        title: mode === "login" ? "Access Denied" : "Registration Failed",
        description: message,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleMFACancel = async () => {
    await supabase.auth.signOut();
    setMfaRequired(false);
    setMfaFactorId("");
  };

  const handleMFAVerified = () => {
    setMfaRequired(false);
    navigate("/vault");
  };

  // Show MFA verification screen if required
  if (mfaRequired) {
    return (
      <MFAVerify
        factorId={mfaFactorId}
        onVerified={handleMFAVerified}
        onCancel={handleMFACancel}
      />
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
          <p className="text-center text-muted-foreground font-mono text-sm mb-8">
            // {mode === "login" ? "AUTHENTICATE TO ENTER" : "CREATE YOUR SOVEREIGN IDENTITY"} //
          </p>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="email" className="font-rajdhani">Email Address</Label>
              <Input 
                id="email" 
                type="email" 
                placeholder="your@email.com" 
                value={email} 
                onChange={(e) => setEmail(e.target.value)} 
                className="bg-card/50 border-border focus:border-primary" 
                required 
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="font-rajdhani">Password</Label>
              <div className="relative">
                <Input 
                  id="password" 
                  type={showPassword ? "text" : "password"} 
                  placeholder="••••••••" 
                  value={password} 
                  onChange={(e) => setPassword(e.target.value)} 
                  className="bg-card/50 border-border focus:border-primary pr-10" 
                  required 
                  minLength={6} 
                />
                <button 
                  type="button" 
                  onClick={() => setShowPassword(!showPassword)} 
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <Button 
              type="submit" 
              className="w-full btn-gradient font-rajdhani font-bold tracking-wider text-primary-foreground" 
              disabled={loading}
            >
              <Lock size={18} className="mr-2" />
              {loading ? "PROCESSING..." : mode === "login" ? "ACCESS VAULT" : "CREATE VAULT"}
            </Button>
          </form>

          <p className="text-center mt-6 text-muted-foreground font-rajdhani">
            {mode === "login" ? "No vault yet?" : "Already have a vault?"}{" "}
            <button 
              onClick={() => setMode(mode === "login" ? "signup" : "login")} 
              className="text-primary hover:text-primary/80 font-semibold"
            >
              {mode === "login" ? "Initialize Sovereign Identity" : "Access Vault"}
            </button>
          </p>

          {/* Security Badge */}
          <div className="mt-8 pt-6 border-t border-border text-center">
            <p className="text-xs text-muted-foreground font-mono flex items-center justify-center gap-2">
              <Shield size={12} className="text-primary" />
              256-bit AES Encryption • MFA Supported
            </p>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default Auth;
