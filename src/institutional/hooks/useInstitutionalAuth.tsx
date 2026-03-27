import { useState, useEffect, createContext, useContext, ReactNode } from "react";
import { User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";

interface InstitutionalAuthContextType {
  user: User | null;
  institutionId: string | null;
  institutionName: string | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const InstitutionalAuthContext = createContext<InstitutionalAuthContextType | undefined>(undefined);

export const InstitutionalAuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [institutionId, setInstitutionId] = useState<string | null>(null);
  const [institutionName, setInstitutionName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        navigate("/auth");
        return;
      }
      setUser(session.user);

      const { data, error } = await (supabase.rpc as any)('ensure_institutional_access', {
        _user_id: session.user.id,
      });

      if (error || !data || data.error) {
        navigate("/vault");
        return;
      }

      setInstitutionId(data.institution_id);
      setInstitutionName(data.institution_name);
      setLoading(false);
    };

    init();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
      if (!session) navigate("/auth");
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  const signOut = async () => {
    try {
      if (institutionId && user) {
        await (supabase.from as any)('institutional_activity_log').insert({
          institution_id: institutionId,
          user_id: user.id,
          event_type: 'Logout',
          detail: 'User signed out',
        });
      }
    } catch (_) {
      // Ignore activity log errors
    }
    // Try global signout first, fall back to local if session is already gone
    const { error } = await supabase.auth.signOut();
    if (error) {
      await supabase.auth.signOut({ scope: 'local' });
    }
    navigate("/auth");
  };

  return (
    <InstitutionalAuthContext.Provider value={{ user, institutionId, institutionName, loading, signOut }}>
      {children}
    </InstitutionalAuthContext.Provider>
  );
};

export const useInstitutionalAuth = () => {
  const ctx = useContext(InstitutionalAuthContext);
  if (!ctx) throw new Error("useInstitutionalAuth must be within InstitutionalAuthProvider");
  return ctx;
};
