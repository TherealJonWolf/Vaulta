import { useState, useEffect, createContext, useContext, ReactNode } from "react";
import { User, Session, AuthenticatorAssuranceLevels } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { logLoginAttempt, logSecurityEvent, createSession } from "@/lib/securityLogger";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  mfaRequired: boolean;
  currentLevel: AuthenticatorAssuranceLevels | null;
  signUp: (email: string, password: string) => Promise<{ error: Error | null }>;
  signIn: (email: string, password: string) => Promise<{ error: Error | null; mfaRequired?: boolean }>;
  signOut: () => Promise<void>;
  checkMFAStatus: () => Promise<boolean>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [mfaRequired, setMfaRequired] = useState(false);
  const [currentLevel, setCurrentLevel] = useState<AuthenticatorAssuranceLevels | null>(null);

  const checkMFAStatus = async (): Promise<boolean> => {
    const { data, error } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (error) {
      console.error("Error checking MFA status:", error);
      return false;
    }
    
    setCurrentLevel(data.currentLevel);
    
    // MFA is required if user has enrolled factors but hasn't verified yet in this session
    const needsMFA = data.nextLevel === "aal2" && data.currentLevel === "aal1";
    setMfaRequired(needsMFA);
    return needsMFA;
  };

  useEffect(() => {
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);
        
        // Check MFA status after auth state change
        if (session?.user) {
          setTimeout(() => {
            checkMFAStatus();
          }, 0);
        } else {
          setMfaRequired(false);
          setCurrentLevel(null);
        }
      }
    );

    // THEN check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
      
      if (session?.user) {
        checkMFAStatus();
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const signUp = async (email: string, password: string) => {
    const redirectUrl = `${window.location.origin}/vault`;
    
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl,
      },
    });
    
    return { error: error as Error | null };
  };

  const signIn = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    
    if (!error && data.user) {
      // Log successful login
      await logLoginAttempt(data.user.id, true, false);
      await logSecurityEvent(data.user.id, 'login_success', 'Successful login');
      
      // Create session tracking
      if (data.session) {
        await createSession(data.user.id, data.session.access_token.substring(0, 32));
      }
      
      const needsMFA = await checkMFAStatus();
      return { error: null, mfaRequired: needsMFA };
    }
    
    return { error: error as Error | null, mfaRequired: false };
  };

  const signOut = async () => {
    if (user) {
      await logSecurityEvent(user.id, 'logout', 'User logged out');
    }
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, mfaRequired, currentLevel, signUp, signIn, signOut, checkMFAStatus }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
