import { motion } from "framer-motion";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { Shield, AlertTriangle, Scale, Lock, Mail } from "lucide-react";

const sections = [
  {
    icon: Shield,
    title: "What Vaulta Is",
    content:
      "Vaulta is a trust-signal and data integrity platform that helps individuals document consistent identity, income, and housing history across borders using immutable timestamps, integrity checks, and user-controlled data sharing.",
  },
  {
    icon: AlertTriangle,
    title: "What Vaulta Is Not",
    content:
      "Vaulta is not a guarantor, insurer, credit bureau, or underwriting authority. Vaulta does not guarantee rent payment, tenant performance, or financial outcomes.",
  },
  {
    icon: Scale,
    title: "Accountability & Residual Risk",
    content:
      "Property companies retain the same residual risk they already accept when approving any tenant. Vaulta modifies qualification inputs, not liability.",
  },
  {
    icon: Lock,
    title: "Security & Scope",
    content:
      "Vaulta prioritizes data minimization, continuity, and controlled access while acknowledging that no system eliminates all risk.",
  },
];

export default function WhatVaultaIs() {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="pt-24 pb-16">
        <div className="container mx-auto px-6 max-w-3xl">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <h1 className="font-display text-4xl md:text-5xl font-bold text-primary mb-4">
              WHAT VAULTA IS / IS NOT
            </h1>
            <p className="text-muted-foreground font-rajdhani text-lg mb-12 max-w-2xl">
              Transparency about what Vaulta does, its boundaries, and the responsibilities it does not assume.
            </p>

            <div className="space-y-8">
              {sections.map((section, index) => {
                const Icon = section.icon;
                return (
                  <motion.div
                    key={section.title}
                    className="p-6 rounded-lg border border-border bg-card/50 backdrop-blur"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4, delay: index * 0.1 }}
                  >
                    <div className="flex items-start gap-4">
                      <div className="p-3 rounded-lg bg-primary/10 border border-primary/20 flex-shrink-0">
                        <Icon size={20} className="text-primary" />
                      </div>
                      <div>
                        <h2 className="font-display text-xl font-bold text-foreground mb-3">
                          {section.title}
                        </h2>
                        <p className="text-muted-foreground font-rajdhani leading-relaxed">
                          {section.content}
                        </p>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>

            {/* Contact */}
            <motion.div
              className="mt-12 p-6 rounded-lg border border-primary/20 bg-primary/5 text-center"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.5, delay: 0.5 }}
            >
              <div className="flex items-center justify-center gap-2 mb-2">
                <Mail size={16} className="text-primary" />
                <span className="font-display text-sm font-bold text-foreground">CONTACT</span>
              </div>
              <a
                href="mailto:hello@tryvaulta.com"
                className="text-primary font-mono hover:underline"
              >
                hello@tryvaulta.com
              </a>
            </motion.div>
          </motion.div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
