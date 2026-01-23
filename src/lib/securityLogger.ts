import { supabase } from "@/integrations/supabase/client";

export type SecurityEventType = 
  | 'login_success'
  | 'login_failed'
  | 'logout'
  | 'mfa_enabled'
  | 'mfa_disabled'
  | 'mfa_verified'
  | 'recovery_code_used'
  | 'recovery_codes_regenerated'
  | 'password_changed'
  | 'session_revoked'
  | 'document_uploaded'
  | 'document_deleted';

const getDeviceInfo = (): string => {
  const ua = navigator.userAgent;
  let device = 'Unknown Device';
  
  if (/iPhone/.test(ua)) device = 'iPhone';
  else if (/iPad/.test(ua)) device = 'iPad';
  else if (/Android/.test(ua)) device = 'Android Device';
  else if (/Mac/.test(ua)) device = 'Mac';
  else if (/Windows/.test(ua)) device = 'Windows PC';
  else if (/Linux/.test(ua)) device = 'Linux PC';
  
  // Add browser info
  let browser = '';
  if (/Chrome/.test(ua) && !/Chromium|Edge/.test(ua)) browser = 'Chrome';
  else if (/Firefox/.test(ua)) browser = 'Firefox';
  else if (/Safari/.test(ua) && !/Chrome/.test(ua)) browser = 'Safari';
  else if (/Edge/.test(ua)) browser = 'Edge';
  
  return browser ? `${device} - ${browser}` : device;
};

export const logSecurityEvent = async (
  userId: string,
  eventType: SecurityEventType,
  description: string,
  metadata: Record<string, unknown> = {}
): Promise<void> => {
  try {
    // Using type assertion due to types not yet being updated after migration
    await (supabase.from('security_events') as any).insert({
      user_id: userId,
      event_type: eventType,
      event_description: description,
      metadata,
      user_agent: navigator.userAgent,
    });
  } catch (error) {
    console.error('Failed to log security event:', error);
  }
};

export const logLoginAttempt = async (
  userId: string,
  success: boolean,
  mfaUsed: boolean = false,
  failureReason?: string
): Promise<void> => {
  try {
    // Using type assertion due to types not yet being updated after migration
    await (supabase.from('login_history') as any).insert({
      user_id: userId,
      success,
      mfa_used: mfaUsed,
      failure_reason: failureReason,
      user_agent: navigator.userAgent,
    });
  } catch (error) {
    console.error('Failed to log login attempt:', error);
  }
};

export const createSession = async (userId: string, sessionToken: string): Promise<void> => {
  try {
    // Using type assertion due to types not yet being updated after migration
    const sessionsTable = supabase.from('active_sessions') as any;
    
    // Mark all existing sessions as not current
    await sessionsTable
      .update({ is_current: false })
      .eq('user_id', userId);

    // Create new session
    await sessionsTable.insert({
      user_id: userId,
      session_token: sessionToken,
      device_info: getDeviceInfo(),
      is_current: true,
    });
  } catch (error) {
    console.error('Failed to create session:', error);
  }
};

export const updateSessionActivity = async (sessionToken: string): Promise<void> => {
  try {
    // Using type assertion due to types not yet being updated after migration
    await (supabase.from('active_sessions') as any)
      .update({ last_active_at: new Date().toISOString() })
      .eq('session_token', sessionToken);
  } catch (error) {
    console.error('Failed to update session activity:', error);
  }
};

export const revokeSession = async (sessionId: string): Promise<void> => {
  try {
    // Using type assertion due to types not yet being updated after migration
    await (supabase.from('active_sessions') as any)
      .delete()
      .eq('id', sessionId);
  } catch (error) {
    console.error('Failed to revoke session:', error);
  }
};

export const revokeAllSessions = async (userId: string, exceptCurrent: boolean = true): Promise<void> => {
  try {
    // Using type assertion due to types not yet being updated after migration
    let query = (supabase.from('active_sessions') as any)
      .delete()
      .eq('user_id', userId);
    
    if (exceptCurrent) {
      query = query.eq('is_current', false);
    }
    
    await query;
  } catch (error) {
    console.error('Failed to revoke all sessions:', error);
  }
};
