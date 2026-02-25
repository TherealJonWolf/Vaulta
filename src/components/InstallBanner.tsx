import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Button } from "./ui/button";
import { Download, Share, Smartphone } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export const InstallBanner = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    setIsIOS(/iPad|iPhone|iPod/.test(navigator.userAgent));

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", handler);

    if (window.matchMedia("(display-mode: standalone)").matches) {
      setIsInstalled(true);
    }

    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const handleInstall = async () => {
    if (deferredPrompt) {
      await deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === "accepted") setIsInstalled(true);
      setDeferredPrompt(null);
    } else {
      navigate("/install");
    }
  };

  if (isInstalled) return null;

  return (
    <section className="py-20 relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-b from-background via-primary/5 to-background" />
      <div className="container mx-auto px-6 relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="cyber-border rounded-2xl p-8 md:p-12 bg-card/50 backdrop-blur-sm text-center max-w-3xl mx-auto"
        >
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-primary/30 bg-primary/10 mb-6">
            <Smartphone className="w-4 h-4 text-primary" />
            <span className="font-rajdhani text-sm text-primary tracking-wider">
              MOBILE APP
            </span>
          </div>

          <h2 className="font-display text-3xl md:text-4xl font-bold gradient-text mb-4">
            Take Vaulta With You
          </h2>
          <p className="text-muted-foreground font-rajdhani text-lg mb-8 max-w-lg mx-auto">
            Install Vaulta on your device for instant, offline access to your secure vault — no app store needed.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Button
              onClick={handleInstall}
              className="btn-gradient font-rajdhani font-semibold tracking-wider text-primary-foreground px-8"
              size="lg"
            >
              <Download className="w-4 h-4 mr-2" />
              {deferredPrompt ? "Install Now" : "Get the App"}
            </Button>

            {isIOS && (
              <p className="text-xs text-muted-foreground font-rajdhani flex items-center gap-1">
                <Share className="w-3 h-3" /> On iPhone, tap Share → Add to Home Screen
              </p>
            )}
          </div>

          <div className="flex justify-center gap-8 mt-8">
            {["Offline Access", "Instant Load", "Encrypted"].map((f) => (
              <div key={f} className="flex items-center gap-2 text-xs">
                <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                <span className="font-mono text-muted-foreground">{f}</span>
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  );
};
