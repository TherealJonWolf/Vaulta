import { ReactNode } from "react";
import { InstitutionalAuthProvider, useInstitutionalAuth } from "../hooks/useInstitutionalAuth";
import { InstitutionalSidebar } from "./InstitutionalSidebar";
import { Loader2 } from "lucide-react";

const LayoutContent = ({ children }: { children: ReactNode }) => {
  const { loading } = useInstitutionalAuth();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-white">
        <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
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
