import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Shield, Upload, FileText, Bot, LogOut, Building2, Settings, ShieldCheck, ClipboardCheck, TrendingUp, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import AIOracle from "@/components/AIOracle";
import DocumentUpload from "@/components/DocumentUpload";
import DocumentList from "@/components/DocumentList";
import InstitutionConnect from "@/components/InstitutionConnect";
import MFASettings from "@/components/MFASettings";
import { SecurityDashboard } from "@/components/SecurityDashboard";
import { ComplianceDashboard } from "@/components/ComplianceDashboard";
import { TrustScoreDashboard } from "@/components/TrustScoreDashboard";
import { ThreatSimulation } from "@/components/ThreatSimulation";
import SubscriptionBadge from "@/components/SubscriptionBadge";
import UpgradePrompt from "@/components/UpgradePrompt";
import { useSubscription } from "@/hooks/useSubscription";

const Vault = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, loading, mfaRequired, signOut } = useAuth();
  const { checkSubscription, fetchDocumentCount, isPremium } = useSubscription();
  const { toast } = useToast();
  const [oracleOpen, setOracleOpen] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [institutionOpen, setInstitutionOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [securityOpen, setSecurityOpen] = useState(false);
  const [complianceOpen, setComplianceOpen] = useState(false);
  const [trustScoreOpen, setTrustScoreOpen] = useState(false);
  const [threatSimOpen, setThreatSimOpen] = useState(false);
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  useEffect(() => {
    if (!loading && !user) {
      navigate("/auth");
    }
    // Redirect to auth if MFA is required but not verified
    if (!loading && user && mfaRequired) {
      navigate("/auth");
    }
  }, [user, loading, mfaRequired, navigate]);

  // Handle subscription success/cancel from Stripe redirect
  useEffect(() => {
    const subscription = searchParams.get("subscription");
    if (subscription === "success") {
      toast({
        title: "Subscription Activated!",
        description: "Welcome to Premium Vault. You now have unlimited document storage.",
      });
      checkSubscription();
      fetchDocumentCount();
    } else if (subscription === "canceled") {
      toast({
        variant: "destructive",
        title: "Subscription Canceled",
        description: "Your subscription was not completed.",
      });
    }
  }, [searchParams, toast, checkSubscription, fetchDocumentCount]);

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background grid-bg flex items-center justify-center">
        <div className="text-center">
          <Shield className="mx-auto text-primary animate-pulse" size={48} />
          <p className="mt-4 text-muted-foreground font-mono">Decrypting vault...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background grid-bg">
      <header className="border-b border-border bg-card/50 backdrop-blur sticky top-0 z-40">
        <div className="container mx-auto px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
            <Shield className="text-primary" size={28} />
            <span className="font-display text-xl font-bold gradient-text">SOVEREIGN SECTOR</span>
          </div>
          <div className="flex items-center gap-4">
            <SubscriptionBadge />
            <div className="flex items-center gap-2">
              <Button variant="ghost" onClick={() => setTrustScoreOpen(true)} className="text-muted-foreground" title="Trust Score">
                <TrendingUp size={18} />
              </Button>
              <Button variant="ghost" onClick={() => setThreatSimOpen(true)} className="text-muted-foreground" title="Threat Simulation">
                <Zap size={18} />
              </Button>
              <Button variant="ghost" onClick={() => setComplianceOpen(true)} className="text-muted-foreground" title="Compliance Check">
                <ClipboardCheck size={18} />
              </Button>
              <Button variant="ghost" onClick={() => setSecurityOpen(true)} className="text-muted-foreground" title="Security Dashboard">
                <ShieldCheck size={18} />
              </Button>
              <Button variant="ghost" onClick={() => setSettingsOpen(true)} className="text-muted-foreground" title="Settings">
                <Settings size={18} />
              </Button>
              <Button variant="ghost" onClick={handleSignOut} className="text-muted-foreground">
                <LogOut size={18} className="mr-2" />
                Exit Vault
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-6 py-12">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center mb-8">
          <h1 className="font-display text-4xl font-bold gradient-text mb-2">Welcome to Your Sovereign Sector</h1>
          <p className="text-muted-foreground font-rajdhani">Your encrypted document vault with AI-powered assistance</p>
        </motion.div>

        {/* Compliance Trust Badges */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="flex flex-wrap justify-center gap-3 mb-12"
        >
          {[
            { label: "SOC 2", detail: "Compliant" },
            { label: "NIST 800-53", detail: "Verified" },
            { label: "GDPR", detail: "Compliant" },
            { label: "ISO 27001", detail: "Aligned" },
          ].map((badge) => (
            <div
              key={badge.label}
              className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-primary/20 bg-card/50 backdrop-blur"
            >
              <div className="w-1.5 h-1.5 rounded-full bg-secure-green animate-pulse" />
              <span className="text-xs font-mono text-muted-foreground">
                {badge.label} <span className="text-primary">{badge.detail}</span>
              </span>
            </div>
          ))}
        </motion.div>

        <div className="grid md:grid-cols-4 gap-6 max-w-5xl mx-auto mb-12">
          <motion.div className="cyber-border rounded-xl p-6 text-center card-hover cursor-pointer" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} onClick={() => setUploadOpen(true)}>
            <div className="w-14 h-14 mx-auto mb-4 rounded-xl bg-primary/10 border border-primary/30 flex items-center justify-center">
              <Upload className="text-primary" size={24} />
            </div>
            <h3 className="font-display font-bold text-primary mb-1">Upload</h3>
            <p className="text-xs text-muted-foreground font-rajdhani">Secure documents</p>
          </motion.div>

          <motion.div className="cyber-border rounded-xl p-6 text-center card-hover cursor-pointer" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} onClick={() => setInstitutionOpen(true)}>
            <div className="w-14 h-14 mx-auto mb-4 rounded-xl bg-accent/10 border border-accent/30 flex items-center justify-center">
              <Building2 className="text-accent" size={24} />
            </div>
            <h3 className="font-display font-bold text-accent mb-1">Institutions</h3>
            <p className="text-xs text-muted-foreground font-rajdhani">Connect & ingest</p>
          </motion.div>

          <motion.div className="cyber-border rounded-xl p-6 text-center card-hover cursor-pointer" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} onClick={() => setOracleOpen(true)}>
            <div className="w-14 h-14 mx-auto mb-4 rounded-xl bg-accent/10 border border-accent/30 flex items-center justify-center">
              <Bot className="text-accent" size={24} />
            </div>
            <h3 className="font-display font-bold text-accent mb-1">AI Oracle</h3>
            <p className="text-xs text-muted-foreground font-rajdhani">24/7 guidance</p>
          </motion.div>

          <motion.div className="cyber-border rounded-xl p-6 text-center card-hover cursor-pointer" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>
            <div className="w-14 h-14 mx-auto mb-4 rounded-xl bg-primary/10 border border-primary/30 flex items-center justify-center">
              <FileText className="text-primary" size={24} />
            </div>
            <h3 className="font-display font-bold text-primary mb-1">Documents</h3>
            <p className="text-xs text-muted-foreground font-rajdhani">View collection</p>
          </motion.div>
        </div>

        <DocumentList refreshTrigger={refreshTrigger} />
      </main>

      <AIOracle isOpen={oracleOpen} onClose={() => setOracleOpen(false)} />
      <DocumentUpload 
        isOpen={uploadOpen} 
        onClose={() => setUploadOpen(false)} 
        onUploadComplete={() => setRefreshTrigger((p) => p + 1)} 
        onUpgradeRequired={() => setUpgradeOpen(true)}
      />
      <InstitutionConnect isOpen={institutionOpen} onClose={() => setInstitutionOpen(false)} isPremium={isPremium} onUpgradeRequired={() => setUpgradeOpen(true)} />
      <MFASettings isOpen={settingsOpen} onClose={() => setSettingsOpen(false)} />
      <SecurityDashboard open={securityOpen} onOpenChange={setSecurityOpen} />
      <ComplianceDashboard open={complianceOpen} onOpenChange={setComplianceOpen} />
      <TrustScoreDashboard open={trustScoreOpen} onOpenChange={setTrustScoreOpen} />
      <ThreatSimulation open={threatSimOpen} onOpenChange={setThreatSimOpen} />
      <UpgradePrompt isOpen={upgradeOpen} onClose={() => setUpgradeOpen(false)} />
    </div>
  );
};

export default Vault;
