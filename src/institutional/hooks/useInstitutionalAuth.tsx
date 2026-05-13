import { useState, useEffect, createContext, useContext, ReactNode, useRef } from "react";
import { User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";

interface InstitutionalAuthContextType {
  user: User | null;
  institutionId: string | null;
  institutionName: string | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const InstitutionalAuthContext = createContext<InstitutionalAuthContextType | undefined>(undefined);

export const InstitutionalAuthProvider = ({ children }: { children: ReactNode }) => {
  const { user, loading: authLoading } = useAuth();
  const [institutionId, setInstitutionId] = useState<string | null>(null);
  const [institutionName, setInstitutionName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const accessChecked = useRef<string | null>(null);
  const redirected = useRef(false);

  // Wait for auth to resolve, then check institutional access exactly once per user.
  useEffect(() => {
    if (authLoading) return;

    if (!user) {
      if (!redirected.current) {
        redirected.current = true;
        navigate("/auth", { replace: true });
      }
      return;
    }

    // Only run the access check once per authenticated user id
    if (accessChecked.current === user.id) return;
    accessChecked.current = user.id;

    let cancelled = false;
    (async () => {
      const { data, error } = await (supabase.rpc as any)('ensure_institutional_access', {
        _user_id: user.id,
      });
      if (cancelled) return;

      if (error || !data || (data as any).error) {
        // Access denied — send to /auth (NOT /vault, which would bounce back here).
        if (!redirected.current) {
          redirected.current = true;
          navigate("/auth", { replace: true });
        }
        return;
      }

      setInstitutionId((data as any).institution_id);
      setInstitutionName((data as any).institution_name);
      setLoading(false);
    })();

    return () => { cancelled = true; };
  }, [authLoading, user, navigate]);

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
