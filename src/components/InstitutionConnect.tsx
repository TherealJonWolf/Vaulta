import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Building2, X, ExternalLink, Search, Lock, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface Institution {
  id: string;
  name: string;
  type: string;
  url: string;
  description: string;
}

const institutions: Institution[] = [
  {
    id: "ssa",
    name: "Social Security Administration",
    type: "Government",
    url: "https://www.ssa.gov/myaccount/",
    description: "Access Social Security statements and benefits",
  },
  {
    id: "irs",
    name: "Internal Revenue Service",
    type: "Government",
    url: "https://www.irs.gov/individuals/get-transcript",
    description: "Download tax transcripts and records",
  },
  {
    id: "state-dept",
    name: "U.S. Department of State",
    type: "Government",
    url: "https://travel.state.gov/content/travel/en/passports.html",
    description: "Passport and travel documents",
  },
  {
    id: "dmv",
    name: "Department of Motor Vehicles",
    type: "Government",
    url: "https://www.dmv.org/",
    description: "Driver's license and vehicle records",
  },
  {
    id: "uscis",
    name: "U.S. Citizenship & Immigration",
    type: "Government",
    url: "https://www.uscis.gov/",
    description: "Immigration documents and status",
  },
  {
    id: "va",
    name: "Veterans Affairs",
    type: "Government",
    url: "https://www.va.gov/records/",
    description: "Military service and benefits records",
  },
  // 🇲🇽 Mexican Government Institutions
  {
    id: "sat",
    name: "SAT (Servicio de Administración Tributaria)",
    type: "Government - Mexico",
    url: "https://www.sat.gob.mx/",
    description: "Tax records, RFC, and fiscal documents",
  },
  {
    id: "imss",
    name: "IMSS (Instituto Mexicano del Seguro Social)",
    type: "Government - Mexico",
    url: "https://www.imss.gob.mx/",
    description: "Social security records and benefits",
  },
  {
    id: "ine",
    name: "INE (Instituto Nacional Electoral)",
    type: "Government - Mexico",
    url: "https://www.ine.mx/",
    description: "Voter ID and electoral records",
  },
  {
    id: "sre",
    name: "SRE (Secretaría de Relaciones Exteriores)",
    type: "Government - Mexico",
    url: "https://www.gob.mx/sre",
    description: "Passport and consular documents",
  },
  {
    id: "curp",
    name: "CURP (Clave Única de Registro de Población)",
    type: "Government - Mexico",
    url: "https://www.gob.mx/curp/",
    description: "Unique population registry code",
  },
  {
    id: "mx-background",
    name: "Antecedentes No Penales (Mexico)",
    type: "Government - Mexico",
    url: "https://www.gob.mx/tramites/ficha/expedicion-de-constancia-de-antecedentes-no-penales/SEGOB795",
    description: "Request official criminal background check certificate",
  },
  // 🇨🇦 Canadian Government Institutions
  {
    id: "cra",
    name: "Canada Revenue Agency (CRA)",
    type: "Government - Canada",
    url: "https://www.canada.ca/en/revenue-agency.html",
    description: "Tax records, T4s, notices of assessment",
  },
  {
    id: "service-canada",
    name: "Service Canada",
    type: "Government - Canada",
    url: "https://www.canada.ca/en/employment-social-development/corporate/portfolio/service-canada.html",
    description: "SIN, EI, CPP, and OAS records",
  },
  {
    id: "ircc",
    name: "IRCC (Immigration, Refugees and Citizenship)",
    type: "Government - Canada",
    url: "https://www.canada.ca/en/immigration-refugees-citizenship.html",
    description: "Immigration documents, PR cards, citizenship certificates",
  },
  {
    id: "vital-stats-on",
    name: "Ontario Vital Statistics",
    type: "Government - Canada",
    url: "https://www.ontario.ca/page/serviceontario",
    description: "Birth, marriage, and death certificates (Ontario)",
  },
  {
    id: "vital-stats-bc",
    name: "BC Vital Statistics",
    type: "Government - Canada",
    url: "https://www2.gov.bc.ca/gov/content/life-events",
    description: "Birth, marriage, and death certificates (British Columbia)",
  },
  {
    id: "vital-stats-ab",
    name: "Alberta Vital Statistics",
    type: "Government - Canada",
    url: "https://www.alberta.ca/vital-statistics.aspx",
    description: "Birth, marriage, and death certificates (Alberta)",
  },
  {
    id: "rcmp",
    name: "RCMP Criminal Record Check",
    type: "Government - Canada",
    url: "https://www.rcmp-grc.gc.ca/en/criminal-record-checks",
    description: "Canadian criminal background checks",
  },
];

