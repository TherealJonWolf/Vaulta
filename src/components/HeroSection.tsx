import { motion } from "framer-motion";
import { Shield, ArrowRight } from "lucide-react";
import { Button } from "./ui/button";
import { useNavigate } from "react-router-dom";

export const HeroSection = () => {
  const navigate = useNavigate();

  return (
    <section className="relative min-h-screen flex items-center justify-center pt-20 overflow-hidden">
      {/* Background effects */}
      <div className="absolute inset-0 grid-bg opacity-50" />
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/10 rounded-full blur-3xl" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-accent/10 rounded-full blur-3xl" />

      <div className="container mx-auto px-6 relative z-10">
        <div className="max-w-4xl mx-auto text-center">
          {/* Shield Icon */}
          <motion.div
            className="flex justify-center mb-8"
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.6, type: "spring" }}
          >
            <div className="relative">
              <div className="absolute inset-0 bg-primary/30 rounded-full blur-3xl scale-150" />
              <div className="relative p-6 rounded-full border-2 border-primary/40 bg-card/30 backdrop-blur float shield-pulse">
                <Shield size={64} className="text-primary" strokeWidth={1} />
              </div>
            </div>
          </motion.div>

          {/* Main Heading */}
          <motion.h1
            className="font-display text-5xl md:text-7xl font-bold mb-4"
            initial={{ y: 30, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            <span className="gradient-text">SOVEREIGN SECTOR</span>
          </motion.h1>

          {/* Subheading */}
          <motion.p
            className="text-xl md:text-2xl text-muted-foreground mb-4 font-rajdhani"
            initial={{ y: 30, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.3 }}
          >
            Empowering immigrants and global citizens with sovereign control over their digital identity
          </motion.p>

          <motion.p
            className="text-lg text-primary font-display tracking-widest mb-8"
            initial={{ y: 30, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.35 }}
          >
            Vaulta. Your world, secured.
          </motion.p>

          {/* CTA Button */}
          <motion.div
            initial={{ y: 30, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.4 }}
          >
            <Button
              size="lg"
              className="btn-gradient font-rajdhani font-bold tracking-widest text-lg px-12 py-6 text-primary-foreground"
              onClick={() => navigate("/auth?mode=signup")}
            >
              INITIALIZE YOUR VAULT
              <ArrowRight className="ml-2" size={20} />
            </Button>
          </motion.div>

          {/* Trust Badges */}
          <motion.div
            className="flex flex-wrap justify-center gap-6 mt-12"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.5 }}
          >
            {[
              "NIST-800-53 COMPLIANT",
              "256-BIT AES ENCRYPTION",
              "ZERO-KNOWLEDGE PROOF",
              "MILITARY GRADE SECURITY",
            ].map((badge) => (
              <div
                key={badge}
                className="flex items-center gap-2 px-4 py-2 rounded-full border border-primary/20 bg-card/30 backdrop-blur"
              >
                <div className="w-2 h-2 rounded-full bg-secure-green animate-pulse" />
                <span className="text-xs font-mono text-muted-foreground">{badge}</span>
              </div>
            ))}
          </motion.div>
        </div>
      </div>
    </section>
  );
};
