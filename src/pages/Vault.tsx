import { motion } from "framer-motion";
import { Shield, Upload, FileText, Bot, LogOut, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

const Vault = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background grid-bg">
      {/* Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur">
        <div className="container mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Shield className="text-primary" size={28} />
            <span className="font-display text-xl font-bold gradient-text">SOVEREIGN SECTOR</span>
          </div>
          <Button variant="ghost" onClick={() => navigate("/")} className="text-muted-foreground">
            <LogOut size={18} className="mr-2" />
            Exit Vault
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-6 py-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-12"
        >
          <h1 className="font-display text-4xl font-bold gradient-text mb-2">
            Welcome to Your Sovereign Sector
          </h1>
          <p className="text-muted-foreground font-rajdhani">
            Your encrypted document vault with AI-powered assistance
          </p>
        </motion.div>

        {/* Quick Actions */}
        <div className="grid md:grid-cols-3 gap-6 max-w-4xl mx-auto">
          <motion.div
            className="cyber-border rounded-xl p-8 text-center card-hover cursor-pointer"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <div className="w-16 h-16 mx-auto mb-4 rounded-xl bg-primary/10 border border-primary/30 flex items-center justify-center">
              <Upload className="text-primary" size={28} />
            </div>
            <h3 className="font-display text-lg font-bold text-primary mb-2">Upload Document</h3>
            <p className="text-sm text-muted-foreground font-rajdhani">
              Securely store your sensitive documents with military-grade encryption
            </p>
          </motion.div>

          <motion.div
            className="cyber-border rounded-xl p-8 text-center card-hover cursor-pointer"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <div className="w-16 h-16 mx-auto mb-4 rounded-xl bg-accent/10 border border-accent/30 flex items-center justify-center">
              <Bot className="text-accent" size={28} />
            </div>
            <h3 className="font-display text-lg font-bold text-accent mb-2">AI Oracle</h3>
            <p className="text-sm text-muted-foreground font-rajdhani">
              Get 24/7 guidance for navigating institutions and bureaucracy
            </p>
          </motion.div>

          <motion.div
            className="cyber-border rounded-xl p-8 text-center card-hover cursor-pointer"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            <div className="w-16 h-16 mx-auto mb-4 rounded-xl bg-primary/10 border border-primary/30 flex items-center justify-center">
              <FileText className="text-primary" size={28} />
            </div>
            <h3 className="font-display text-lg font-bold text-primary mb-2">My Documents</h3>
            <p className="text-sm text-muted-foreground font-rajdhani">
              View and manage your encrypted document collection
            </p>
          </motion.div>
        </div>

        {/* Empty State */}
        <motion.div
          className="mt-16 text-center py-16 border border-dashed border-border rounded-2xl"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
        >
          <Plus className="mx-auto text-muted-foreground mb-4" size={48} />
          <h3 className="font-display text-xl font-bold text-foreground mb-2">
            Your Vault is Empty
          </h3>
          <p className="text-muted-foreground font-rajdhani mb-6">
            Start by uploading your first document to the Sovereign Sector
          </p>
          <Button className="btn-gradient font-rajdhani font-bold text-primary-foreground">
            <Upload size={18} className="mr-2" />
            Upload First Document
          </Button>
        </motion.div>
      </main>
    </div>
  );
};

export default Vault;
