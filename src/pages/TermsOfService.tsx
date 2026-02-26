import { motion } from "framer-motion";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { FileText, Shield, AlertTriangle, Scale, Clock, Ban, RefreshCw, Gavel } from "lucide-react";

const TermsOfService = () => {
  const sections = [
    {
      icon: FileText,
      title: "1. Acceptance of Terms",
      content: `By accessing or using Vaulta ("Service"), you agree to be bound by these Terms of Service ("Terms"). If you do not agree to these Terms, you may not access or use the Service.

**Eligibility:**
- You must be at least 18 years old to use Vaulta
- You must have the legal capacity to enter into binding agreements
- You must not be prohibited from using the Service under applicable laws

**Account Registration:**
- You must provide accurate and complete registration information
- You are responsible for maintaining the security of your account credentials
- You must immediately notify us of any unauthorized access to your account

These Terms constitute a legally binding agreement between you and Vaulta.`
    },
    {
      icon: Shield,
      title: "2. Service Description & Security",
      content: `Vaulta provides a secure document management platform with end-to-end encryption and NIST 800-53 compliance.

**Core Services:**
- Encrypted document storage and retrieval
- Multi-factor authentication (MFA) with TOTP
- Recovery code backup for account access
- Secure file sharing (when enabled)

**Security Commitments:**
- AES-256 encryption for all stored data
- TLS 1.3 for all data in transit
- Zero-knowledge architecture
- 99.99% uptime SLA for paid plans

**Service Availability:**
- We strive for continuous availability but do not guarantee uninterrupted service
- Scheduled maintenance will be announced in advance
- Emergency maintenance may occur without prior notice`
    },
    {
      icon: AlertTriangle,
      title: "3. User Responsibilities",
      content: `As a Vaulta user, you agree to:

**Security Obligations:**
- Maintain strong, unique passwords
- Enable and properly configure MFA
- Securely store your recovery codes
- Report any suspected security breaches immediately

**Acceptable Use:**
- Use the Service only for lawful purposes
- Not attempt to circumvent security controls
- Not share account access with unauthorized parties
- Not upload malicious files or malware

**Prohibited Activities:**
- Unauthorized access attempts
- Reverse engineering the Service
- Interfering with Service operations
- Using automated tools without permission
- Storing illegal or prohibited content`
    },
    {
      icon: Ban,
      title: "4. Prohibited Content",
      content: `You may NOT use Vaulta to store, transmit, or share:

**Absolutely Prohibited:**
- Child sexual abuse material (CSAM)
- Content promoting terrorism or violence
- Stolen or illegally obtained data
- Malware, viruses, or malicious code

**Restricted Content:**
- Content violating intellectual property rights
- Personal data of others without consent
- Classified government documents (without authorization)
- Content illegal in your jurisdiction

**Enforcement:**
- We reserve the right to remove prohibited content
- Accounts storing prohibited content may be terminated
- We will cooperate with law enforcement as required
- Violations may result in legal action`
    },
    {
      icon: Scale,
      title: "5. Intellectual Property",
      content: `**Your Content:**
- You retain all rights to documents you upload
- You grant Vaulta a limited license to store and transmit your content
- This license terminates when you delete your content or account

**Vaulta Property:**
- The Service, including all software and branding, is owned by Vaulta
- You may not copy, modify, or distribute our intellectual property
- "Vaulta" and related marks are trademarks of Jonathan McEwen

**Feedback:**
- Any suggestions or feedback you provide may be used without compensation
- We are not obligated to implement any suggestions`
    },
    {
      icon: Clock,
      title: "6. Service Terms & Termination",
      content: `**Account Duration:**
- Free accounts remain active with regular use
- Inactive free accounts may be suspended after 12 months
- Paid subscriptions continue until cancelled

**Termination by You:**
- You may delete your account at any time
- No refunds for partial billing periods
- Data deletion occurs within 30 days

**Termination by Vaulta:**
- We may suspend accounts violating these Terms
- We may terminate for illegal activity without notice
- We will provide 30 days notice for other terminations

**Effect of Termination:**
- Access to the Service immediately ceases
- You should export your data before termination
- Certain provisions survive termination (liability, disputes)`
    },
    {
      icon: RefreshCw,
      title: "7. Modifications to Terms",
      content: `**Changes to Terms:**
- We may modify these Terms at any time
- Material changes will be announced via email
- Continued use after changes constitutes acceptance

**Changes to Service:**
- We may modify, suspend, or discontinue features
- We will provide reasonable notice for significant changes
- Some features may require additional terms

**Notification:**
- Check this page regularly for updates
- The "Last Updated" date indicates the latest revision
- We maintain an archive of previous versions upon request`
    },
    {
      icon: Gavel,
      title: "8. Limitation of Liability",
      content: `**Disclaimer of Warranties:**
THE SERVICE IS PROVIDED "AS IS" WITHOUT WARRANTIES OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT.

**Limitation of Liability:**
TO THE MAXIMUM EXTENT PERMITTED BY LAW, VAULTA SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, OR ANY LOSS OF PROFITS OR REVENUES.

**Maximum Liability:**
Our total liability shall not exceed the amounts paid by you in the twelve (12) months preceding the claim.

**Exceptions:**
These limitations do not apply where prohibited by law or in cases of gross negligence or willful misconduct.`
    },
    {
      icon: Shield,
      title: "9. NIST 800-53 Compliance Commitment",
      content: `Vaulta is committed to maintaining NIST 800-53 Rev. 5 compliance:

**Security Controls:**
- Access Control (AC): Strict authentication and authorization
- Audit and Accountability (AU): Comprehensive logging
- Identification and Authentication (IA): MFA enforcement
- System and Communications Protection (SC): End-to-end encryption

**User Responsibilities:**
- Enable all recommended security features
- Maintain secure access to your devices
- Report security concerns promptly

**Compliance Verification:**
- Regular third-party security audits
- Penetration testing performed quarterly
- Compliance certificates available upon request

For compliance inquiries: compliance@vaulta.io`
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
              <FileText className="w-4 h-4 text-primary" />
              <span className="text-sm font-mono text-primary">LEGAL AGREEMENT</span>
            </div>
            
            <h1 className="text-4xl md:text-5xl font-display font-bold mb-6">
              Terms of <span className="text-primary">Service</span>
            </h1>
            
            <p className="text-xl text-muted-foreground font-rajdhani">
              Please read these terms carefully before using Vaulta's secure document 
              management platform.
            </p>
            
            <p className="mt-4 text-sm text-muted-foreground font-mono">
              Last updated: January 22, 2026 | Effective: January 22, 2026
            </p>
          </motion.div>
        </div>
      </section>

      {/* Quick Summary */}
      <section className="py-8 border-y border-border bg-card/30">
        <div className="container mx-auto px-6 max-w-4xl">
          <div className="flex items-start gap-4">
            <AlertTriangle className="w-6 h-6 text-warning-amber flex-shrink-0 mt-1" />
            <div>
              <h3 className="font-display font-bold text-foreground mb-2">Quick Summary</h3>
              <p className="text-sm text-muted-foreground font-rajdhani">
                By using Vaulta, you agree to use the service lawfully, maintain account security, 
                and not store prohibited content. We provide end-to-end encrypted security but the service 
                is provided "as-is." You retain ownership of your documents. These terms may be 
                updated with notice.
              </p>
            </div>
          </div>
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
            <h3 className="text-xl font-display font-bold mb-4">Legal Questions?</h3>
            <p className="text-muted-foreground font-rajdhani mb-4">
              Contact our legal team at{" "}
              <a href="mailto:legal@vaulta.io" className="text-primary hover:underline">
                legal@vaulta.io
              </a>
            </p>
            <p className="text-sm text-muted-foreground font-mono">
              Response time: 3-5 business days
            </p>
          </motion.div>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default TermsOfService;
