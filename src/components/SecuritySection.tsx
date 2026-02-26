import { motion } from "framer-motion";
import { Shield, Lock, Eye, Server, FileCheck, Fingerprint } from "lucide-react";

const securityFeatures = [
  {
    icon: Lock,
    title: "256-Bit AES Encryption",
    description: "End-to-end encryption protects your data at rest and in transit.",
  },
  {
    icon: Fingerprint,
    title: "Multi-Factor Authentication",
    description: "Biometric, TOTP, and hardware key support for maximum security.",
  },
  {
    icon: Eye,
    title: "Zero-Knowledge Architecture",
    description: "We cannot see your data. Only you hold the encryption keys.",
  },
  {
    icon: Server,
    title: "NIST-800-53 Compliance",
    description: "Audited against federal security standards for maximum protection.",
  },
  {
    icon: FileCheck,
    title: "Document Verification",
    description: "Cryptographic signatures ensure document authenticity.",
  },
  {
    icon: Shield,
    title: "Sovereign Control",
    description: "You decide who sees what, when, and for how long.",
  },
];

export const SecuritySection = () => {
  return (
    <section id="security" className="py-24 bg-card/30 relative">
      <div className="absolute inset-0 grid-bg opacity-20" />
      
      <div className="container mx-auto px-6 relative z-10">
        <motion.div
          className="text-center mb-16"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
        >
          <h2 className="font-display text-3xl md:text-4xl font-bold text-foreground mb-4">
            SECURITY <span className="gradient-text">ARCHITECTURE</span>
          </h2>
          <p className="text-muted-foreground max-w-2xl mx-auto font-rajdhani text-lg">
            Built from the ground up with security-first principles and federal compliance standards
          </p>
        </motion.div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {securityFeatures.map((feature, index) => {
            const Icon = feature.icon;
            return (
              <motion.div
                key={feature.title}
                className="flex items-start gap-4 p-6 rounded-lg border border-border bg-card/50 backdrop-blur card-hover"
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: index * 0.1 }}
              >
                <div className="w-12 h-12 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center flex-shrink-0">
                  <Icon size={24} className="text-primary" />
                </div>
                <div>
                  <h3 className="font-display text-lg font-semibold text-foreground mb-2">
                    {feature.title}
                  </h3>
                  <p className="text-sm text-muted-foreground font-rajdhani">
                    {feature.description}
                  </p>
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* Compliance Badges */}
        <motion.div
          className="mt-16 p-8 rounded-xl cyber-border"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.3 }}
        >
          <div className="text-center mb-8">
            <h3 className="font-display text-xl font-bold text-primary mb-2">
              COMPLIANCE & CERTIFICATIONS
            </h3>
            <p className="text-sm text-muted-foreground font-rajdhani">
              Our infrastructure meets the highest security standards
            </p>
          </div>

          <div className="flex flex-wrap justify-center gap-8">
            {[
              { label: "NIST-800-53", status: "VERIFIED" },
              { label: "SOC 2 TYPE II", status: "COMPLIANT" },
              { label: "GDPR", status: "COMPLIANT" },
              { label: "ISO 27001", status: "COMPLIANT" },
            ].map((cert) => (
              <div
                key={cert.label}
                className="flex flex-col items-center gap-2 px-6 py-4 rounded-lg border border-primary/20 bg-primary/5"
              >
                <span className="font-display text-lg font-bold text-foreground">
                  {cert.label}
                </span>
                <span className="text-xs font-mono text-secure-green">{cert.status}</span>
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  );
};
