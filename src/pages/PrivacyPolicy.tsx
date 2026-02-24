import { motion } from "framer-motion";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { Shield, Lock, Eye, Database, UserCheck, Bell, Trash2, Globe } from "lucide-react";

const PrivacyPolicy = () => {
  const sections = [
    {
      icon: Database,
      title: "1. Information We Collect",
      content: `We collect information necessary to provide our secure document management services:

**Personal Information:**
- Email address and account credentials
- Full name (optional)
- Authentication data including MFA tokens

**Document Data:**
- Files you upload to Vaulta
- Document metadata (file names, sizes, types)
- Encryption key hashes (never plaintext keys)

**Technical Data:**
- IP addresses and access logs
- Device information and browser type
- Session data for security monitoring

All collected data is encrypted using AES-256 encryption and stored in compliance with NIST 800-53 security controls.`
    },
    {
      icon: Lock,
      title: "2. How We Protect Your Data",
      content: `Vaulta implements military-grade security measures in accordance with NIST 800-53 Rev. 5:

**Encryption:**
- All data encrypted at rest using AES-256
- TLS 1.3 for data in transit
- Zero-knowledge architecture - we cannot access your encrypted documents

**Access Controls (AC):**
- Multi-factor authentication (MFA) with TOTP
- Role-based access control
- Automatic session timeout after inactivity

**Audit & Accountability (AU):**
- Comprehensive audit logging of all access
- Tamper-evident log storage
- Regular security assessments

**Incident Response (IR):**
- 24/7 security monitoring
- Automated threat detection
- Documented incident response procedures`
    },
    {
      icon: Eye,
      title: "3. How We Use Your Information",
      content: `We use your information solely for:

- **Service Delivery:** Providing secure document storage and retrieval
- **Authentication:** Verifying your identity and protecting your account
- **Security:** Detecting and preventing unauthorized access
- **Communication:** Sending critical security alerts and service updates
- **Compliance:** Meeting legal and regulatory requirements

We do NOT:
- Sell your personal information to third parties
- Use your data for advertising purposes
- Access your encrypted documents without your explicit consent
- Share your information except as required by law`
    },
    {
      icon: UserCheck,
      title: "4. Your Rights (NIST Privacy Controls)",
      content: `In accordance with NIST privacy principles and applicable regulations:

**Access Rights:**
- Request a copy of your personal data
- View audit logs of access to your account

**Correction Rights:**
- Update your personal information at any time
- Correct inaccurate data in your profile

**Deletion Rights:**
- Request deletion of your account and all associated data
- Export your documents before account deletion

**Portability Rights:**
- Download your documents in original format
- Export account data in machine-readable format

To exercise these rights, contact us at privacy@vaulta.io`
    },
    {
      icon: Bell,
      title: "5. Data Breach Notification",
      content: `In compliance with NIST 800-53 IR-6 (Incident Reporting):

- We will notify affected users within 72 hours of discovering a data breach
- Notification will include the nature of the breach, data affected, and remediation steps
- We maintain detailed incident response procedures
- Regular breach simulation exercises ensure rapid response capability

Our security team monitors for threats 24/7 and employs automated detection systems.`
    },
    {
      icon: Globe,
      title: "6. Data Storage & Transfers",
      content: `**Storage Location:**
- Primary data centers located in secure, SOC 2 Type II compliant facilities
- Geographic redundancy for disaster recovery

**International Transfers:**
- Data transfers comply with applicable international frameworks
- Encryption ensures data protection regardless of location

**Retention:**
- Active account data retained while account is active
- Deleted data purged within 30 days
- Audit logs retained for 7 years per compliance requirements`
    },
    {
      icon: Trash2,
      title: "7. Account Deletion",
      content: `When you delete your Vaulta account:

- All personal information is permanently deleted within 30 days
- Encrypted documents are securely destroyed
- Backup copies are purged according to our retention schedule
- Audit logs are anonymized but retained for compliance

**Recovery Codes:**
- Unused recovery codes are immediately invalidated
- MFA configurations are permanently removed

To delete your account, visit Settings > Security > Delete Account`
    },
    {
      icon: Shield,
      title: "8. NIST 800-53 Compliance Summary",
      content: `Vaulta maintains compliance with the following NIST 800-53 Rev. 5 control families:

| Control Family | Implementation |
|----------------|----------------|
| AC (Access Control) | MFA, RBAC, session management |
| AU (Audit) | Comprehensive logging, tamper protection |
| IA (Identification) | Strong authentication, credential management |
| SC (System Communications) | TLS 1.3, AES-256 encryption |
| SI (System Integrity) | Malware protection, integrity monitoring |
| IR (Incident Response) | 24/7 monitoring, breach notification |
| PM (Program Management) | Privacy program, risk assessments |

For a complete compliance matrix, contact compliance@vaulta.io`
    }
  ];

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      
      {/* Hero Section */}
      <section className="pt-32 pb-16 relative overflow-hidden">
        <div className="absolute inset-0 bg-cyber-grid bg-grid opacity-30" />
        <div className="absolute inset-0 bg-gradient-to-b from-primary/5 to-transparent" />
        
        <div className="container mx-auto px-6 relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center max-w-4xl mx-auto"
          >
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 mb-6">
              <Shield className="w-4 h-4 text-primary" />
              <span className="text-sm font-mono text-primary">NIST 800-53 COMPLIANT</span>
            </div>
            
            <h1 className="text-4xl md:text-5xl font-display font-bold mb-6">
              Privacy <span className="text-primary">Policy</span>
            </h1>
            
            <p className="text-xl text-muted-foreground font-rajdhani">
              Your privacy is fundamental to our mission. This policy explains how Vaulta 
              protects your data with military-grade security.
            </p>
            
            <p className="mt-4 text-sm text-muted-foreground font-mono">
              Last updated: January 22, 2026 | Effective: January 22, 2026
            </p>
          </motion.div>
        </div>
      </section>

      {/* Content Sections */}
      <section className="py-16">
        <div className="container mx-auto px-6 max-w-4xl">
          <div className="space-y-12">
            {sections.map((section, index) => (
              <motion.div
                key={section.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
                className="bg-card/50 border border-border rounded-lg p-8"
              >
                <div className="flex items-start gap-4 mb-6">
                  <div className="p-3 rounded-lg bg-primary/10 border border-primary/20">
                    <section.icon className="w-6 h-6 text-primary" />
                  </div>
                  <h2 className="text-2xl font-display font-bold text-foreground">
                    {section.title}
                  </h2>
                </div>
                
                <div className="prose prose-invert max-w-none">
                  <div className="text-muted-foreground font-rajdhani leading-relaxed whitespace-pre-line">
                    {section.content}
                  </div>
                </div>
              </motion.div>
            ))}
          </div>

          {/* Contact Section */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="mt-16 text-center p-8 bg-card/50 border border-border rounded-lg"
          >
            <h3 className="text-xl font-display font-bold mb-4">Questions About Privacy?</h3>
            <p className="text-muted-foreground font-rajdhani mb-4">
              Contact our Data Protection Officer at{" "}
              <a href="mailto:privacy@vaulta.io" className="text-primary hover:underline">
                privacy@vaulta.io
              </a>
            </p>
            <p className="text-sm text-muted-foreground font-mono">
              Response time: Within 48 hours
            </p>
          </motion.div>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default PrivacyPolicy;
