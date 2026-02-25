import { Shield } from "lucide-react";
import { motion } from "framer-motion";

interface VaultaLogoProps {
  size?: "sm" | "md" | "lg";
  showText?: boolean;
}

export const VaultaLogo = ({ size = "md", showText = true }: VaultaLogoProps) => {
  const sizes = {
    sm: { icon: 24, text: "text-lg" },
    md: { icon: 32, text: "text-2xl" },
    lg: { icon: 48, text: "text-4xl" },
  };

  return (
    <motion.div 
      className="flex items-center gap-3"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
    >
      <div className="relative">
        <div className="absolute inset-0 bg-primary/20 rounded-full blur-xl" />
        <div className="relative p-2 rounded-lg border border-primary/30 bg-card/50 backdrop-blur shield-pulse">
          <Shield 
            size={sizes[size].icon} 
            className="text-primary" 
            strokeWidth={1.5}
          />
        </div>
      </div>
      {showText && (
        <div className="flex flex-col">
          <span className={`font-display font-bold ${sizes[size].text} gradient-text tracking-wider`}>
            VAULTA<sup className="text-[0.5em] align-super ml-0.5 font-normal">™</sup>
          </span>
          <span className="text-xs text-muted-foreground font-rajdhani tracking-widest uppercase">
            Your world, secured
          </span>
        </div>
      )}
    </motion.div>
  );
};
