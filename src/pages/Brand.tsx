import { useState } from "react";
import { motion } from "framer-motion";
import { Shield, Eye, Globe, Lock, Fingerprint, Zap, ArrowRight, FileSearch, Bug, Hash, Database, FileText, Users, Brain, ShieldBan, Bell } from "lucide-react";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { VaultaLogo } from "@/components/VaultaLogo";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";

const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.7, delay: i * 0.15, ease: "easeOut" as const },
  }),
};

const values = [
  {
    icon: Shield,
    title: "Sovereignty First",
    description:
      "Every individual deserves absolute ownership of their digital identity. No government, corporation, or third party should hold the keys to who you are.",
  },
  {
    icon: Eye,
    title: "Radical Transparency",
    description:
      "Our security protocols, compliance standards, and data handling practices are built in the open. Trust is earned through visibility, not promises.",
  },
  {
    icon: Globe,
    title: "Borderless by Design",
    description:
      "Identity doesn't stop at borders. Vaulta™ is built for immigrants, global citizens, and anyone who refuses to let geography define their access.",
  },
  {
    icon: Lock,
    title: "Zero-Knowledge Architecture",
    description:
      "We can't see your data. We can't access your documents. Your vault is yours alone — encrypted end-to-end with keys only you control.",
  },
  {
    icon: Fingerprint,
    title: "Trust, Verified",
    description:
      "Through government ID verification, biometric liveness checks, and AI-powered fraud detection, we don't assume trust — we prove it.",
  },
  {
    icon: Zap,
    title: "Relentless Innovation",
    description:
      "The threats evolve daily. So do we. From threat simulation to AI oracles, Vaulta™ stays ahead of the curve so you never fall behind.",
  },
];

const timeline = [
  { year: "THE VISION", text: "A world where digital identity is a human right — not a privilege granted by institutions." },
  { year: "THE PROBLEM", text: "Billions of people lack secure, portable, verifiable identity. Documents get lost. Systems get breached. People get left behind." },
  { year: "THE ANSWER", text: "Vaulta™ — a sovereign digital vault that puts military-grade security in the hands of everyday people." },
  { year: "THE FUTURE", text: "A decentralized trust layer where your identity, documents, and credentials travel with you — everywhere, always." },
];

