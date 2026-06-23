import { ReactNode, createContext, useContext, useEffect } from "react";
import { InstitutionalAuthProvider, useInstitutionalAuth } from "../hooks/useInstitutionalAuth";
import { InstitutionalSidebar } from "./InstitutionalSidebar";
import { Loader2 } from "lucide-react";
import { useVaultEncryption } from "@/hooks/useVaultEncryption";
import { useInstitutionVault } from "../hooks/useInstitutionVault";
import VaultPassphraseGate from "@/components/VaultPassphraseGate";

type InstVault = ReturnType<typeof useInstitutionVault>;
const InstitutionVaultContext = createContext<InstVault | null>(null);

export const useUnlockedInstitutionVault = (): InstVault => {
  const ctx = useContext(InstitutionVaultContext);
  if (!ctx) throw new Error("useUnlockedInstitutionVault must be inside InstitutionalLayout");
  return ctx;
};

const LayoutContent = ({ children }: { children: ReactNode }) => {
  const { loading, user, institutionId } = useInstitutionalAuth();
  const {
    isUnlocked,
    hasPassphrase,
    checkPassphraseExists,
    createPassphrase,
    unlockVault,
  } = useVaultEncryption(user?.id);
  const instVault = useInstitutionVault(institutionId);

  useEffect(() => {
    if (user?.id) {
      checkPassphraseExists();
    }
  }, [user?.id, checkPassphraseExists]);

  useEffect(() => {
    if (isUnlocked && institutionId) {
      instVault.checkPassphraseExists();
    }
  }, [isUnlocked, institutionId, instVault.checkPassphraseExists]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-white">
        <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
      </div>
    );
  }

  if (!isUnlocked) {
    return (
      <div className="flex items-center justify-center h-screen bg-white">
        <VaultPassphraseGate
          hasPassphrase={hasPassphrase}
          onCreatePassphrase={createPassphrase}
          onUnlock={unlockVault}
        />
      </div>
    );
  }

  if (!instVault.isUnlocked) {
    return (
      <div className="flex items-center justify-center h-screen bg-white">
        <VaultPassphraseGate
          hasPassphrase={instVault.hasPassphrase}
          onCreatePassphrase={instVault.createPassphrase}
          onUnlock={instVault.unlockVault}
        />
      </div>
    );
  }

  return (
    <InstitutionVaultContext.Provider value={instVault}>
      <div className="flex h-screen bg-white">
        <InstitutionalSidebar />
        <main className="flex-1 overflow-auto">{children}</main>
      </div>
    </InstitutionVaultContext.Provider>
  );
};

export const InstitutionalLayout = ({ children }: { children: ReactNode }) => (
  <InstitutionalAuthProvider>
    <LayoutContent>{children}</LayoutContent>
  </InstitutionalAuthProvider>
);
