import { useState, useEffect } from "react";
import { AnimatePresence } from "framer-motion";
import { InitializingScreen } from "@/components/InitializingScreen";
import { Navbar } from "@/components/Navbar";
import { HeroSection } from "@/components/HeroSection";
import { FeaturesSection } from "@/components/FeaturesSection";
import { SecuritySection } from "@/components/SecuritySection";
import { Footer } from "@/components/Footer";
import { supabase } from "@/integrations/supabase/client";

if (!supabase) {
  return (
    <div className="min-h-screen flex items-center justify-center text-red-500">
      <div>
        <h1 className="text-2xl font-bold">Supabase not configured</h1>
        <p>
          Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY
        </p>
      </div>
    </div>
  );
}


const Index = () => {
  const [isInitialized, setIsInitialized] = useState(false);
  const [showInit, setShowInit] = useState(true);

  useEffect(() => {
    // Check if already initialized this session
    const initialized = sessionStorage.getItem("vaulta_initialized");
    if (initialized) {
      setShowInit(false);
      setIsInitialized(true);
    }
  }, []);

  const handleInitComplete = () => {
    sessionStorage.setItem("vaulta_initialized", "true");
    setIsInitialized(true);
    setTimeout(() => setShowInit(false), 300);
  };

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
          </main>
          <Footer />
        </>
      )}
    </div>
  );
};

export default Index;
