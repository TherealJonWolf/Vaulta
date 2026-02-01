import { motion } from "framer-motion";
import { Check, Crown, Shield, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useNavigate } from "react-router-dom";

const PricingSection = () => {
  const navigate = useNavigate();

  const plans = [
    {
      name: "Free",
      price: "$0",
      period: "forever",
      description: "Get started with secure document storage",
      icon: Shield,
      features: [
        "Up to 3 documents",
        "256-bit AES encryption",
        "Secure cloud storage",
        "Basic AI assistant",
      ],
      cta: "Get Started",
      popular: false,
    },
    {
      name: "Premium",
      price: "$9.99",
      period: "/month",
      description: "Unlimited storage for power users",
      icon: Crown,
      features: [
        "Unlimited documents",
        "256-bit AES encryption",
        "Priority cloud storage",
        "Advanced AI Oracle",
        "Institution connections",
        "Priority support",
      ],
      cta: "Upgrade Now",
      popular: true,
    },
  ];

  return (
    <section id="pricing" className="py-24 relative overflow-hidden">
      {/* Background effects */}
      <div className="absolute inset-0 grid-bg opacity-30" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-primary/5 rounded-full blur-3xl" />

      <div className="container mx-auto px-6 relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <Badge className="mb-4 bg-primary/10 text-primary border-primary/30 font-mono">
            <Sparkles size={12} className="mr-1" />
            Simple Pricing
          </Badge>
          <h2 className="font-display text-4xl md:text-5xl font-bold mb-4">
            <span className="gradient-text">Choose Your</span>{" "}
            <span className="text-foreground">Protection Level</span>
          </h2>
          <p className="text-muted-foreground font-rajdhani text-lg max-w-2xl mx-auto">
            Start free with essential security. Upgrade for unlimited storage and premium features.
          </p>
        </motion.div>

        <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
          {plans.map((plan, index) => (
            <motion.div
              key={plan.name}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.1 }}
            >
              <Card
                className={`relative h-full cyber-border bg-card/50 backdrop-blur ${
                  plan.popular ? "border-primary/50 shadow-lg shadow-primary/10" : ""
                }`}
              >
                {plan.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <Badge className="bg-primary text-primary-foreground font-mono">
                      Most Popular
                    </Badge>
                  </div>
                )}
                <CardHeader className="text-center pb-2">
                  <div
                    className={`mx-auto w-14 h-14 rounded-xl flex items-center justify-center mb-4 ${
                      plan.popular
                        ? "bg-primary/20 border border-primary/40"
                        : "bg-muted border border-border"
                    }`}
                  >
                    <plan.icon
                      className={plan.popular ? "text-primary" : "text-muted-foreground"}
                      size={28}
                    />
                  </div>
                  <CardTitle className="font-display text-2xl">{plan.name}</CardTitle>
                  <CardDescription className="font-rajdhani">
                    {plan.description}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="text-center">
                    <span className="text-4xl font-bold gradient-text">{plan.price}</span>
                    <span className="text-muted-foreground font-mono text-sm ml-1">
                      {plan.period}
                    </span>
                  </div>

                  <ul className="space-y-3">
                    {plan.features.map((feature, i) => (
                      <li key={i} className="flex items-center gap-3 text-sm font-rajdhani">
                        <div className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                          <Check className="text-primary" size={12} />
                        </div>
                        {feature}
                      </li>
                    ))}
                  </ul>

                  <Button
                    onClick={() => navigate("/auth")}
                    className={`w-full font-rajdhani font-bold ${
                      plan.popular
                        ? "btn-gradient text-primary-foreground"
                        : "bg-muted hover:bg-muted/80 text-foreground"
                    }`}
                  >
                    {plan.cta}
                  </Button>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>

        <motion.p
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ delay: 0.3 }}
          className="text-center text-xs text-muted-foreground font-mono mt-8"
        >
          All plans include end-to-end encryption • Cancel anytime • Secure payments via Stripe
        </motion.p>
      </div>
    </section>
  );
};

export default PricingSection;
