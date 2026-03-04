import { motion } from "framer-motion";
import { Shield, Lock, Eye, Server, FileCheck, Fingerprint, AlertTriangle } from "lucide-react";

const securityFeatures = [
  {
    icon: Lock,
    title: "End-to-End Encryption",
    description: "Zero-knowledge architecture ensures your data is encrypted at rest and in transit. Only you hold the keys.",
  },
  {
    icon: Fingerprint,
    title: "Immutable Vault Timestamps",
    description: "Every document and record is timestamped with an immutable audit marker that cannot be altered.",
  },
  {
    icon: Eye,
    title: "Automated Integrity & Consistency Checks",
    description: "Continuous checks across ingested documentation to generate trust signals and detect anomalies.",
  },
  {
    icon: Server,
    title: "SOC 2 Type II Controls",
    description: "Organizational and technical controls aligned with SOC 2 Type II standards.",
  },
  {
    icon: FileCheck,
    title: "Designed to Align with NIST 800-53",
    description: "Infrastructure designed against NIST 800-53 control families for comprehensive protection.",
  },
  {
    icon: Shield,
    title: "User-Controlled Data Access",
    description: "You decide who sees what, when, and for how long — maintaining sovereign control at all times.",
  },
];

const webThreats = [
  "Injection attacks (SQL, command, LDAP/XPath)",
  "Cross-site attacks (XSS, CSRF)",
  "Authentication and session abuse",
  "Application and server attacks (DDoS, file inclusion, directory traversal)",
  "Browser-based threats (phishing, DNS spoofing)",
];

const regulatoryItems = [
  {
    label: "GDPR (EU)",
    description: "Applies when EU citizens use Vaulta or EU-based documents are ingested. Vaulta's data minimization, limited retention, encryption, and user-controlled sharing mechanisms support GDPR principles.",
  },
  {
    label: "PIPEDA (Canada)",
    description: "Vaulta supports compliant handling and transfer of Canadian personal data through user consent, purpose limitation, and secure cross-border data controls.",
  },
  {
    label: "CCPA / CPRA (California)",
    description: "Vaulta allows users to understand what data is collected and supports user rights related to access and deletion requests.",
  },
  {
    label: "FCRA (Fair Credit Reporting Act)",
    description: "Vaulta does not issue credit scores or act as a consumer reporting agency. Trust signals are based on documented consistency and integrity checks, not predictive credit modeling.",
  },
  {
    label: "FHA (Fair Housing Act)",
    description: "Vaulta is designed for consistent application across similarly situated applicants to reduce disparate impact risk.",
  },
  {
    label: "ECOA (Equal Credit Opportunity Act)",
    description: "Vaulta focuses on behavioral consistency and documented history, not national origin or protected characteristics.",
  },
  {
    label: "GLBA (Gramm-Leach-Bliley Act)",
    description: "Vaulta protects non-public personal and financial information using administrative, technical, and physical safeguards appropriate for non-bank financial institutions.",
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
            SECURITY, PRIVACY &{" "}
            <span className="gradient-text">COMPLIANCE</span>
          </h2>
          <p className="text-muted-foreground max-w-2xl mx-auto font-rajdhani text-lg">
            Built from the ground up with security-first principles and designed to align with global privacy and compliance standards
          </p>
        </motion.div>

        {/* Security Features Grid */}
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

        {/* Web Application Security Posture */}
        <motion.div
          className="mt-16 p-8 rounded-xl border border-border bg-card/50 backdrop-blur"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.2 }}
        >
          <div className="flex items-start gap-4 mb-6">
            <div className="w-12 h-12 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center flex-shrink-0">
              <AlertTriangle size={24} className="text-primary" />
            </div>
            <div>
              <h3 className="font-display text-xl font-bold text-foreground mb-2">
                WEB APPLICATION SECURITY POSTURE
              </h3>
              <p className="text-muted-foreground font-rajdhani">
                Vaulta is designed to mitigate common web-based threats, including:
              </p>
            </div>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 pl-16">
            {webThreats.map((threat) => (
              <div
                key={threat}
                className="flex items-center gap-2 text-sm text-muted-foreground font-rajdhani"
              >
                <div className="w-2 h-2 rounded-full bg-secure-green flex-shrink-0" />
                {threat}
              </div>
            ))}
          </div>
        </motion.div>

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
              Our infrastructure is designed to meet the highest security standards
            </p>
          </div>

          <div className="flex flex-wrap justify-center gap-8">
            {[
              { label: "NIST 800-53", status: "ALIGNED" },
              { label: "SOC 2 TYPE II", status: "CONTROLS" },
              { label: "GDPR", status: "ALIGNED" },
              { label: "CCPA / CPRA", status: "ALIGNED" },
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

        {/* Regulatory Alignment & Privacy Standards */}
        <motion.div
          className="mt-16"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.4 }}
        >
          <div className="text-center mb-10">
            <h3 className="font-display text-2xl font-bold text-foreground mb-3">
              REGULATORY ALIGNMENT &{" "}
              <span className="gradient-text">PRIVACY STANDARDS</span>
            </h3>
            <p className="text-muted-foreground max-w-3xl mx-auto font-rajdhani">
              Vaulta is designed to operate under a limited data exposure and user-controlled access model to support compliance with global privacy and housing regulations, including:
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            {regulatoryItems.map((item, index) => (
              <motion.div
                key={item.label}
                className="p-5 rounded-lg border border-border bg-card/50 backdrop-blur"
                initial={{ opacity: 0, y: 10 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.3, delay: index * 0.05 }}
              >
                <h4 className="font-display text-sm font-bold text-primary mb-2">
                  {item.label}
                </h4>
                <p className="text-sm text-muted-foreground font-rajdhani leading-relaxed">
                  {item.description}
                </p>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  );
};
