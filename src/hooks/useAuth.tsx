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
  signUp: (email: string, password: string, role?: 'user' | 'landlord') => Promise<{ error: Error | null }>;
  signIn: (email: string, password: string) => Promise<{ error: Error | null; mfaRequired?: boolean; accountLocked?: boolean }>;
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
        // Don't update state for PASSWORD_RECOVERY — let ResetPassword page handle it
        if (event === "PASSWORD_RECOVERY") {
          setLoading(false);
          return;
        }
        
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

  const signUp = async (email: string, password: string, role: 'user' | 'landlord' = 'user') => {
    const redirectUrl = role === 'landlord' 
      ? `${window.location.origin}/landlord`
      : `${window.location.origin}/vault`;
    
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl,
      },
    });
    
    // Assign role after successful signup
    if (!error && data.user) {
      const roleToAssign = role === 'landlord' ? 'landlord' : 'user';
      await supabase.rpc('assign_user_role', { p_user_id: data.user.id, p_role: roleToAssign });
    }
    
    return { error: error as Error | null };
  };

  const signIn = async (email: string, password: string) => {
    // NIST 800-53 AC-7: Check if account is locked before attempting login
    const { data: lockedData } = await supabase.rpc('check_account_locked', { p_email: email });
    if (lockedData === true) {
      return {
        error: new Error('Your account has been locked due to too many failed login attempts. Please reset your password to regain access.') as Error,
        mfaRequired: false,
        accountLocked: true,
      };
    }

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    
    if (!error && data.user) {
      // Reset failed login counter on success
      await supabase.rpc('reset_failed_login', { p_user_id: data.user.id });

      // Log successful login
      await logLoginAttempt(data.user.id, true, false);
      await logSecurityEvent(data.user.id, 'login_success', 'Successful login');
      
      // Create session tracking
      if (data.session) {
        await createSession(data.user.id, data.session.access_token.substring(0, 32));
      }
      
      const needsMFA = await checkMFAStatus();
      return { error: null, mfaRequired: needsMFA, accountLocked: false };
    }

    // Increment failed login attempts
    if (error) {
      const { data: failData } = await supabase.rpc('increment_failed_login', { p_email: email });
      const result = failData as { attempts: number; locked: boolean } | null;
      if (result?.locked) {
        return {
          error: new Error('Your account has been locked after 6 failed login attempts. Please reset your password to regain access.') as Error,
          mfaRequired: false,
          accountLocked: true,
        };
      }
      const remaining = 6 - (result?.attempts ?? 0);
      if (remaining > 0 && remaining <= 3) {
        return {
          error: new Error(`Invalid login credentials. ${remaining} attempt${remaining === 1 ? '' : 's'} remaining before account lockout.`) as Error,
          mfaRequired: false,
          accountLocked: false,
        };
      }
    }
    
    return { error: error as Error | null, mfaRequired: false, accountLocked: false };
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
