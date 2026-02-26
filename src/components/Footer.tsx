import { motion } from "framer-motion";
import { VaultaLogo } from "./VaultaLogo";
import { Link } from "react-router-dom";

export const Footer = () => {
  return (
    <footer className="py-16 border-t border-border bg-card/30">
      <div className="container mx-auto px-6">
        <div className="grid md:grid-cols-4 gap-12">
          {/* Logo & Description */}
          <div className="md:col-span-2">
            <VaultaLogo size="md" />
            <p className="mt-4 text-muted-foreground font-rajdhani max-w-md">
              Vaulta provides end-to-end encrypted security for your most sensitive documents. 
              Take sovereign control of your digital identity with end-to-end encryption 
              and NIST-800-53 compliant infrastructure.
            </p>
            <p className="mt-4 text-sm text-muted-foreground font-mono">
              © 2026 Jonathan McEwen. All rights reserved.
            </p>
          </div>

          {/* Legal */}
          <div>
            <h4 className="font-display text-sm font-bold text-foreground mb-4 tracking-wider">
              LEGAL
            </h4>
            <ul className="space-y-3">
              <li>
                <Link
                  to="/privacy"
                  className="text-sm text-muted-foreground hover:text-primary transition-colors font-rajdhani"
                >
                  Privacy Policy
                </Link>
              </li>
              <li>
                <Link
                  to="/terms"
                  className="text-sm text-muted-foreground hover:text-primary transition-colors font-rajdhani"
                >
                  Terms of Service
                </Link>
              </li>
              <li>
                <Link
                  to="/privacy#security"
                  className="text-sm text-muted-foreground hover:text-primary transition-colors font-rajdhani"
                >
                  Security
                </Link>
              </li>
              <li>
                <Link
                  to="/privacy#compliance"
                  className="text-sm text-muted-foreground hover:text-primary transition-colors font-rajdhani"
                >
                  Compliance
                </Link>
              </li>
            </ul>
          </div>

          {/* Resources */}
          <div>
            <h4 className="font-display text-sm font-bold text-foreground mb-4 tracking-wider">
              RESOURCES
            </h4>
            <ul className="space-y-3">
              <li>
                <Link
                  to="/documentation"
                  className="text-sm text-muted-foreground hover:text-primary transition-colors font-rajdhani"
                >
                  Documentation
                </Link>
              </li>
              <li>
                <Link
                  to="/api-reference"
                  className="text-sm text-muted-foreground hover:text-primary transition-colors font-rajdhani"
                >
                  API Reference
                </Link>
              </li>
              <li>
                <a
                  href="mailto:help@tryvaulta.com"
                  className="text-sm text-muted-foreground hover:text-primary transition-colors font-rajdhani"
                >
                  Support
                </a>
              </li>
              <li>
                <Link
                  to="/roadmap"
                  className="text-sm text-muted-foreground hover:text-primary transition-colors font-rajdhani"
                >
                  Roadmap
                </Link>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom Bar */}
        <motion.div
          className="mt-12 pt-8 border-t border-border flex flex-wrap justify-center gap-8"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
        >
          {[
            { label: "ENCRYPTED", status: "256-BIT" },
            { label: "UPTIME", status: "99.99%" },
            { label: "COMPLIANCE", status: "NIST-800-53" },
            { label: "SUPPORT", status: "24/7" },
          ].map((item) => (
            <div key={item.label} className="flex items-center gap-2 text-xs">
              <div className="w-2 h-2 rounded-full bg-secure-green animate-pulse" />
              <span className="font-mono text-muted-foreground">{item.label}:</span>
              <span className="font-mono text-primary">{item.status}</span>
            </div>
          ))}
        </motion.div>
      </div>
    </footer>
  );
};
