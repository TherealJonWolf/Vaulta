import { motion } from "framer-motion";
import { Shield, Quote, Star, Building2, User, Briefcase } from "lucide-react";

const testimonials = [
  {
    quote: "Vaulta transformed how we handle sensitive client documents. The NIST-800-53 compliance gave our legal team complete peace of mind.",
    author: "Sarah Chen",
    role: "Chief Security Officer",
    company: "Meridian Financial",
    icon: Building2,
    rating: 5,
  },
  {
    quote: "Finally, a document vault that takes security as seriously as we do. The end-to-end encryption and MFA are exactly what healthcare requires.",
    author: "Dr. Marcus Webb",
    role: "Director of IT Security",
    company: "Pacific Health Network",
    icon: Briefcase,
    rating: 5,
  },
  {
    quote: "We evaluated 12 solutions before choosing Vaulta. Nothing else came close to their security architecture and zero-knowledge encryption.",
    author: "Elena Rodriguez",
    role: "VP of Compliance",
    company: "Atlas Capital Partners",
    icon: User,
    rating: 5,
  },
];

const stats = [
  { value: "256-BIT", label: "AES Encryption" },
  { value: "99.99%", label: "Uptime SLA" },
  { value: "500K+", label: "Documents Secured" },
  { value: "SOC 2", label: "Type II Certified" },
];

export const TestimonialsSection = () => {
  return (
    <section className="py-24 relative overflow-hidden">
      {/* Background effects */}
      <div className="absolute inset-0 grid-bg opacity-30" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-primary/5 rounded-full blur-3xl" />
      
      <div className="container mx-auto px-6 relative z-10">
        {/* Section header */}
        <motion.div
          className="text-center mb-16"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
        >
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-primary/30 bg-primary/5 mb-6">
            <Shield className="w-4 h-4 text-primary" />
            <span className="text-sm font-mono text-primary">TRUSTED BY SECURITY LEADERS</span>
          </div>
          
          <h2 className="text-4xl md:text-5xl font-display font-bold mb-4">
            <span className="text-foreground">Enterprise-Grade Trust</span>
          </h2>
          
          <p className="text-xl text-muted-foreground font-rajdhani max-w-2xl mx-auto">
            Security professionals and compliance officers choose Vaulta for mission-critical document protection
          </p>
        </motion.div>

        {/* Stats bar */}
        <motion.div
          className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-16"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.2 }}
        >
          {stats.map((stat, index) => (
            <div
              key={stat.label}
              className="text-center p-6 rounded-lg border border-border bg-card/50 cyber-border"
            >
              <div className="text-2xl md:text-3xl font-display font-bold text-primary mb-1">
                {stat.value}
              </div>
              <div className="text-sm text-muted-foreground font-mono">
                {stat.label}
              </div>
            </div>
          ))}
        </motion.div>

        {/* Testimonials grid */}
        <div className="grid md:grid-cols-3 gap-6">
          {testimonials.map((testimonial, index) => (
            <motion.div
              key={testimonial.author}
              className="relative p-6 rounded-xl border border-border bg-card/80 backdrop-blur-sm card-hover group"
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: index * 0.15 }}
            >
              {/* Corner accent */}
              <div className="absolute top-0 right-0 w-20 h-20 overflow-hidden">
                <div className="absolute top-0 right-0 w-[2px] h-8 bg-gradient-to-b from-primary/50 to-transparent" />
                <div className="absolute top-0 right-0 h-[2px] w-8 bg-gradient-to-l from-primary/50 to-transparent" />
              </div>

              {/* Quote icon */}
              <div className="mb-4">
                <Quote className="w-8 h-8 text-primary/30" />
              </div>

              {/* Rating */}
              <div className="flex gap-1 mb-4">
                {[...Array(testimonial.rating)].map((_, i) => (
                  <Star
                    key={i}
                    className="w-4 h-4 fill-primary text-primary"
                  />
                ))}
              </div>

              {/* Quote text */}
              <blockquote className="text-foreground font-rajdhani text-lg leading-relaxed mb-6">
                "{testimonial.quote}"
              </blockquote>

              {/* Author info */}
              <div className="flex items-center gap-4 pt-4 border-t border-border">
                <div className="w-12 h-12 rounded-lg bg-primary/10 border border-primary/30 flex items-center justify-center">
                  <testimonial.icon className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <div className="font-display font-semibold text-foreground">
                    {testimonial.author}
                  </div>
                  <div className="text-sm text-muted-foreground font-rajdhani">
                    {testimonial.role}
                  </div>
                  <div className="text-xs text-primary font-mono">
                    {testimonial.company}
                  </div>
                </div>
              </div>

              {/* Hover glow effect */}
              <div className="absolute inset-0 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none">
                <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-primary/5 to-transparent" />
              </div>
            </motion.div>
          ))}
        </div>

        {/* Trust badges */}
        <motion.div
          className="mt-16 text-center"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.5 }}
        >
          <p className="text-sm text-muted-foreground font-mono mb-6">
            COMPLIANCE & CERTIFICATIONS
          </p>
          <div className="flex flex-wrap justify-center gap-6">
            {["NIST 800-53", "SOC 2 Type II", "HIPAA", "GDPR", "ISO 27001"].map(
              (badge) => (
                <div
                  key={badge}
                  className="px-4 py-2 rounded border border-border bg-card/50 text-sm font-mono text-muted-foreground hover:text-primary hover:border-primary/50 transition-colors"
                >
                  {badge}
                </div>
              )
            )}
          </div>
        </motion.div>
      </div>
    </section>
  );
};
