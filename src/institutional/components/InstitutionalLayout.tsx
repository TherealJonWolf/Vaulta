import { ReactNode, useEffect } from "react";
import { InstitutionalAuthProvider, useInstitutionalAuth } from "../hooks/useInstitutionalAuth";
import { InstitutionalSidebar } from "./InstitutionalSidebar";
import { Loader2 } from "lucide-react";
import { useVaultEncryption } from "@/hooks/useVaultEncryption";
import VaultPassphraseGate from "@/components/VaultPassphraseGate";

const LayoutContent = ({ children }: { children: ReactNode }) => {
  const { loading, user } = useInstitutionalAuth();
  const {
    isUnlocked,
    hasPassphrase,
    checkPassphraseExists,
    createPassphrase,
    unlockVault,
  } = useVaultEncryption(user?.id);

  useEffect(() => {
    if (user?.id) {
      checkPassphraseExists();
    }
  }, [user?.id, checkPassphraseExists]);

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

  return (
    <div className="flex h-screen bg-white">
      <InstitutionalSidebar />
      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  );
};

export const InstitutionalLayout = ({ children }: { children: ReactNode }) => (
  <InstitutionalAuthProvider>
    <LayoutContent>{children}</LayoutContent>
  </InstitutionalAuthProvider>
);
