import { motion } from "framer-motion";
import { Home, Building2, ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";

export const HousingQualificationSection = () => {
  return (
    <section id="housing" className="py-24 relative">
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
            HOUSING QUALIFICATION{" "}
            <span className="gradient-text">WITHOUT GUARANTORS</span>
          </h2>
        </motion.div>

        <div className="grid md:grid-cols-2 gap-8 max-w-5xl mx-auto">
          {/* Applicant Message */}
          <motion.div
            className="p-8 rounded-xl border border-border bg-card/50 backdrop-blur"
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
          >
            <div className="w-12 h-12 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center mb-6">
              <Home size={24} className="text-primary" />
            </div>
            <h3 className="font-display text-lg font-semibold text-foreground mb-4">
              For Applicants
            </h3>
            <p className="text-muted-foreground font-rajdhani leading-relaxed">
              Vaulta supports international housing applicants by documenting consistent identity, income, and rental behavior. Applicants presenting at least twelve (12) months of documented foreign rent history, a valid passport with active visa enrollment, an income source, and no adverse background within available records may qualify for standard leasing terms.
            </p>
          </motion.div>

          {/* Property Company Message */}
          <motion.div
            className="p-8 rounded-xl border border-border bg-card/50 backdrop-blur"
            initial={{ opacity: 0, x: 20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.1 }}
          >
            <div className="w-12 h-12 rounded-lg bg-accent/10 border border-accent/20 flex items-center justify-center mb-6">
              <Building2 size={24} className="text-accent" />
            </div>
            <h3 className="font-display text-lg font-semibold text-foreground mb-4">
              For Property Companies
            </h3>
            <p className="text-muted-foreground font-rajdhani leading-relaxed">
              Vaulta enables property companies to approve qualified international renters with standard security deposits instead of guarantors — increasing occupancy without increasing residual risk. Final lease approval decisions remain solely with the property company.
            </p>
          </motion.div>
        </div>

        {/* Learn more link */}
        <motion.div
          className="text-center mt-10"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          <Link
            to="/what-vaulta-is"
            className="inline-flex items-center gap-2 text-sm text-primary hover:text-primary/80 font-rajdhani transition-colors"
          >
            Learn more about what Vaulta does — and does not do
            <ArrowRight size={14} />
          </Link>
        </motion.div>
      </div>
    </section>
  );
};
