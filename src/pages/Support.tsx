import { motion } from "framer-motion";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { Mail, Clock, Shield, MessageSquare, FileText, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

const supportChannels = [
  {
    icon: Mail,
    title: "Email Support",
    description: "Direct email support for all security and technical inquiries",
    action: "help@tryvaulta.com",
    href: "mailto:help@tryvaulta.com",
    response: "24-48 hour response"
  },
  {
    icon: Shield,
    title: "Security Incidents",
    description: "Report security vulnerabilities or incidents immediately",
    action: "security@tryvaulta.com",
    href: "mailto:security@tryvaulta.com",
    response: "Priority response within 4 hours"
  }
];

const faqItems = [
  {
    question: "How do I enable Multi-Factor Authentication?",
    answer: "Navigate to your Security Dashboard in the Vault, then click 'Enable MFA'. You'll be guided through setting up TOTP-based authentication using an authenticator app. This aligns with NIST IA-2 requirements."
  },
  {
    question: "What encryption does Vaulta use?",
    answer: "Vaulta uses AES-256-GCM for data at rest and TLS 1.3 for data in transit, meeting NIST SC-13 and SC-8 requirements. Keys are derived using PBKDF2-SHA256 with 100,000 iterations."
  },
  {
    question: "How are my documents protected?",
    answer: "Documents are encrypted client-side before upload using your unique encryption key. We never have access to your unencrypted data (zero-knowledge architecture), satisfying SC-28 controls."
  },
  {
    question: "What happens if I lose my recovery codes?",
    answer: "Per IA-5 authenticator management controls, recovery codes are your backup for MFA. If lost, contact support to verify your identity through our secure verification process."
  },
  {
    question: "How long are audit logs retained?",
    answer: "Security audit logs are retained for 90 days per AU-11 requirements. Premium users can request extended retention periods for compliance purposes."
  },
  {
    question: "Is Vaulta HIPAA compliant?",
    answer: "Vaulta's security controls are designed to support HIPAA compliance. Business Associate Agreements (BAAs) are available for Premium subscribers handling PHI."
  }
];

export default function Support() {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="pt-24 pb-16">
        <div className="container mx-auto px-6 max-w-5xl">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <h1 className="font-display text-4xl md:text-5xl font-bold text-primary mb-4">
              SUPPORT
            </h1>
            <p className="text-muted-foreground font-rajdhani text-lg mb-12 max-w-2xl">
              24/7 security-focused support aligned with NIST 800-53 incident response requirements.
            </p>

            {/* Contact Channels */}
            <section className="mb-16">
              <h2 className="font-display text-2xl font-bold text-foreground mb-6 tracking-wider">
                CONTACT CHANNELS
              </h2>
              <div className="grid md:grid-cols-2 gap-6">
                {supportChannels.map((channel, index) => (
                  <motion.a
                    key={channel.title}
                    href={channel.href}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, delay: index * 0.1 }}
                    className="bg-card/50 border border-border rounded-lg p-6 hover:border-primary/50 transition-all hover:shadow-lg hover:shadow-primary/5 group"
                  >
                    <div className="flex items-start gap-4">
                      <div className="p-3 rounded-lg bg-primary/10 text-primary group-hover:bg-primary/20 transition-colors">
                        <channel.icon className="w-6 h-6" />
                      </div>
                      <div className="flex-1">
                        <h3 className="font-display text-lg font-bold text-foreground mb-2">
                          {channel.title}
                        </h3>
                        <p className="text-muted-foreground font-rajdhani mb-3">
                          {channel.description}
                        </p>
                        <div className="flex items-center gap-3">
                          <span className="font-mono text-primary text-sm">{channel.action}</span>
                        </div>
                        <div className="flex items-center gap-2 mt-3 text-xs text-muted-foreground">
                          <Clock className="w-3 h-3" />
                          <span>{channel.response}</span>
                        </div>
                      </div>
                    </div>
                  </motion.a>
                ))}
              </div>
            </section>

            {/* Incident Response Notice */}
            <section className="mb-16">
              <div className="bg-primary/10 border border-primary/30 rounded-lg p-6 flex items-start gap-4">
                <AlertCircle className="w-6 h-6 text-primary flex-shrink-0 mt-1" />
                <div>
                  <h3 className="font-display text-lg font-bold text-foreground mb-2">
                    Security Incident Response (IR-6)
                  </h3>
                  <p className="text-muted-foreground font-rajdhani mb-4">
                    Per NIST IR-6 controls, Vaulta maintains a formal incident response capability. 
                    If you suspect a security incident affecting your account or data, immediately contact 
                    our security team. All incidents are tracked, investigated, and reported per regulatory requirements.
                  </p>
                  <Button
                    asChild
                    className="btn-gradient font-rajdhani font-semibold tracking-wider"
                  >
                    <a href="mailto:security@tryvaulta.com">Report Security Incident</a>
                  </Button>
                </div>
              </div>
            </section>

            {/* FAQ Section */}
            <section>
              <h2 className="font-display text-2xl font-bold text-foreground mb-6 tracking-wider flex items-center gap-3">
                <MessageSquare className="w-6 h-6 text-primary" />
                FREQUENTLY ASKED QUESTIONS
              </h2>
              <div className="space-y-4">
                {faqItems.map((item, index) => (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, delay: index * 0.05 }}
                    className="bg-card/50 border border-border rounded-lg p-6"
                  >
                    <h3 className="font-display text-base font-bold text-foreground mb-2 flex items-start gap-2">
                      <FileText className="w-4 h-4 text-primary mt-1 flex-shrink-0" />
                      {item.question}
                    </h3>
                    <p className="text-muted-foreground font-rajdhani pl-6">
                      {item.answer}
                    </p>
                  </motion.div>
                ))}
              </div>
            </section>
          </motion.div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