export default function Brand() {
  const navigate = useNavigate();
  const [hoveredLayer, setHoveredLayer] = useState<number | null>(null);

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      {/* Hero */}
      <section className="relative pt-32 pb-24 overflow-hidden">
        <div className="absolute inset-0 grid-bg opacity-40" />
        <div className="absolute inset-0" style={{ background: "var(--gradient-glow)" }} />

        <div className="container mx-auto px-6 relative z-10 text-center">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8 }}
            className="flex justify-center mb-8"
          >
            <VaultaLogo size="lg" />
          </motion.div>

          <motion.h1
            className="font-display text-4xl md:text-6xl lg:text-7xl font-bold mb-6 gradient-text"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.3 }}
          >
            THE BRAND BEHIND
            <br />
            THE SHIELD
          </motion.h1>

          <motion.p
            className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto font-rajdhani"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.5 }}
          >
            Vaulta™ isn't just a product. It's a declaration that your identity
            belongs to you — and no one else.
          </motion.p>
        </div>
      </section>

      {/* Origin Story / Timeline */}
      <section className="py-24 relative">
        <div className="container mx-auto px-6 max-w-4xl">
          <motion.h2
            className="font-display text-3xl md:text-4xl font-bold text-center mb-16 gradient-text"
            variants={fadeUp}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            custom={0}
          >
            OUR ORIGIN
          </motion.h2>

          <div className="relative">
            {/* Vertical line */}
            <div className="absolute left-6 md:left-1/2 top-0 bottom-0 w-px bg-gradient-to-b from-primary via-accent to-transparent" />

            {timeline.map((item, i) => (
              <motion.div
                key={item.year}
                className={`relative flex items-start gap-6 mb-16 ${
                  i % 2 === 0 ? "md:flex-row" : "md:flex-row-reverse"
                }`}
                variants={fadeUp}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true }}
                custom={i}
              >
                {/* Dot */}
                <div className="absolute left-6 md:left-1/2 -translate-x-1/2 w-3 h-3 rounded-full bg-primary glow-cyan z-10" />

                {/* Content */}
                <div
                  className={`ml-16 md:ml-0 md:w-1/2 ${
                    i % 2 === 0 ? "md:pr-16 md:text-right" : "md:pl-16"
                  }`}
                >
                  <span className="font-display text-sm text-primary tracking-widest">
                    {item.year}
                  </span>
                  <p className="text-foreground/80 mt-2 text-lg font-rajdhani leading-relaxed">
                    {item.text}
                  </p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Mission Statement */}
      <section className="py-24 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-primary/5 to-transparent" />
        <div className="container mx-auto px-6 relative z-10">
          <motion.div
            className="max-w-3xl mx-auto text-center"
            variants={fadeUp}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            custom={0}
          >
            <h2 className="font-display text-3xl md:text-4xl font-bold mb-8 gradient-text">
              OUR MISSION
            </h2>
            <div className="cyber-border rounded-xl p-8 md:p-12">
              <p className="text-xl md:text-2xl text-foreground/90 font-rajdhani leading-relaxed italic">
                "To empower every person on Earth with sovereign control over
                their digital identity — making security accessible,
                verification trustworthy, and personal data truly personal."
              </p>
              <div className="mt-6 flex items-center justify-center gap-2">
                <div className="status-dot active" />
                <span className="text-sm text-muted-foreground font-rajdhani tracking-widest uppercase">
                  Active Mission
                </span>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Values */}
      <section className="py-24">
        <div className="container mx-auto px-6">
          <motion.h2
            className="font-display text-3xl md:text-4xl font-bold text-center mb-16 gradient-text"
            variants={fadeUp}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            custom={0}
          >
            WHAT WE STAND FOR
          </motion.h2>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
            {values.map((v, i) => (
              <motion.div
                key={v.title}
                className="cyber-border rounded-xl p-6 card-hover"
                variants={fadeUp}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true }}
                custom={i}
              >
                <div className="w-12 h-12 rounded-lg border border-primary/30 bg-primary/10 flex items-center justify-center mb-4">
                  <v.icon size={24} className="text-primary" />
                </div>
                <h3 className="font-display text-lg font-semibold text-foreground mb-2">
                  {v.title}
                </h3>
                <p className="text-muted-foreground font-rajdhani leading-relaxed">
                  {v.description}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* 7 Layers of Protection */}
      <section className="py-24 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-primary/5 to-transparent" />
        <div className="container mx-auto px-6 relative z-10">
          <motion.h2
            className="font-display text-3xl md:text-4xl font-bold text-center mb-4 gradient-text"
            variants={fadeUp}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            custom={0}
          >
            9 LAYERS OF PROTECTION
          </motion.h2>
          <motion.p
            className="text-muted-foreground text-center max-w-2xl mx-auto mb-16 font-rajdhani text-lg"
            variants={fadeUp}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            custom={1}
          >
            Every document uploaded to Vaulta™ passes through our proprietary 9-layer fraud detection pipeline before it ever touches your vault.
          </motion.p>

          <div className="max-w-4xl mx-auto">
            <div className="space-y-4">
              {[
                { icon: FileSearch, layer: "01", title: "Magic-Byte Signature Verification", description: "We verify the true file type at the binary level — no disguised executables or spoofed formats get through." },
                { icon: Bug, layer: "02", title: "Malicious Content Scanning", description: "Every file is scanned for embedded XSS, SQL injection, and other attack vectors before processing." },
                { icon: Hash, layer: "03", title: "SHA-256 Fingerprinting", description: "Each document receives a unique cryptographic fingerprint, creating an immutable record of authenticity." },
                { icon: Database, layer: "04", title: "EXIF & Metadata Analysis", description: "We analyze embedded metadata to detect tampering, editing history, and suspicious modifications." },
                { icon: FileText, layer: "05", title: "PDF Structural Validation", description: "Document structure is validated against known standards to catch manipulated or reconstructed files." },
                { icon: Users, layer: "06", title: "Cross-User Duplicate Detection", description: "Forgery attempts are flagged when the same document appears across multiple accounts." },
                { icon: Brain, layer: "07", title: "AI Authenticity Analysis", description: "Our AI engine examines visual inconsistencies, font anomalies, and seal irregularities that humans miss." },
                { icon: ShieldBan, layer: "08", title: "Account Suspension & Blacklisting", description: "Detected fraud triggers automated lockdown — the upload is blocked, the account suspended, and the email blacklisted." },
                { icon: Bell, layer: "09", title: "Admin Alert & Incident Logging", description: "Real-time admin notifications and a full audit trail are generated for every flagged event, ensuring total accountability." },
              ].map((item, i, arr) => (
                <div key={item.layer}>
                  <div className="flex gap-6 md:gap-8">
                    {/* Progress rail number - aligned to card */}
                    <div className="hidden md:flex flex-col items-center flex-shrink-0">
                      <motion.div
                        className={`w-10 h-10 rounded-full border-2 flex items-center justify-center font-display text-sm font-bold relative transition-all duration-300 ${
                          hoveredLayer === i
                            ? "border-primary bg-primary text-primary-foreground scale-110 shadow-[0_0_20px_hsl(var(--primary)/0.6)]"
                            : "border-primary/40 bg-primary/10 text-primary"
                        }`}
                        initial={{ scale: 0, opacity: 0 }}
                        whileInView={{ scale: 1, opacity: 1 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.4, delay: i * 0.12 }}
                      >
                        {i + 1}
                        <motion.div
                          className="absolute inset-0 rounded-full border-2 border-primary/60"
                          initial={{ scale: 1, opacity: 0.6 }}
                          whileInView={{ scale: 1.5, opacity: 0 }}
                          viewport={{ once: true }}
                          transition={{ duration: 0.8, delay: i * 0.12 + 0.2 }}
                        />
                      </motion.div>
                    </div>

                    {/* Layer card */}
                    <motion.div
                      className="flex-1 cyber-border rounded-xl p-5 flex items-start gap-5 card-hover cursor-pointer"
                      variants={fadeUp}
                      initial="hidden"
                      whileInView="visible"
                      viewport={{ once: true }}
                      custom={i}
                      onMouseEnter={() => setHoveredLayer(i)}
                      onMouseLeave={() => setHoveredLayer(null)}
                    >
                      {/* Mobile layer number */}
                      <div className="md:hidden flex-shrink-0 w-10 h-10 rounded-full border-2 border-primary/40 bg-primary/10 flex items-center justify-center font-display text-sm font-bold text-primary">
                        {i + 1}
                      </div>
                      <div className="hidden md:flex flex-shrink-0 w-14 h-14 rounded-lg border border-primary/30 bg-primary/10 items-center justify-center">
                        <item.icon size={24} className="text-primary" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-1">
                          <span className="font-display text-xs text-primary tracking-widest">LAYER {item.layer}</span>
                          <motion.div
                            className="h-px flex-1 bg-gradient-to-r from-primary/40 to-transparent"
                            initial={{ scaleX: 0 }}
                            whileInView={{ scaleX: 1 }}
                            viewport={{ once: true }}
                            transition={{ duration: 0.6, delay: i * 0.1 + 0.3 }}
                            style={{ transformOrigin: "left" }}
                          />
                        </div>
                        <h3 className="font-display text-lg font-semibold text-foreground mb-1">{item.title}</h3>
                        <p className="text-muted-foreground font-rajdhani leading-relaxed">{item.description}</p>
                      </div>
                    </motion.div>
                  </div>

                  {/* Connector line between items */}
                  {i < arr.length - 1 && (
                    <div className="hidden md:flex justify-start pl-[18px]">
                      <motion.div
                        className="w-px h-4 bg-gradient-to-b from-primary/60 to-primary/20 origin-top"
                        initial={{ scaleY: 0 }}
                        whileInView={{ scaleY: 1 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.4, delay: i * 0.12 + 0.15, ease: "easeOut" }}
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Completion badge */}
            <motion.div
              className="flex items-center justify-center gap-3 pt-8"
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 1 }}
            >
              <div className="status-dot active" />
              <span className="font-display text-sm text-primary tracking-widest">ALL LAYERS ACTIVE</span>
              <div className="status-dot active" />
            </motion.div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24 relative">
        <div className="absolute inset-0" style={{ background: "var(--gradient-glow)" }} />
        <div className="container mx-auto px-6 relative z-10 text-center">
          <motion.div
            variants={fadeUp}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            custom={0}
          >
            <h2 className="font-display text-3xl md:text-5xl font-bold mb-4 gradient-text">
              YOUR WORLD, SECURED.
            </h2>
            <p className="text-muted-foreground text-lg mb-8 max-w-xl mx-auto font-rajdhani">
              Join the movement toward sovereign digital identity.
            </p>
            <Button
              className="btn-gradient font-rajdhani font-semibold tracking-wider text-primary-foreground text-lg px-8 py-6"
              onClick={() => navigate("/auth?mode=signup")}
            >
              INITIALIZE YOUR VAULT <ArrowRight className="ml-2" size={20} />
            </Button>
          </motion.div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
