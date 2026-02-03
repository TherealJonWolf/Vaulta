import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Shield, Quote, Star, Send, CheckCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

interface Testimonial {
  id: string;
  author_name: string;
  role: string;
  company: string;
  quote: string;
  rating: number;
}

const stats = [
  { value: "256-BIT", label: "AES Encryption" },
  { value: "99.99%", label: "Uptime SLA" },
  { value: "SOC 2", label: "Type II Certified" },
  { value: "NIST", label: "800-53 Compliant" },
];

export const TestimonialsSection = () => {
  const [testimonials, setTestimonials] = useState<Testimonial[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [formData, setFormData] = useState({
    author_name: "",
    role: "",
    company: "",
    quote: "",
    rating: 5,
  });

  useEffect(() => {
    fetchTestimonials();
  }, []);

  const fetchTestimonials = async () => {
    if (!supabase) return;
    
    const { data, error } = await supabase
      .from("testimonials")
      .select("*")
      .order("created_at", { ascending: false });

    if (!error && data) {
      setTestimonials(data);
    }
    setLoading(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase) return;

    setSubmitting(true);

    const { error } = await supabase.from("testimonials").insert({
      author_name: formData.author_name.trim(),
      role: formData.role.trim(),
      company: formData.company.trim(),
      quote: formData.quote.trim(),
      rating: formData.rating,
    });

    setSubmitting(false);

    if (error) {
      toast({
        title: "Error",
        description: "Failed to submit testimonial. Please try again.",
        variant: "destructive",
      });
    } else {
      setSubmitted(true);
      setFormData({ author_name: "", role: "", company: "", quote: "", rating: 5 });
      toast({
        title: "Thank you!",
        description: "Your testimonial has been submitted for review.",
      });
    }
  };

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
            <span className="text-sm font-mono text-primary">SHARE YOUR EXPERIENCE</span>
          </div>
          
          <h2 className="text-4xl md:text-5xl font-display font-bold mb-4">
            <span className="text-foreground">What Our Users Say</span>
          </h2>
          
          <p className="text-xl text-muted-foreground font-rajdhani max-w-2xl mx-auto">
            Join the community of security-conscious professionals trusting Vaulta with their sensitive documents
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
          {stats.map((stat) => (
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

        {/* Testimonials grid + Submit form */}
        <div className="grid lg:grid-cols-2 gap-8">
          {/* Left side - Existing testimonials or empty state */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            {loading ? (
              <div className="flex items-center justify-center h-64">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
              </div>
            ) : testimonials.length > 0 ? (
              <div className="space-y-6">
                {testimonials.map((testimonial) => (
                  <div
                    key={testimonial.id}
                    className="relative p-6 rounded-xl border border-border bg-card/80 backdrop-blur-sm"
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
                    <div className="pt-4 border-t border-border">
                      <div className="font-display font-semibold text-foreground">
                        {testimonial.author_name}
                      </div>
                      <div className="text-sm text-muted-foreground font-rajdhani">
                        {testimonial.role}
                      </div>
                      <div className="text-xs text-primary font-mono">
                        {testimonial.company}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-64 text-center p-8 rounded-xl border border-dashed border-border bg-card/30">
                <Quote className="w-12 h-12 text-primary/30 mb-4" />
                <h3 className="text-xl font-display font-semibold text-foreground mb-2">
                  Be the First to Share
                </h3>
                <p className="text-muted-foreground font-rajdhani">
                  No testimonials yet. Share your experience and help others discover Vaulta!
                </p>
              </div>
            )}
          </motion.div>

          {/* Right side - Submit form */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            <Card className="border-border bg-card/80 backdrop-blur-sm">
              <CardHeader>
                <CardTitle className="font-display flex items-center gap-2">
                  <Send className="w-5 h-5 text-primary" />
                  Share Your Experience
                </CardTitle>
              </CardHeader>
              <CardContent>
                {submitted ? (
                  <div className="text-center py-8">
                    <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
                    <h3 className="text-xl font-display font-semibold text-foreground mb-2">
                      Thank You!
                    </h3>
                    <p className="text-muted-foreground font-rajdhani mb-4">
                      Your testimonial has been submitted and is pending review.
                    </p>
                    <Button
                      variant="outline"
                      onClick={() => setSubmitted(false)}
                    >
                      Submit Another
                    </Button>
                  </div>
                ) : (
                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="author_name">Your Name</Label>
                        <Input
                          id="author_name"
                          placeholder="John Doe"
                          value={formData.author_name}
                          onChange={(e) =>
                            setFormData({ ...formData, author_name: e.target.value })
                          }
                          required
                          maxLength={100}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="company">Company</Label>
                        <Input
                          id="company"
                          placeholder="Acme Inc."
                          value={formData.company}
                          onChange={(e) =>
                            setFormData({ ...formData, company: e.target.value })
                          }
                          required
                          maxLength={100}
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="role">Your Role</Label>
                      <Input
                        id="role"
                        placeholder="Security Officer"
                        value={formData.role}
                        onChange={(e) =>
                          setFormData({ ...formData, role: e.target.value })
                        }
                        required
                        maxLength={100}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="quote">Your Experience</Label>
                      <Textarea
                        id="quote"
                        placeholder="Tell us about your experience with Vaulta..."
                        value={formData.quote}
                        onChange={(e) =>
                          setFormData({ ...formData, quote: e.target.value })
                        }
                        required
                        maxLength={500}
                        className="min-h-[120px]"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Rating</Label>
                      <div className="flex gap-2">
                        {[1, 2, 3, 4, 5].map((rating) => (
                          <button
                            key={rating}
                            type="button"
                            onClick={() => setFormData({ ...formData, rating })}
                            className="focus:outline-none"
                          >
                            <Star
                              className={`w-8 h-8 transition-colors ${
                                rating <= formData.rating
                                  ? "fill-primary text-primary"
                                  : "text-muted-foreground"
                              }`}
                            />
                          </button>
                        ))}
                      </div>
                    </div>

                    <Button
                      type="submit"
                      className="w-full"
                      disabled={submitting}
                    >
                      {submitting ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Submitting...
                        </>
                      ) : (
                        <>
                          <Send className="w-4 h-4 mr-2" />
                          Submit Testimonial
                        </>
                      )}
                    </Button>

                    <p className="text-xs text-muted-foreground text-center">
                      Testimonials are reviewed before being published.
                    </p>
                  </form>
                )}
              </CardContent>
            </Card>
          </motion.div>
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