interface InstitutionConnectProps {
  isOpen: boolean;
  onClose: () => void;
  isPremium?: boolean;
  onUpgradeRequired?: () => void;
}

const InstitutionConnect = ({ isOpen, onClose, isPremium = false, onUpgradeRequired }: InstitutionConnectProps) => {
  const [searchTerm, setSearchTerm] = useState("");

  const filteredInstitutions = institutions.filter(
    (inst) =>
      inst.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      inst.type.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleConnect = (institution: Institution) => {
    if (!isPremium) {
      onClose();
      onUpgradeRequired?.();
      return;
    }
    window.open(institution.url, "_blank", "noopener,noreferrer");
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-6"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          className="w-full max-w-2xl cyber-border rounded-2xl bg-card max-h-[90vh] overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="p-6 border-b border-border">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-accent/10 border border-accent/30 flex items-center justify-center">
                  <Building2 className="text-accent" size={24} />
                </div>
                <div>
                  <h2 className="font-display text-xl font-bold gradient-text">
                    Connect Institution
                  </h2>
                  <p className="text-sm text-muted-foreground font-mono">
                    Ingest documents from government sources
                  </p>
                </div>
              </div>
              <Button variant="ghost" size="icon" onClick={onClose}>
                <X size={20} />
              </Button>
            </div>

            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
              <Input
                placeholder="Search institutions..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 bg-background border-border focus:border-accent"
              />
            </div>
          </div>

          {/* Institution List */}
          <div className="p-6 overflow-y-auto max-h-[50vh] space-y-3">
            {filteredInstitutions.map((institution) => (
              <motion.div
                key={institution.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-4 rounded-xl border border-border hover:border-accent/50 transition-colors group cursor-pointer"
                onClick={() => handleConnect(institution)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
                      <Building2 className="text-muted-foreground" size={20} />
                    </div>
                    <div>
                      <h3 className="font-display font-bold text-foreground group-hover:text-accent transition-colors">
                        {institution.name}
                      </h3>
                      <p className="text-sm text-muted-foreground font-rajdhani">
                        {institution.description}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <span className="text-xs text-muted-foreground font-mono">
                      {institution.type}
                    </span>
                    <ArrowRight className="text-accent" size={18} />
                  </div>
                </div>
              </motion.div>
            ))}
          </div>

          {/* Info Footer */}
          <div className="p-6 border-t border-border bg-muted/30">
            <div className="flex items-start gap-3">
              <Lock className="text-primary mt-0.5" size={16} />
              <div>
                {!isPremium ? (
                  <p className="text-sm text-muted-foreground font-rajdhani">
                    <strong className="text-accent">Premium Feature:</strong> Institution connections require a Premium Vault subscription. 
                    Upgrade to securely ingest documents from government sources.
                  </p>
                ) : (
                  <p className="text-sm text-muted-foreground font-rajdhani">
                    <strong className="text-foreground">Secure Ingestion:</strong> After navigating to the institution, 
                    download your documents and upload them to your Sovereign Sector. All files are encrypted 
                    with 256-bit AES before storage.
                  </p>
                )}
              </div>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default InstitutionConnect;
