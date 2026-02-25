import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Download, Smartphone, Monitor, CheckCircle2, Share } from "lucide-react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export default function Install() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    const ua = navigator.userAgent;
    setIsIOS(/iPad|iPhone|iPod/.test(ua));

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
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") setIsInstalled(true);
    setDeferredPrompt(null);
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="pt-32 pb-20">
        <div className="container mx-auto px-6 max-w-3xl text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-primary/30 bg-primary/10 mb-8">
              <Download className="w-4 h-4 text-primary" />
              <span className="font-rajdhani text-sm text-primary tracking-wider">
                INSTALL VAULTA
              </span>
            </div>

            <h1 className="font-display text-4xl md:text-5xl font-bold gradient-text mb-6">
              Take Vaulta Everywhere
            </h1>
            <p className="text-lg text-muted-foreground font-rajdhani mb-12 max-w-xl mx-auto">
              Install Vaulta on your device for instant access to your secure vault — 
              works offline, loads instantly, and feels like a native app.
            </p>
          </motion.div>

          {isInstalled ? (
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="cyber-border rounded-xl p-8 bg-card/50"
            >
              <CheckCircle2 className="w-16 h-16 text-primary mx-auto mb-4" />
              <h2 className="font-display text-2xl font-bold text-foreground mb-2">
                Already Installed
              </h2>
              <p className="text-muted-foreground font-rajdhani">
                Vaulta is installed on your device. Open it from your home screen.
              </p>
            </motion.div>
          ) : (
            <div className="grid md:grid-cols-2 gap-6">
              {/* Android / Desktop */}
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.2 }}
                className="cyber-border rounded-xl p-8 bg-card/50 text-left"
              >
                <div className="flex items-center gap-3 mb-4">
                  <Monitor className="w-6 h-6 text-primary" />
                  <Smartphone className="w-6 h-6 text-primary" />
                </div>
                <h3 className="font-display text-xl font-bold text-foreground mb-2">
                  Android & Desktop
                </h3>
                <p className="text-sm text-muted-foreground font-rajdhani mb-6">
                  Click the button below to install Vaulta directly to your device.
                </p>
                <Button
                  onClick={handleInstall}
                  disabled={!deferredPrompt}
                  className="btn-gradient w-full font-rajdhani font-semibold tracking-wider"
                >
                  <Download className="w-4 h-4 mr-2" />
                  {deferredPrompt ? "Install Vaulta" : "Open in Browser to Install"}
                </Button>
              </motion.div>

              {/* iOS */}
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.3 }}
                className="cyber-border rounded-xl p-8 bg-card/50 text-left"
              >
                <div className="flex items-center gap-3 mb-4">
                  <Share className="w-6 h-6 text-primary" />
                </div>
                <h3 className="font-display text-xl font-bold text-foreground mb-2">
                  iPhone & iPad
                </h3>
                <p className="text-sm text-muted-foreground font-rajdhani mb-4">
                  To install on iOS:
                </p>
                <ol className="space-y-3 text-sm text-muted-foreground font-rajdhani">
                  <li className="flex items-start gap-2">
                    <span className="text-primary font-bold">1.</span>
                    Tap the <strong className="text-foreground">Share</strong> button in Safari
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-primary font-bold">2.</span>
                    Scroll down and tap <strong className="text-foreground">Add to Home Screen</strong>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-primary font-bold">3.</span>
                    Tap <strong className="text-foreground">Add</strong> to confirm
                  </li>
                </ol>
              </motion.div>
            </div>
          )}

          {/* Features */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="mt-16 grid grid-cols-3 gap-6"
          >
            {[
              { label: "Offline Access", desc: "Works without internet" },
              { label: "Instant Load", desc: "Opens in milliseconds" },
              { label: "Secure", desc: "End-to-end encrypted" },
            ].map((f) => (
              <div key={f.label} className="text-center">
                <div className="w-2 h-2 rounded-full bg-primary mx-auto mb-2 animate-pulse" />
                <h4 className="font-display text-sm font-bold text-foreground">{f.label}</h4>
                <p className="text-xs text-muted-foreground font-rajdhani">{f.desc}</p>
              </div>
            ))}
          </motion.div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
