import { useState } from "react";
import { motion } from "framer-motion";
import { Crown, Check, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { useSubscription } from "@/hooks/useSubscription";
import { useToast } from "@/hooks/use-toast";

interface UpgradePromptProps {
  isOpen: boolean;
  onClose: () => void;
}

const UpgradePrompt = ({ isOpen, onClose }: UpgradePromptProps) => {
  const { createCheckout, documentsRemaining, freeLimit, isPremium } = useSubscription();
  const { toast } = useToast();
  const [isAnnual, setIsAnnual] = useState(true); // Default to annual for better value
  const [loading, setLoading] = useState(false);

  const handleUpgrade = async () => {
    setLoading(true);
    try {
      await createCheckout(isAnnual ? "annual" : "monthly");
    } catch {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Unable to start checkout. Please try again.",
      });
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen || isPremium) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-6"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
      >
        <Card className="w-full max-w-md cyber-border bg-card">
          <CardHeader className="text-center pb-2">
            <div className="mx-auto w-16 h-16 rounded-2xl bg-primary/10 border border-primary/30 flex items-center justify-center mb-4">
              <Crown className="text-primary" size={32} />
            </div>
            <CardTitle className="font-display text-2xl gradient-text">
              Upgrade to Premium
            </CardTitle>
            <CardDescription className="font-rajdhani">
              You've used {freeLimit - documentsRemaining} of {freeLimit} free documents
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Billing Toggle */}
            <div className="flex items-center justify-center gap-3 p-3 rounded-xl bg-muted/30 border border-border">
              <span className={`font-rajdhani text-sm ${!isAnnual ? "text-foreground font-medium" : "text-muted-foreground"}`}>
                Monthly
              </span>
              <Switch
                checked={isAnnual}
                onCheckedChange={setIsAnnual}
                className="data-[state=checked]:bg-primary"
              />
              <span className={`font-rajdhani text-sm ${isAnnual ? "text-foreground font-medium" : "text-muted-foreground"}`}>
                Annual
              </span>
              {isAnnual && (
                <Badge className="bg-accent/20 text-accent border-accent/30 font-mono text-xs">
                  Save 17%
                </Badge>
              )}
            </div>

            <div className="p-4 rounded-xl bg-muted/30 border border-border">
              <div className="flex items-center justify-between mb-4">
                <span className="font-display font-bold text-lg">Premium Vault</span>
                <div className="text-right">
                  <div className="flex items-baseline gap-1">
                    <span className="text-3xl font-bold gradient-text">
                      {isAnnual ? "$99" : "$9.99"}
                    </span>
                    <span className="text-muted-foreground font-mono text-sm">
                      {isAnnual ? "/year" : "/mo"}
                    </span>
                  </div>
                  {isAnnual && (
                    <p className="text-xs text-accent font-mono">$8.25/month</p>
                  )}
                </div>
              </div>
              <ul className="space-y-3">
                {[
                  "Unlimited document storage",
                  "256-bit AES encryption",
                  "Priority support",
                  "Advanced AI assistant",
                ].map((feature, i) => (
                  <li key={i} className="flex items-center gap-3 text-sm font-rajdhani">
                    <Check className="text-primary" size={16} />
                    {feature}
                  </li>
                ))}
              </ul>
            </div>

            <div className="flex gap-3">
              <Button variant="outline" onClick={onClose} className="flex-1">
                Maybe Later
              </Button>
              <Button
                onClick={handleUpgrade}
                disabled={loading}
                className="flex-1 btn-gradient font-rajdhani font-bold"
              >
                <Sparkles size={16} className="mr-2" />
                {loading ? "Loading..." : "Upgrade Now"}
              </Button>
            </div>

            <p className="text-xs text-center text-muted-foreground font-mono">
              Cancel anytime • Secure payment via Stripe
            </p>
          </CardContent>
        </Card>
      </motion.div>
    </motion.div>
  );
};

export default UpgradePrompt;
