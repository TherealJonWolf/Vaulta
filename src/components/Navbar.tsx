import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { VaultaLogo } from "./VaultaLogo";
import { Button } from "./ui/button";

const navLinks = [
  { label: "SECURITY", href: "#security", isRoute: false },
  { label: "MISSION", href: "#mission", isRoute: false },
  { label: "BRAND", href: "/brand", isRoute: true },
];

export const Navbar = () => {
  const navigate = useNavigate();

  return (
    <motion.nav
      className="fixed top-0 left-0 right-0 z-40 bg-background/80 backdrop-blur-lg border-b border-border"
      initial={{ y: -100 }}
      animate={{ y: 0 }}
      transition={{ duration: 0.5, delay: 0.2 }}
    >
      <div className="container mx-auto px-6 py-4">
        <div className="flex items-center justify-between">
          <Link to="/">
            <VaultaLogo size="sm" />
          </Link>

          <div className="hidden md:flex items-center gap-8">
            {navLinks.map((link) =>
              link.isRoute ? (
                <Link
                  key={link.label}
                  to={link.href}
                  className="font-rajdhani text-sm font-medium text-muted-foreground hover:text-primary transition-colors tracking-wider"
                >
                  {link.label}
                </Link>
              ) : (
                <a
                  key={link.label}
                  href={link.href}
                  className="font-rajdhani text-sm font-medium text-muted-foreground hover:text-primary transition-colors tracking-wider"
                >
                  {link.label}
                </a>
              )
            )}
          </div>

          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              className="font-rajdhani tracking-wider text-muted-foreground hover:text-primary"
              onClick={() => navigate("/auth")}
            >
              LOG IN
            </Button>
            <Button
              className="btn-gradient font-rajdhani font-semibold tracking-wider text-primary-foreground"
              onClick={() => navigate("/auth?mode=signup")}
            >
              SIGN UP
            </Button>
          </div>
        </div>
      </div>
    </motion.nav>
  );
};
