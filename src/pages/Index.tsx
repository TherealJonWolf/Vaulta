import { useState } from "react";
import { AnimatePresence } from "framer-motion";
import { InitializingScreen } from "@/components/InitializingScreen";
import { Navbar } from "@/components/Navbar";
import { HeroSection } from "@/components/HeroSection";
import { FeaturesSection } from "@/components/FeaturesSection";
import { SecuritySection } from "@/components/SecuritySection";
import { TestimonialsSection } from "@/components/TestimonialsSection";
import PricingSection from "@/components/PricingSection";
import { InstallBanner } from "@/components/InstallBanner";
import { Footer } from "@/components/Footer";
import { isSupabaseConfigured } from "@/integrations/supabase/client";

export default function Index() {
  const [isInitialized, setIsInitialized] = useState(false);
  const [showInit, setShowInit] = useState(true);

  const handleInitComplete = () => {
    setIsInitialized(true);
    setTimeout(() => setShowInit(false), 300);
  };

  // Show configuration error if Supabase is not set up
  if (!isSupabaseConfigured()) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background text-destructive">
        <div className="text-center p-8 max-w-md">
          <h1 className="text-2xl font-bold mb-4">Backend Not Configured</h1>
          <p className="text-muted-foreground mb-4">
            Missing required environment variables. Please ensure the following are set:
          </p>
          <ul className="text-left text-sm font-mono bg-card p-4 rounded-lg border border-border">
            <li>• VITE_SUPABASE_URL</li>
            <li>• VITE_SUPABASE_ANON_KEY</li>
          </ul>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <AnimatePresence>
        {showInit && !isInitialized && (
          <InitializingScreen onComplete={handleInitComplete} />
        )}
      </AnimatePresence>

      {isInitialized && (
        <>
          <Navbar />
          <main>
            <HeroSection />
            <FeaturesSection />
            <SecuritySection />
            <TestimonialsSection />
            <PricingSection />
            <InstallBanner />
          </main>
          <Footer />
        </>
      )}
    </div>
  );
}
