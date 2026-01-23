import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { format, formatDistanceToNow } from "date-fns";
import {
  Shield,
  Monitor,
  Smartphone,
  LogIn,
  LogOut,
  Key,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Trash2,
  FileText,
  Lock,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { revokeSession, revokeAllSessions, logSecurityEvent } from "@/lib/securityLogger";
import { toast } from "sonner";

interface LoginHistory {
  id: string;
  login_at: string;
  ip_address: string | null;
  user_agent: string | null;
  success: boolean;
  failure_reason: string | null;
  mfa_used: boolean;
}

interface SecurityEvent {
  id: string;
  event_type: string;
  event_description: string;
  metadata: Record<string, unknown>;
  created_at: string;
  ip_address: string | null;
}

interface ActiveSession {
  id: string;
  device_info: string | null;
  ip_address: string | null;
  location: string | null;
  last_active_at: string;
  created_at: string;
  is_current: boolean;
}

interface SecurityDashboardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const getDeviceIcon = (deviceInfo: string | null) => {
  if (!deviceInfo) return <Monitor className="h-4 w-4" />;
  const info = deviceInfo.toLowerCase();
  if (info.includes('iphone') || info.includes('android') || info.includes('mobile')) {
    return <Smartphone className="h-4 w-4" />;
  }
  return <Monitor className="h-4 w-4" />;
};

const getEventIcon = (eventType: string) => {
  switch (eventType) {
    case 'login_success':
      return <LogIn className="h-4 w-4 text-green-500" />;
    case 'login_failed':
      return <XCircle className="h-4 w-4 text-destructive" />;
    case 'logout':
      return <LogOut className="h-4 w-4 text-muted-foreground" />;
    case 'mfa_enabled':
    case 'mfa_verified':
      return <Shield className="h-4 w-4 text-green-500" />;
    case 'mfa_disabled':
      return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
    case 'recovery_code_used':
    case 'recovery_codes_regenerated':
      return <Key className="h-4 w-4 text-blue-500" />;
    case 'password_changed':
      return <Lock className="h-4 w-4 text-primary" />;
    case 'session_revoked':
      return <Trash2 className="h-4 w-4 text-destructive" />;
    case 'document_uploaded':
    case 'document_deleted':
      return <FileText className="h-4 w-4 text-muted-foreground" />;
    default:
      return <Shield className="h-4 w-4" />;
  }
};

const parseUserAgent = (ua: string | null): string => {
  if (!ua) return 'Unknown';
  
  let device = 'Unknown Device';
  if (/iPhone/.test(ua)) device = 'iPhone';
  else if (/iPad/.test(ua)) device = 'iPad';
  else if (/Android/.test(ua)) device = 'Android';
  else if (/Mac/.test(ua)) device = 'Mac';
  else if (/Windows/.test(ua)) device = 'Windows';
  else if (/Linux/.test(ua)) device = 'Linux';
  
  let browser = '';
  if (/Chrome/.test(ua) && !/Edge/.test(ua)) browser = 'Chrome';
  else if (/Firefox/.test(ua)) browser = 'Firefox';
  else if (/Safari/.test(ua) && !/Chrome/.test(ua)) browser = 'Safari';
  else if (/Edge/.test(ua)) browser = 'Edge';
  
  return browser ? `${device} • ${browser}` : device;
};

export const SecurityDashboard = ({ open, onOpenChange }: SecurityDashboardProps) => {
  const { user } = useAuth();
  const [loginHistory, setLoginHistory] = useState<LoginHistory[]>([]);
  const [securityEvents, setSecurityEvents] = useState<SecurityEvent[]>([]);
  const [activeSessions, setActiveSessions] = useState<ActiveSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = async () => {
    if (!user) return;

    try {
      // Using type assertion due to types not yet being updated after migration
      const [historyRes, eventsRes, sessionsRes] = await Promise.all([
        (supabase.from('login_history') as any)
          .select('*')
          .eq('user_id', user.id)
          .order('login_at', { ascending: false })
          .limit(50),
        (supabase.from('security_events') as any)
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(50),
        (supabase.from('active_sessions') as any)
          .select('*')
          .eq('user_id', user.id)
          .order('last_active_at', { ascending: false }),
      ]);

      if (historyRes.data) setLoginHistory(historyRes.data);
      if (eventsRes.data) setSecurityEvents(eventsRes.data as SecurityEvent[]);
      if (sessionsRes.data) setActiveSessions(sessionsRes.data);
    } catch (error) {
      console.error('Error fetching security data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (open && user) {
      setLoading(true);
      fetchData();
    }
  }, [open, user]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  const handleRevokeSession = async (sessionId: string) => {
    await revokeSession(sessionId);
    if (user) {
      await logSecurityEvent(user.id, 'session_revoked', 'Session was revoked');
    }
    toast.success("Session revoked successfully");
    fetchData();
  };

  const handleRevokeAllSessions = async () => {
    if (!user) return;
    await revokeAllSessions(user.id, true);
    await logSecurityEvent(user.id, 'session_revoked', 'All other sessions were revoked');
    toast.success("All other sessions revoked");
    fetchData();
  };

  const successfulLogins = loginHistory.filter(l => l.success).length;
  const failedLogins = loginHistory.filter(l => !l.success).length;
  const mfaLogins = loginHistory.filter(l => l.mfa_used).length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[85vh] bg-card border-border">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <Shield className="h-5 w-5 text-primary" />
            Security Dashboard
          </DialogTitle>
          <DialogDescription>
            Monitor your account security, login activity, and active sessions
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center justify-between mb-4">
          <div className="flex gap-4 text-sm">
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              <span>{successfulLogins} successful</span>
            </div>
            <div className="flex items-center gap-1.5">
              <XCircle className="h-4 w-4 text-destructive" />
              <span>{failedLogins} failed</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Shield className="h-4 w-4 text-primary" />
              <span>{mfaLogins} with MFA</span>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={refreshing}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>

        <Tabs defaultValue="sessions" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="sessions">
              Active Sessions ({activeSessions.length})
            </TabsTrigger>
            <TabsTrigger value="logins">
              Login History
            </TabsTrigger>
            <TabsTrigger value="events">
              Security Events
            </TabsTrigger>
          </TabsList>

          <TabsContent value="sessions" className="mt-4">
            <div className="flex justify-end mb-3">
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="destructive"
                    size="sm"
                    disabled={activeSessions.filter(s => !s.is_current).length === 0}
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Revoke All Other Sessions
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Revoke all other sessions?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will log you out from all other devices. You'll remain logged in on this device.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handleRevokeAllSessions}>
                      Revoke All
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>

            <ScrollArea className="h-[350px]">
              {loading ? (
                <div className="flex items-center justify-center h-32">
                  <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : activeSessions.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No active sessions found
                </div>
              ) : (
                <div className="space-y-3">
                  {activeSessions.map((session, index) => (
                    <motion.div
                      key={session.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.05 }}
                      className={`p-4 rounded-lg border ${
                        session.is_current
                          ? 'border-primary/50 bg-primary/5'
                          : 'border-border bg-muted/30'
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-3">
                          <div className="p-2 rounded-full bg-muted">
                            {getDeviceIcon(session.device_info)}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-medium">
                                {session.device_info || 'Unknown Device'}
                              </span>
                              {session.is_current && (
                                <Badge variant="secondary" className="text-xs">
                                  Current
                                </Badge>
                              )}
                            </div>
                            <p className="text-sm text-muted-foreground">
                              Last active {formatDistanceToNow(new Date(session.last_active_at), { addSuffix: true })}
                            </p>
                            <p className="text-xs text-muted-foreground mt-1">
                              Started {format(new Date(session.created_at), 'PPp')}
                            </p>
                          </div>
                        </div>
                        {!session.is_current && (
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive">
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Revoke this session?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  This will log out the device from your account.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={() => handleRevokeSession(session.id)}>
                                  Revoke
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        )}
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </TabsContent>

          <TabsContent value="logins" className="mt-4">
            <ScrollArea className="h-[380px]">
              {loading ? (
                <div className="flex items-center justify-center h-32">
                  <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : loginHistory.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No login history found
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Status</TableHead>
                      <TableHead>Device</TableHead>
                      <TableHead>MFA</TableHead>
                      <TableHead>Time</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loginHistory.map((login) => (
                      <TableRow key={login.id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {login.success ? (
                              <CheckCircle2 className="h-4 w-4 text-green-500" />
                            ) : (
                              <XCircle className="h-4 w-4 text-destructive" />
                            )}
                            <span className={login.success ? 'text-green-600' : 'text-destructive'}>
                              {login.success ? 'Success' : 'Failed'}
                            </span>
                          </div>
                          {login.failure_reason && (
                            <p className="text-xs text-muted-foreground mt-1">
                              {login.failure_reason}
                            </p>
                          )}
                        </TableCell>
                        <TableCell className="text-sm">
                          {parseUserAgent(login.user_agent)}
                        </TableCell>
                        <TableCell>
                          {login.mfa_used ? (
                            <Badge variant="secondary" className="text-xs">
                              <Shield className="h-3 w-3 mr-1" />
                              MFA
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground text-xs">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {format(new Date(login.login_at), 'PPp')}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </ScrollArea>
          </TabsContent>

          <TabsContent value="events" className="mt-4">
            <ScrollArea className="h-[380px]">
              {loading ? (
                <div className="flex items-center justify-center h-32">
                  <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : securityEvents.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No security events found
                </div>
              ) : (
                <div className="space-y-2">
                  {securityEvents.map((event, index) => (
                    <motion.div
                      key={event.id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.03 }}
                      className="flex items-start gap-3 p-3 rounded-lg border border-border bg-muted/20 hover:bg-muted/40 transition-colors"
                    >
                      <div className="p-1.5 rounded-full bg-muted">
                        {getEventIcon(event.event_type)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium">{event.event_description}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {format(new Date(event.created_at), 'PPp')}
                        </p>
                      </div>
                      <Badge variant="outline" className="text-xs shrink-0">
                        {event.event_type.replace(/_/g, ' ')}
                      </Badge>
                    </motion.div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};
