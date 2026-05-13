import { useState, useEffect, createContext, useContext, ReactNode, useRef } from "react";
import { User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { getAuthSessionKey, navigateOnceForAuthTransition, resolveRoleRedirectTarget } from "@/lib/authRedirect";

interface InstitutionalAuthContextType {
  user: User | null;
  institutionId: string | null;
  institutionName: string | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const InstitutionalAuthContext = createContext<InstitutionalAuthContextType | undefined>(undefined);

export const InstitutionalAuthProvider = ({ children }: { children: ReactNode }) => {
  const { user, session, loading: authLoading, authInitialized, mfaRequired } = useAuth();
  const [institutionId, setInstitutionId] = useState<string | null>(null);
  const [institutionName, setInstitutionName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const location = useLocation();
  const accessChecked = useRef<string | null>(null);

  // Wait for auth to resolve, then check institutional access exactly once per user.
  useEffect(() => {
    if (!authInitialized || authLoading) return;

    if (!user) {
      navigateOnceForAuthTransition({ navigate, location, targetPath: "/auth", sessionKey: getAuthSessionKey(session) });
      return;
    }

    if (mfaRequired) {
      navigateOnceForAuthTransition({ navigate, location, targetPath: "/auth", sessionKey: getAuthSessionKey(session, user.id) });
      return;
    }

    const sessionKey = getAuthSessionKey(session, user.id);
    if (accessChecked.current === sessionKey) return;
    accessChecked.current = sessionKey;

    let cancelled = false;
    (async () => {
      const targetPath = await resolveRoleRedirectTarget(user.id);
      if (cancelled) return;
      if (targetPath !== "/institutional/dashboard") {
        navigateOnceForAuthTransition({ navigate, location, targetPath, sessionKey });
        return;
      }

      const { data, error } = await (supabase.from as any)("institutional_users")
        .select("institution_id, institutions(name)")
        .eq("user_id", user.id)
        .maybeSingle();
      if (cancelled) return;

      if (error || !data?.institution_id) {
        navigateOnceForAuthTransition({ navigate, location, targetPath: "/auth", sessionKey });
        return;
      }

      setInstitutionId(data.institution_id);
      setInstitutionName(data.institutions?.name ?? null);
      setLoading(false);
    })();

    return () => { cancelled = true; };
  }, [authInitialized, authLoading, user?.id, session, mfaRequired, navigate, location]);

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
