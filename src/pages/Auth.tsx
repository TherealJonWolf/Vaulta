import { useState } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Shield, Eye, EyeOff, Lock, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";

const Auth = () => {
  const [searchParams] = useSearchParams();
  const isSignup = searchParams.get("mode") === "signup";
  const [mode, setMode] = useState<"login" | "signup">(isSignup ? "signup" : "login");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    // Placeholder - will be replaced with actual auth
    toast({
      title: mode === "login" ? "Welcome back!" : "Account created!",
      description: "Authentication system requires Cloud setup. Demo mode active.",
    });
    
    setTimeout(() => {
      setLoading(false);
      navigate("/vault");
    }, 1000);
  };

  return (
    <div className="min-h-screen bg-background grid-bg flex flex-col">
      {/* Back Link */}
      <div className="p-6">
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-muted-foreground hover:text-primary transition-colors font-mono text-sm"
        >
          <ArrowLeft size={16} />
          Back to home
        </Link>
      </div>

      <div className="flex-1 flex items-center justify-center p-6">
        <motion.div
          className="w-full max-w-md cyber-border rounded-2xl p-8"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          {/* Logo */}
          <div className="flex justify-center mb-8">
            <div className="p-4 rounded-xl border border-primary/30 bg-primary/10">
              <Shield size={40} className="text-primary" />
            </div>
          </div>

          {/* Title */}
          <h1 className="font-display text-3xl font-bold text-center gradient-text mb-2">
            {mode === "login" ? "VAULT ACCESS" : "INITIALIZE VAULT"}
          </h1>
          <p className="text-center text-muted-foreground font-mono text-sm mb-8">
            // {mode === "login" ? "AUTHENTICATE TO ENTER" : "CREATE YOUR SOVEREIGN IDENTITY"} //
          </p>

          {/* Form */}
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

          {/* Toggle Mode */}
          <p className="text-center mt-6 text-muted-foreground font-rajdhani">
            {mode === "login" ? "No vault yet?" : "Already have a vault?"}{" "}
            <button
              onClick={() => setMode(mode === "login" ? "signup" : "login")}
              className="text-primary hover:text-primary/80 font-semibold"
            >
              {mode === "login" ? "Initialize Sovereign Identity" : "Access Vault"}
            </button>
          </p>
        </motion.div>
      </div>

      {/* Footer */}
      <div className="p-6 flex justify-center">
        <div className="flex items-center gap-2 px-4 py-2 rounded-full border border-border bg-card/30 text-xs font-mono text-muted-foreground">
          <Lock size={12} className="text-primary" />
          System Settings
        </div>
      </div>
    </div>
  );
};

export default Auth;
