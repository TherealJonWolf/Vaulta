import { motion } from "framer-motion";
import { Shield, Cpu, Globe, ArrowRight } from "lucide-react";
import { useNavigate } from "react-router-dom";

const features = [
  {
    icon: Shield,
    title: "Sovereign Identity Vault",
    description:
      "Store passports, birth certificates, SSN cards, green cards, and all vital documents. Selectively share with landlords, banks, and institutions while maintaining complete control.",
    color: "primary",
  },
  {
    icon: Cpu,
    title: "The AI Oracle",
    description:
      "24/7 AI-powered guidance for navigating immigration offices, credit unions, and institutional systems. Never face bureaucratic complexity alone.",
    color: "accent",
  },
  {
    icon: Globe,
    title: "Borderless Infrastructure",
    description:
      "When you cross borders, your credibility shouldn't reset. Ingest credentials from any institution and build portable trust that travels with you.",
    color: "primary",
  },
];

export const FeaturesSection = () => {
  const navigate = useNavigate();

  return (
    <section id="mission" className="py-24 relative">
      <div className="absolute inset-0 grid-bg opacity-30" />
      
      <div className="container mx-auto px-6 relative z-10">
        <motion.div
          className="text-center mb-16"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
        >
          <h2 className="font-display text-3xl md:text-4xl font-bold gradient-text mb-4">
            YOUR DIGITAL FORTRESS
          </h2>
          <p className="text-muted-foreground max-w-2xl mx-auto font-rajdhani text-lg">
            Military-grade protection for your most sensitive documents with end-to-end encryption
          </p>
        </motion.div>

        <div className="grid md:grid-cols-3 gap-8">
          {features.map((feature, index) => {
            const Icon = feature.icon;
            return (
              <motion.div
                key={feature.title}
                className="cyber-border rounded-xl p-8 card-hover"
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: index * 0.1 }}
              >
                <div
                  className={`w-16 h-16 rounded-lg flex items-center justify-center mb-6 ${
                    feature.color === "accent"
                      ? "bg-accent/10 border border-accent/30"
                      : "bg-primary/10 border border-primary/30"
                  }`}
                >
                  <Icon
                    size={32}
                    className={feature.color === "accent" ? "text-accent" : "text-primary"}
                  />
                </div>

                <h3
                  className={`font-display text-xl font-bold mb-4 ${
                    feature.color === "accent" ? "text-accent" : "text-primary"
                  }`}
                >
                  {feature.title}
                </h3>

                <p className="text-muted-foreground font-rajdhani leading-relaxed mb-6">
                  {feature.description}
                </p>

                <button
                  onClick={() => navigate("/auth?mode=signup")}
                  className={`flex items-center gap-2 font-rajdhani font-semibold transition-colors ${
                    feature.color === "accent"
                      ? "text-accent hover:text-accent/80"
                      : "text-primary hover:text-primary/80"
                  }`}
                >
                  Get Started
                  <ArrowRight size={16} />
                </button>
              </motion.div>
            );
          })}
        </div>

        {/* CTA */}
        <motion.div
          className="flex justify-center mt-16"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.3 }}
        >
          <button
            onClick={() => navigate("/auth?mode=signup")}
            className="btn-gradient font-rajdhani font-bold tracking-widest text-lg px-12 py-4 rounded-lg text-primary-foreground"
          >
            INITIALIZE YOUR VAULT
          </button>
        </motion.div>
      </div>
    </section>
  );
};
