import { useState, useEffect } from "react";
import { AnimatePresence } from "framer-motion";
import { InitializingScreen } from "@/components/InitializingScreen";
import { Navbar } from "@/components/Navbar";
import { HeroSection } from "@/components/HeroSection";
import { FeaturesSection } from "@/components/FeaturesSection";
import { SecuritySection } from "@/components/SecuritySection";
import { TestimonialsSection } from "@/components/TestimonialsSection";
import PricingSection from "@/components/PricingSection";
import { Footer } from "@/components/Footer";
import { supabase } from "@/integrations/supabase/client";

export default function Index() {
  const [isInitialized, setIsInitialized] = useState(false);
  const [showInit, setShowInit] = useState(true);

  const handleInitComplete = () => {
    setIsInitialized(true);
    setTimeout(() => setShowInit(false), 300);
  };

  // Guard after hooks
  if (!supabase) {
    return (
      <div className="min-h-screen flex items-center justify-center text-destructive">
        <div>
          <h1 className="text-xl font-bold">Backend not configured</h1>
          <p>Missing environment variables</p>
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
          </main>
          <Footer />
        </>
      )}
    </div>
  );
}
