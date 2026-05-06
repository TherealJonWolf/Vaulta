import { Shield } from "lucide-react";

export const VaultaBranding = () => (
  <div className="fixed bottom-0 left-0 right-0 z-40 py-1.5 px-4 flex items-center justify-center gap-2 text-[10px] sm:text-xs text-muted-foreground/80 font-rajdhani tracking-widest uppercase bg-background/50 backdrop-blur-md border-t border-border/20 pointer-events-none">
    <Shield size={12} className="text-primary/70" />
    <span className="font-display font-bold gradient-text">Vaulta</span>
    <span className="text-border">·</span>
    <span>Your world, secured</span>
  </div>
);
