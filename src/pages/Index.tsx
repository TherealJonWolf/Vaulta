import { useState, useEffect } from "react";
import { AnimatePresence } from "framer-motion";
import { InitializingScreen } from "@/components/InitializingScreen";
import { Navbar } from "@/components/Navbar";
import { HeroSection } from "@/components/HeroSection";
import { FeaturesSection } from "@/components/FeaturesSection";
import { SecuritySection } from "@/components/SecuritySection";
import { Footer } from "@/components/Footer";

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
