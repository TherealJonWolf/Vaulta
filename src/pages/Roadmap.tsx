import { motion } from "framer-motion";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { CheckCircle, Clock, Lock, Shield, Zap, Globe, Users, FileText } from "lucide-react";

const roadmapPhases = [
  {
    phase: "Phase 1",
    title: "Foundation",
    status: "completed",
    timeline: "Q1 2026",
    items: [
      { text: "AES-256-GCM client-side encryption (SC-13)", completed: true },
      { text: "Multi-factor authentication via TOTP (IA-2)", completed: true },
      { text: "Secure document storage with zero-knowledge architecture (SC-28)", completed: true },
      { text: "Comprehensive audit logging (AU-2, AU-3)", completed: true },
      { text: "Session management and monitoring (AC-2)", completed: true }
    ]
  },
  {
    phase: "Phase 2",
    title: "Enhanced Security",
    status: "in-progress",
    timeline: "Q2 2026",
    items: [
      { text: "Hardware security key support (IA-2)", completed: true },
      { text: "Advanced threat detection (SI-4)", completed: false },
      { text: "Automated security assessments (CA-7)", completed: false },
      { text: "Enhanced session controls with device binding (AC-11)", completed: false },
      { text: "Real-time security alerts and notifications (IR-6)", completed: false }
    ]
  },
  {
    phase: "Phase 3",
    title: "Enterprise Features",
    status: "planned",
    timeline: "Q3 2026",
    items: [
      { text: "Single Sign-On (SSO) integration (IA-8)", completed: false },
      { text: "Role-based access control (AC-3)", completed: false },
      { text: "Team workspaces with granular permissions (AC-6)", completed: false },
      { text: "API access for enterprise integration (SC-8)", completed: false },
      { text: "Custom retention policies (AU-11)", completed: false }
    ]
  },
  {
    phase: "Phase 4",
    title: "Compliance & Certification",
    status: "planned",
    timeline: "Q4 2026",
    items: [
      { text: "SOC 2 Type II certification", completed: false },
      { text: "HIPAA compliance documentation", completed: false },
      { text: "FedRAMP authorization pathway", completed: false },
      { text: "GDPR compliance tools", completed: false },
      { text: "Automated compliance reporting (CA-7)", completed: false }
    ]
  }
];

const getStatusStyles = (status: string) => {
  switch (status) {
    case 'completed':
      return 'bg-secure-green/20 text-secure-green border-secure-green/30';
    case 'in-progress':
      return 'bg-primary/20 text-primary border-primary/30';
    default:
      return 'bg-muted/20 text-muted-foreground border-muted';
  }
};

const getStatusLabel = (status: string) => {
  switch (status) {
    case 'completed':
      return 'COMPLETED';
    case 'in-progress':
      return 'IN PROGRESS';
    default:
      return 'PLANNED';
  }
};

export default function Roadmap() {
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
              ROADMAP
            </h1>
            <p className="text-muted-foreground font-rajdhani text-lg mb-12 max-w-2xl">
              Our security-first development roadmap aligned with NIST 800-53 control implementation.
            </p>

            {/* Vision Statement */}
            <section className="mb-16">
              <div className="bg-card/50 border border-border rounded-lg p-6">
                <h2 className="font-display text-xl font-bold text-foreground mb-4 flex items-center gap-3">
                  <Shield className="w-6 h-6 text-primary" />
                  OUR VISION
                </h2>
                <p className="text-muted-foreground font-rajdhani leading-relaxed">
                  Vaulta is committed to building the most secure document management platform available. 
                  Each feature we develop is mapped to NIST 800-53 security controls, ensuring that 
                  functionality never compromises security. Our roadmap prioritizes privacy, compliance, 
                  and user sovereignty over convenience.
                </p>
              </div>
            </section>

            {/* Roadmap Timeline */}
            <section className="mb-16">
              <h2 className="font-display text-2xl font-bold text-foreground mb-8 tracking-wider">
                DEVELOPMENT TIMELINE
              </h2>
              <div className="space-y-8">
                {roadmapPhases.map((phase, phaseIndex) => (
                  <motion.div
                    key={phase.phase}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.5, delay: phaseIndex * 0.15 }}
                    className="relative"
                  >
                    {/* Timeline connector */}
                    {phaseIndex < roadmapPhases.length - 1 && (
                      <div className="absolute left-6 top-16 bottom-0 w-px bg-border -mb-8 hidden md:block" />
                    )}
                    
                    <div className="bg-card/50 border border-border rounded-lg p-6 hover:border-primary/50 transition-colors">
                      <div className="flex flex-wrap items-center gap-4 mb-4">
                        <div className={`p-2 rounded-lg ${phase.status === 'completed' ? 'bg-secure-green/20' : phase.status === 'in-progress' ? 'bg-primary/20' : 'bg-muted/20'}`}>
                          {phase.status === 'completed' ? (
                            <CheckCircle className="w-6 h-6 text-secure-green" />
                          ) : phase.status === 'in-progress' ? (
                            <Zap className="w-6 h-6 text-primary" />
                          ) : (
                            <Clock className="w-6 h-6 text-muted-foreground" />
                          )}
                        </div>
                        <div>
                          <div className="flex items-center gap-3">
                            <span className="font-mono text-sm text-muted-foreground">{phase.phase}</span>
                            <span className={`text-xs font-mono px-2 py-1 rounded border ${getStatusStyles(phase.status)}`}>
                              {getStatusLabel(phase.status)}
                            </span>
                          </div>
                          <h3 className="font-display text-xl font-bold text-foreground">
                            {phase.title}
                          </h3>
                        </div>
                        <span className="font-mono text-sm text-primary ml-auto">{phase.timeline}</span>
                      </div>
                      
                      <div className="grid md:grid-cols-2 gap-3 pl-2">
                        {phase.items.map((item, itemIndex) => (
                          <div
                            key={itemIndex}
                            className={`flex items-start gap-2 text-sm ${item.completed ? 'text-foreground' : 'text-muted-foreground'}`}
                          >
                            {item.completed ? (
                              <CheckCircle className="w-4 h-4 text-secure-green flex-shrink-0 mt-0.5" />
                            ) : (
                              <div className="w-4 h-4 rounded-full border border-muted-foreground flex-shrink-0 mt-0.5" />
                            )}
                            <span className="font-rajdhani">{item.text}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </section>

            {/* Feedback Section */}
            <section>
              <div className="bg-primary/10 border border-primary/30 rounded-lg p-6 text-center">
                <h3 className="font-display text-xl font-bold text-foreground mb-3">
                  Have Feature Requests?
                </h3>
                <p className="text-muted-foreground font-rajdhani mb-4 max-w-xl mx-auto">
                  We prioritize security features based on user needs and compliance requirements. 
                  Share your requirements with us.
                </p>
                <a
                  href="mailto:help@tryvaulta.com?subject=Feature Request"
                  className="inline-flex items-center gap-2 font-mono text-primary hover:underline"
                >
                  help@tryvaulta.com
                </a>
              </div>
            </section>
          </motion.div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
