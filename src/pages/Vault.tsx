import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Shield, Upload, FileText, Bot, LogOut, Building2, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import AIOracle from "@/components/AIOracle";
import DocumentUpload from "@/components/DocumentUpload";
import DocumentList from "@/components/DocumentList";
import InstitutionConnect from "@/components/InstitutionConnect";
import MFASettings from "@/components/MFASettings";

const Vault = () => {
  const navigate = useNavigate();
  const { user, loading, signOut } = useAuth();
  const [oracleOpen, setOracleOpen] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [institutionOpen, setInstitutionOpen] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  useEffect(() => {
    if (!loading && !user) {
      navigate("/auth");
    }
  }, [user, loading, navigate]);

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
          <div className="flex items-center gap-2">
            <Button 
              variant="ghost" 
              size="icon"
              onClick={() => setShowSettings(!showSettings)} 
              className="text-muted-foreground"
            >
              <Settings size={18} />
            </Button>
            <Button variant="ghost" onClick={handleSignOut} className="text-muted-foreground">
              <LogOut size={18} className="mr-2" />
              Exit Vault
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-6 py-12">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center mb-12">
          <h1 className="font-display text-4xl font-bold gradient-text mb-2">Welcome to Your Sovereign Sector</h1>
          <p className="text-muted-foreground font-rajdhani">Your encrypted document vault with AI-powered assistance</p>
        </motion.div>

        {showSettings ? (
          <div className="max-w-2xl mx-auto space-y-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="font-display text-2xl font-bold text-foreground">Security Settings</h2>
              <Button variant="ghost" onClick={() => setShowSettings(false)}>
                Back to Vault
              </Button>
            </div>
            <MFASettings />
          </div>
        ) : (
          <>
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

              <motion.div className="cyber-border rounded-xl p-6 text-center card-hover cursor-pointer" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }} onClick={() => setShowSettings(true)}>
                <div className="w-14 h-14 mx-auto mb-4 rounded-xl bg-primary/10 border border-primary/30 flex items-center justify-center">
                  <Settings className="text-primary" size={24} />
                </div>
                <h3 className="font-display font-bold text-primary mb-1">Security</h3>
                <p className="text-xs text-muted-foreground font-rajdhani">MFA settings</p>
              </motion.div>
            </div>

            <DocumentList refreshTrigger={refreshTrigger} />
          </>
        )}
      </main>

      <AIOracle isOpen={oracleOpen} onClose={() => setOracleOpen(false)} />
      <DocumentUpload isOpen={uploadOpen} onClose={() => setUploadOpen(false)} onUploadComplete={() => setRefreshTrigger((p) => p + 1)} />
      <InstitutionConnect isOpen={institutionOpen} onClose={() => setInstitutionOpen(false)} />
    </div>
  );
};

export default Vault;
