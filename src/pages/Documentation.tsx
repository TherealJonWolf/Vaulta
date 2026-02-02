import { motion } from "framer-motion";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { Shield, Lock, Eye, FileText, Server, Users } from "lucide-react";

const controlFamilies = [
  {
    id: "AC",
    name: "Access Control",
    icon: Lock,
    description: "Policies and mechanisms to limit system access to authorized users, processes, and devices.",
    controls: ["AC-1 Policy & Procedures", "AC-2 Account Management", "AC-3 Access Enforcement", "AC-6 Least Privilege"]
  },
  {
    id: "AU",
    name: "Audit & Accountability",
    icon: Eye,
    description: "Creation, protection, and retention of audit records to enable monitoring and investigation.",
    controls: ["AU-2 Event Logging", "AU-3 Content of Audit Records", "AU-6 Audit Review", "AU-9 Protection of Audit Info"]
  },
  {
    id: "IA",
    name: "Identification & Authentication",
    icon: Users,
    description: "Verification of user, process, and device identities before granting access.",
    controls: ["IA-2 User Identification", "IA-5 Authenticator Management", "IA-8 Identification of Non-Org Users"]
  },
  {
    id: "SC",
    name: "System & Communications Protection",
    icon: Server,
    description: "Protection of information at rest and in transit using cryptographic mechanisms.",
    controls: ["SC-8 Transmission Confidentiality", "SC-12 Cryptographic Key Management", "SC-13 Cryptographic Protection", "SC-28 Protection of Information at Rest"]
  },
  {
    id: "SI",
    name: "System & Information Integrity",
    icon: Shield,
    description: "Detection, reporting, and correction of information and system flaws.",
    controls: ["SI-2 Flaw Remediation", "SI-3 Malicious Code Protection", "SI-4 System Monitoring", "SI-7 Software & Information Integrity"]
  },
  {
    id: "MP",
    name: "Media Protection",
    icon: FileText,
    description: "Protection and secure handling of system media containing sensitive information.",
    controls: ["MP-2 Media Access", "MP-4 Media Storage", "MP-5 Media Transport", "MP-6 Media Sanitization"]
  }
];

export default function Documentation() {
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
              DOCUMENTATION
            </h1>
            <p className="text-muted-foreground font-rajdhani text-lg mb-12 max-w-2xl">
              Comprehensive security documentation aligned with NIST 800-53 Rev. 5 control families.
            </p>

            {/* Overview Section */}
            <section className="mb-16">
              <h2 className="font-display text-2xl font-bold text-foreground mb-6 tracking-wider">
                SECURITY FRAMEWORK OVERVIEW
              </h2>
              <div className="bg-card/50 border border-border rounded-lg p-6">
                <p className="text-muted-foreground font-rajdhani leading-relaxed mb-4">
                  Vaulta implements security controls based on NIST Special Publication 800-53 Revision 5, 
                  the gold standard for federal information systems and organizations. Our zero-knowledge 
                  architecture ensures that your data remains encrypted and inaccessible to anyone—including us.
                </p>
                <p className="text-muted-foreground font-rajdhani leading-relaxed">
                  All documents are protected with AES-256-GCM encryption, with keys derived using PBKDF2 
                  and never transmitted or stored on our servers.
                </p>
              </div>
            </section>

            {/* Control Families */}
            <section className="mb-16">
              <h2 className="font-display text-2xl font-bold text-foreground mb-6 tracking-wider">
                NIST 800-53 CONTROL FAMILIES
              </h2>
              <div className="grid gap-6">
                {controlFamilies.map((family, index) => (
                  <motion.div
                    key={family.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, delay: index * 0.1 }}
                    className="bg-card/50 border border-border rounded-lg p-6 hover:border-primary/50 transition-colors"
                  >
                    <div className="flex items-start gap-4">
                      <div className="p-3 rounded-lg bg-primary/10 text-primary">
                        <family.icon className="w-6 h-6" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <span className="font-mono text-sm text-primary bg-primary/10 px-2 py-1 rounded">
                            {family.id}
                          </span>
                          <h3 className="font-display text-lg font-bold text-foreground">
                            {family.name}
                          </h3>
                        </div>
                        <p className="text-muted-foreground font-rajdhani mb-4">
                          {family.description}
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {family.controls.map((control) => (
                            <span
                              key={control}
                              className="text-xs font-mono text-muted-foreground bg-muted/50 px-2 py-1 rounded"
                            >
                              {control}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </section>

            {/* Implementation Details */}
            <section>
              <h2 className="font-display text-2xl font-bold text-foreground mb-6 tracking-wider">
                IMPLEMENTATION DETAILS
              </h2>
              <div className="grid md:grid-cols-2 gap-6">
                <div className="bg-card/50 border border-border rounded-lg p-6">
                  <h3 className="font-display text-lg font-bold text-foreground mb-3">Encryption Standards</h3>
                  <ul className="space-y-2 text-muted-foreground font-rajdhani">
                    <li>• AES-256-GCM for data at rest</li>
                    <li>• TLS 1.3 for data in transit</li>
                    <li>• PBKDF2-SHA256 key derivation</li>
                    <li>• Cryptographically secure random IVs</li>
                  </ul>
                </div>
                <div className="bg-card/50 border border-border rounded-lg p-6">
                  <h3 className="font-display text-lg font-bold text-foreground mb-3">Authentication</h3>
                  <ul className="space-y-2 text-muted-foreground font-rajdhani">
                    <li>• Multi-factor authentication (TOTP)</li>
                    <li>• Secure session management</li>
                    <li>• Recovery code backup system</li>
                    <li>• Login attempt monitoring</li>
                  </ul>
                </div>
              </div>
            </section>
          </motion.div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
