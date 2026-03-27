import { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate, Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Shield, ArrowLeft, Users, Activity, AlertTriangle, TrendingDown, Eye, RefreshCw, Lock, Unlock, FileWarning, Upload, ClipboardCheck, Bell, BellRing, CheckCircle2, XCircle, Clock, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { useAuth } from "@/hooks/useAuth";
import { useAdminRole } from "@/hooks/useAdminRole";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import DocumentVerificationAudit, { DEFAULT_CHECK_EXPLANATIONS, type DocumentAuditData } from "@/components/DocumentVerificationAudit";

interface CrossAccountSignal {
  id: string;
  signal_type: string;
  fingerprint_hash: string;
  account_count: number;
  confidence_score: number;
  severity: string;
  first_seen_at: string;
  last_seen_at: string;
  metadata: any;
}

interface TrustHistoryEntry {
  id: string;
  user_id: string;
  event_type: string;
  trust_score_at_time: number;
  trust_delta: number;
  decay_applied: number | null;
  inertia_factor: number | null;
  rules_satisfied: string[] | null;
  rules_violated: string[] | null;
  created_at: string;
}

interface EvaluationMeta {
  id: string;
  user_id: string;
  jitter_seed: number;
  jitter_epoch: number;
  boundary_hugging_score: number;
  boundary_events: number;
  last_random_audit_at: string | null;
  updated_at: string;
}

interface ProfileInfo {
  user_id: string;
  email: string;
  full_name: string | null;
  failed_login_attempts: number;
  account_locked_at: string | null;
}

interface UploadEvent {
  id: string;
  user_id: string;
  file_name: string;
  file_size: number;
  mime_type: string | null;
  event_type: string;
  failure_reason: string | null;
  failure_step: string | null;
  severity: string;
  metadata: any;
  created_at: string;
}

interface AdminDocument {
  id: string;
  user_id: string;
  file_name: string;
  document_category: string;
  is_verified: boolean;
  verification_result: any;
  created_at: string;
}

type AlertSeverity = "critical" | "high" | "medium" | "info";
type AlertCategory = "fraud" | "auth" | "upload" | "trust" | "system";

interface AdminAlert {
  id: string;
  severity: AlertSeverity;
  category: AlertCategory;
  title: string;
  detail: string;
  timestamp: string;
  sourceId: string;
  acknowledged: boolean;
}

const SEVERITY_ORDER: Record<AlertSeverity, number> = { critical: 0, high: 1, medium: 2, info: 3 };

const AdminSecurity = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { isAdmin, loading: roleLoading } = useAdminRole();
  const { toast } = useToast();

  const [crossSignals, setCrossSignals] = useState<CrossAccountSignal[]>([]);
  const [trustHistory, setTrustHistory] = useState<TrustHistoryEntry[]>([]);
  const [evalMeta, setEvalMeta] = useState<EvaluationMeta[]>([]);
  const [profiles, setProfiles] = useState<ProfileInfo[]>([]);
  const [uploadEvents, setUploadEvents] = useState<UploadEvent[]>([]);
  const [adminDocs, setAdminDocs] = useState<AdminDocument[]>([]);
  const [selectedAuditDoc, setSelectedAuditDoc] = useState<AdminDocument | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [acknowledgedAlerts, setAcknowledgedAlerts] = useState<Set<string>>(new Set());
  const [alertFilter, setAlertFilter] = useState<AlertCategory | "all">("all");

  useEffect(() => {
    if (!authLoading && !roleLoading) {
      if (!user) navigate("/auth");
      else if (!isAdmin) navigate("/vault");
    }
  }, [user, isAdmin, authLoading, roleLoading, navigate]);

  useEffect(() => {
    if (isAdmin) fetchAll();
  }, [isAdmin]);

  const fetchAll = async () => {
    setRefreshing(true);
    const [signalsRes, historyRes, evalRes, profilesRes, uploadEventsRes, docsRes] = await Promise.all([
      (supabase.from("cross_account_signals") as any).select("*").order("last_seen_at", { ascending: false }).limit(50),
      (supabase.from("trust_history") as any).select("*").order("created_at", { ascending: false }).limit(100),
      (supabase.from("evaluation_metadata") as any).select("*").order("boundary_hugging_score", { ascending: false }),
      (supabase.from("profiles") as any).select("user_id, email, full_name, failed_login_attempts, account_locked_at"),
      (supabase.from("document_upload_events") as any).select("*").order("created_at", { ascending: false }).limit(200),
      (supabase.from("documents") as any).select("id, user_id, file_name, document_category, is_verified, verification_result, created_at").order("created_at", { ascending: false }).limit(200),
    ]);

    if (signalsRes.data) setCrossSignals(signalsRes.data);
    if (historyRes.data) setTrustHistory(historyRes.data);
    if (evalRes.data) setEvalMeta(evalRes.data);
    if (profilesRes.data) setProfiles(profilesRes.data);
    if (uploadEventsRes.data) setUploadEvents(uploadEventsRes.data);
    if (docsRes.data) setAdminDocs(docsRes.data);
    setRefreshing(false);
  };

  // Auto-refresh every 30 seconds
  useEffect(() => {
    if (!isAdmin) return;
    const interval = setInterval(fetchAll, 30000);
    return () => clearInterval(interval);
  }, [isAdmin]);

  // Generate alerts from all data sources
  const alerts = useMemo<AdminAlert[]>(() => {
    const result: AdminAlert[] = [];

    // Locked accounts → critical auth alerts
    profiles.filter(p => p.account_locked_at).forEach(p => {
      result.push({
        id: `locked-${p.user_id}`,
        severity: "critical",
        category: "auth",
        title: "Account Locked",
        detail: `${p.email} locked after ${p.failed_login_attempts} failed attempts`,
        timestamp: p.account_locked_at!,
        sourceId: p.user_id,
        acknowledged: acknowledgedAlerts.has(`locked-${p.user_id}`),
      });
    });

    // Near-lockout accounts (4-5 failed attempts) → high auth alerts
    profiles.filter(p => p.failed_login_attempts >= 4 && !p.account_locked_at).forEach(p => {
      result.push({
        id: `near-lock-${p.user_id}`,
        severity: "high",
        category: "auth",
        title: "Near Lockout",
        detail: `${p.email} has ${p.failed_login_attempts}/6 failed login attempts`,
        timestamp: new Date().toISOString(),
        sourceId: p.user_id,
        acknowledged: acknowledgedAlerts.has(`near-lock-${p.user_id}`),
      });
    });

    // High-severity cross-account signals → critical fraud alerts
    crossSignals.filter(s => s.severity === "high").forEach(s => {
      result.push({
        id: `signal-${s.id}`,
        severity: "critical",
        category: "fraud",
        title: "High-Severity Cluster Detected",
        detail: `${s.signal_type}: ${s.account_count} accounts, ${(s.confidence_score * 100).toFixed(0)}% confidence`,
        timestamp: s.last_seen_at,
        sourceId: s.id,
        acknowledged: acknowledgedAlerts.has(`signal-${s.id}`),
      });
    });

    // Medium cross-account signals → medium fraud alerts
    crossSignals.filter(s => s.severity === "medium").forEach(s => {
      result.push({
        id: `signal-${s.id}`,
        severity: "medium",
        category: "fraud",
        title: "Cross-Account Signal",
        detail: `${s.signal_type}: ${s.account_count} accounts linked`,
        timestamp: s.last_seen_at,
        sourceId: s.id,
        acknowledged: acknowledgedAlerts.has(`signal-${s.id}`),
      });
    });

    // Security upload failures → high upload alerts
    uploadEvents.filter(e => e.event_type === "security_failure").slice(0, 20).forEach(e => {
      result.push({
        id: `upload-${e.id}`,
        severity: "high",
        category: "upload",
        title: "Security Upload Failure",
        detail: `${e.file_name} rejected: ${e.failure_reason || "security violation"}`,
        timestamp: e.created_at,
        sourceId: e.id,
        acknowledged: acknowledgedAlerts.has(`upload-${e.id}`),
      });
    });

    // Boundary huggers (score > 50) → medium trust alerts
    evalMeta.filter(e => e.boundary_hugging_score > 50).forEach(e => {
      const email = profiles.find(p => p.user_id === e.user_id)?.email || e.user_id.substring(0, 8);
      result.push({
        id: `boundary-${e.id}`,
        severity: e.boundary_hugging_score > 75 ? "high" : "medium",
        category: "trust",
        title: "Boundary Hugging Detected",
        detail: `${email}: score ${e.boundary_hugging_score.toFixed(0)}, ${e.boundary_events} events`,
        timestamp: e.updated_at,
        sourceId: e.id,
        acknowledged: acknowledgedAlerts.has(`boundary-${e.id}`),
      });
    });

    // Major trust drops → high trust alerts
    trustHistory.filter(h => h.trust_delta < -10).slice(0, 10).forEach(h => {
      const email = profiles.find(p => p.user_id === h.user_id)?.email || h.user_id.substring(0, 8);
      result.push({
        id: `trust-drop-${h.id}`,
        severity: h.trust_delta < -20 ? "critical" : "high",
        category: "trust",
        title: "Significant Trust Drop",
        detail: `${email}: ${h.trust_delta} points (now ${h.trust_score_at_time})`,
        timestamp: h.created_at,
        sourceId: h.id,
        acknowledged: acknowledgedAlerts.has(`trust-drop-${h.id}`),
      });
    });

    // Sort by severity, then timestamp
    result.sort((a, b) => {
      if (a.acknowledged !== b.acknowledged) return a.acknowledged ? 1 : -1;
      const sevDiff = SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity];
      if (sevDiff !== 0) return sevDiff;
      return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
    });

    return result;
  }, [profiles, crossSignals, uploadEvents, evalMeta, trustHistory, acknowledgedAlerts]);

  const unacknowledgedCount = alerts.filter(a => !a.acknowledged).length;
  const filteredAlerts = alertFilter === "all" ? alerts : alerts.filter(a => a.category === alertFilter);

  const acknowledgeAlert = useCallback((alertId: string) => {
    setAcknowledgedAlerts(prev => new Set([...prev, alertId]));
  }, []);

  const acknowledgeAll = useCallback(() => {
    setAcknowledgedAlerts(new Set(alerts.map(a => a.id)));
  }, [alerts]);

  const severityBadgeClass = (s: AlertSeverity) => {
    switch (s) {
      case "critical": return "bg-destructive/15 text-destructive border-destructive/30";
      case "high": return "bg-[hsl(var(--warning-amber))]/15 text-[hsl(var(--warning-amber))] border-[hsl(var(--warning-amber))]/30";
      case "medium": return "bg-secondary text-secondary-foreground";
      default: return "bg-muted text-muted-foreground";
    }
  };

  const categoryIcon = (c: AlertCategory) => {
    switch (c) {
      case "fraud": return <AlertTriangle size={14} />;
      case "auth": return <Lock size={14} />;
      case "upload": return <FileWarning size={14} />;
      case "trust": return <TrendingDown size={14} />;
      case "system": return <Zap size={14} />;
    }
  };

  const getEmail = (userId: string) => {
    const p = profiles.find((pr) => pr.user_id === userId);
    return p?.email ?? userId.substring(0, 8) + "…";
  };

  const severityColor = (s: string) => {
    switch (s) {
      case "high": return "destructive";
      case "medium": return "secondary";
      default: return "outline";
    }
  };

  // Stats
  const lockedAccounts = profiles.filter((p) => p.account_locked_at !== null);
  const highSeverityClusters = crossSignals.filter((s) => s.severity === "high").length;
  const boundaryHuggers = evalMeta.filter((e) => e.boundary_hugging_score > 50).length;
  const recentViolations = trustHistory.filter((h) => (h.rules_violated?.length ?? 0) > 0).length;
  const uniqueUsersTracked = new Set(evalMeta.map((e) => e.user_id)).size;
  const securityFailures = uploadEvents.filter((e) => e.event_type === 'security_failure').length;
  const technicalFailures = uploadEvents.filter((e) => e.event_type === 'technical_failure').length;

  const handleUnlock = async (targetUserId: string) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await supabase.functions.invoke("admin-unlock-account", {
        body: { target_user_id: targetUserId },
      });
      if (res.error) throw res.error;
      toast({ title: "Account unlocked", description: "User can now log in again." });
      fetchAll();
    } catch (err: any) {
      toast({ title: "Unlock failed", description: err.message, variant: "destructive" });
    }
  };

  const CATEGORY_LABELS: Record<string, string> = {
    identity: "Identity Document",
    financial: "Financial Document",
    general: "General Document",
  };

  const buildAuditData = (doc: AdminDocument, getEmailFn: (id: string) => string): DocumentAuditData => {
    const vr = doc.verification_result || {};
    const checkNames = [
      "Magic-Byte Signature Check",
      "Malicious Content Scan",
      "SHA-256 Fingerprint",
      "EXIF & Metadata Analysis",
      "Document Structure Validation",
      "Cross-User Duplicate Detection",
      "AI Authenticity Analysis",
      "Data Consistency Check",
    ];
    const checks: import("@/components/DocumentVerificationAudit").VerificationCheck[] = checkNames.map((name) => {
      const key = name.toLowerCase().replace(/[^a-z0-9]+/g, "_");
      const passed = vr[key] !== false;
      const defaults = DEFAULT_CHECK_EXPLANATIONS[name];
      return {
        name,
        passed,
        explanation: passed ? defaults?.pass ?? "Check passed." : defaults?.fail ?? "Check failed.",
      };
    });
    return {
      documentType: CATEGORY_LABELS[doc.document_category] || doc.document_category,
      fileName: doc.file_name,
      submittedBy: getEmailFn(doc.user_id),
      submissionDate: new Date(doc.created_at).toLocaleDateString(),
      overallVerified: doc.is_verified,
      checks,
    };
  };

  if (authLoading || roleLoading) {
    return (
      <div className="min-h-screen bg-background grid-bg flex items-center justify-center">
        <div className="text-primary font-mono animate-pulse">VERIFYING CLEARANCE...</div>
      </div>
    );
  }

  if (!isAdmin) return null;

  return (
    <div className="min-h-screen bg-background grid-bg">
      <div className="p-6">
        <Link to="/vault" className="inline-flex items-center gap-2 text-muted-foreground hover:text-primary transition-colors font-mono text-sm">
          <ArrowLeft size={16} />
          Back to vault
        </Link>
      </div>

      <div className="max-w-7xl mx-auto px-6 pb-12">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-xl border border-primary/30 bg-primary/10">
                <Shield size={32} className="text-primary" />
              </div>
              <div>
                <h1 className="font-display text-2xl font-bold gradient-text">SECURITY COMMAND CENTER</h1>
                <p className="text-muted-foreground font-mono text-xs">// ADMIN-ONLY THREAT OVERVIEW //</p>
              </div>
            </div>
            <Button onClick={fetchAll} disabled={refreshing} variant="outline" size="sm" className="font-mono text-xs">
              <RefreshCw size={14} className={refreshing ? "animate-spin mr-2" : "mr-2"} />
              REFRESH
            </Button>
          </div>
        </motion.div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          {[
            { icon: Users, label: "USERS TRACKED", value: uniqueUsersTracked, color: "text-primary" },
            { icon: Lock, label: "LOCKED ACCOUNTS", value: lockedAccounts.length, color: "text-destructive" },
            { icon: AlertTriangle, label: "HIGH-SEV CLUSTERS", value: highSeverityClusters, color: "text-destructive" },
            { icon: Eye, label: "BOUNDARY HUGGERS", value: boundaryHuggers, color: "text-[hsl(var(--warning-amber))]" },
            { icon: TrendingDown, label: "RULE VIOLATIONS", value: recentViolations, color: "text-[hsl(var(--neon-magenta))]" },
            { icon: FileWarning, label: "UPLOAD SECURITY FAILS", value: securityFailures, color: "text-destructive" },
            { icon: Upload, label: "UPLOAD TECH FAILS", value: technicalFailures, color: "text-[hsl(var(--warning-amber))]" },
          ].map((stat) => (
            <Card key={stat.label} className="cyber-border">
              <CardContent className="p-4 flex items-center gap-4">
                <stat.icon size={24} className={stat.color} />
                <div>
                  <p className="text-muted-foreground font-mono text-[10px]">{stat.label}</p>
                  <p className={`font-display text-2xl font-bold ${stat.color}`}>{stat.value}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <Tabs defaultValue="locked" className="space-y-6">
          <TabsList className="bg-card border border-border flex-wrap">
            <TabsTrigger value="locked" className="font-mono text-xs">LOCKED ACCOUNTS</TabsTrigger>
            <TabsTrigger value="doc-audits" className="font-mono text-xs">DOC AUDITS</TabsTrigger>
            <TabsTrigger value="uploads" className="font-mono text-xs">UPLOAD EVENTS</TabsTrigger>
            <TabsTrigger value="clusters" className="font-mono text-xs">CROSS-ACCOUNT CLUSTERS</TabsTrigger>
            <TabsTrigger value="boundary" className="font-mono text-xs">BOUNDARY HUGGING</TabsTrigger>
            <TabsTrigger value="timeline" className="font-mono text-xs">TRUST TIMELINE</TabsTrigger>
          </TabsList>

          {/* Locked Accounts */}
          <TabsContent value="locked">
            <Card className="cyber-border">
              <CardHeader>
                <CardTitle className="font-display text-lg gradient-text flex items-center gap-2">
                  <Lock size={18} />
                  LOCKED ACCOUNTS (NIST 800-53 AC-7)
                </CardTitle>
              </CardHeader>
              <CardContent>
                {lockedAccounts.length === 0 ? (
                  <p className="text-muted-foreground font-mono text-sm text-center py-8">NO LOCKED ACCOUNTS</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="font-mono text-xs">EMAIL</TableHead>
                        <TableHead className="font-mono text-xs">NAME</TableHead>
                        <TableHead className="font-mono text-xs">FAILED ATTEMPTS</TableHead>
                        <TableHead className="font-mono text-xs">LOCKED AT</TableHead>
                        <TableHead className="font-mono text-xs">ACTION</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {lockedAccounts.map((profile) => (
                        <TableRow key={profile.user_id}>
                          <TableCell className="font-mono text-xs">{profile.email}</TableCell>
                          <TableCell className="font-mono text-xs text-muted-foreground">{profile.full_name ?? "—"}</TableCell>
                          <TableCell>
                            <Badge variant="destructive" className="font-mono text-[10px]">
                              {profile.failed_login_attempts} ATTEMPTS
                            </Badge>
                          </TableCell>
                          <TableCell className="font-mono text-xs text-muted-foreground">
                            {profile.account_locked_at ? new Date(profile.account_locked_at).toLocaleString() : "—"}
                          </TableCell>
                          <TableCell>
                            <Button
                              size="sm"
                              variant="outline"
                              className="font-mono text-xs gap-1"
                              onClick={() => handleUnlock(profile.user_id)}
                            >
                              <Unlock size={12} />
                              UNLOCK
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Document Verification Audits */}
          <TabsContent value="doc-audits">
            {selectedAuditDoc ? (
              <div className="space-y-4">
                <Button variant="ghost" size="sm" className="font-mono text-xs gap-1" onClick={() => setSelectedAuditDoc(null)}>
                  <ArrowLeft size={14} /> BACK TO LIST
                </Button>
                <DocumentVerificationAudit
                  audit={buildAuditData(selectedAuditDoc, getEmail)}
                />
              </div>
            ) : (
              <Card className="cyber-border">
                <CardHeader>
                  <CardTitle className="font-display text-lg gradient-text flex items-center gap-2">
                    <ClipboardCheck size={18} />
                    DOCUMENT VERIFICATION AUDITS
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {adminDocs.length === 0 ? (
                    <p className="text-muted-foreground font-mono text-sm text-center py-8">NO DOCUMENTS FOUND</p>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="font-mono text-xs">USER</TableHead>
                          <TableHead className="font-mono text-xs">FILE</TableHead>
                          <TableHead className="font-mono text-xs">CATEGORY</TableHead>
                          <TableHead className="font-mono text-xs">STATUS</TableHead>
                          <TableHead className="font-mono text-xs">SUBMITTED</TableHead>
                          <TableHead className="font-mono text-xs">ACTION</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {adminDocs.map((doc) => (
                          <TableRow key={doc.id}>
                            <TableCell className="font-mono text-xs">{getEmail(doc.user_id)}</TableCell>
                            <TableCell className="font-mono text-xs max-w-[180px] truncate" title={doc.file_name}>{doc.file_name}</TableCell>
                            <TableCell>
                              <Badge variant="outline" className="font-mono text-[10px] uppercase">{doc.document_category}</Badge>
                            </TableCell>
                            <TableCell>
                              <Badge className={`font-mono text-[10px] ${doc.is_verified ? "bg-[#1D9E75]/15 text-[#1D9E75] border-[#1D9E75]/30" : "bg-[#E24B4A]/15 text-[#E24B4A] border-[#E24B4A]/30"}`}>
                                {doc.is_verified ? "VERIFIED" : "FLAGGED"}
                              </Badge>
                            </TableCell>
                            <TableCell className="font-mono text-xs text-muted-foreground">{new Date(doc.created_at).toLocaleDateString()}</TableCell>
                            <TableCell>
                              <Button size="sm" variant="outline" className="font-mono text-xs gap-1" onClick={() => setSelectedAuditDoc(doc)}>
                                <Eye size={12} /> VIEW AUDIT
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="uploads">
            <Card className="cyber-border">
              <CardHeader>
                <CardTitle className="font-display text-lg gradient-text flex items-center gap-2">
                  <FileWarning size={18} />
                  DOCUMENT UPLOAD EVENTS
                </CardTitle>
              </CardHeader>
              <CardContent>
                {uploadEvents.length === 0 ? (
                  <p className="text-muted-foreground font-mono text-sm text-center py-8">NO UPLOAD EVENTS RECORDED</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="font-mono text-xs">USER</TableHead>
                        <TableHead className="font-mono text-xs">FILE</TableHead>
                        <TableHead className="font-mono text-xs">TYPE</TableHead>
                        <TableHead className="font-mono text-xs">RESULT</TableHead>
                        <TableHead className="font-mono text-xs">FAILED STEP</TableHead>
                        <TableHead className="font-mono text-xs">REASON</TableHead>
                        <TableHead className="font-mono text-xs">SEVERITY</TableHead>
                        <TableHead className="font-mono text-xs">TIME</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {uploadEvents.map((event) => {
                        const resultVariant = event.event_type === 'success' ? 'outline' :
                          event.event_type === 'security_failure' ? 'destructive' : 'secondary';
                        const resultLabel = event.event_type === 'success' ? 'SUCCESS' :
                          event.event_type === 'security_failure' ? 'SECURITY' : 'TECHNICAL';
                        const sevVariant = event.severity === 'critical' ? 'destructive' :
                          event.severity === 'warning' ? 'secondary' : 'outline';
                        return (
                          <TableRow key={event.id}>
                            <TableCell className="font-mono text-xs">{getEmail(event.user_id)}</TableCell>
                            <TableCell className="font-mono text-xs max-w-[150px] truncate" title={event.file_name}>{event.file_name}</TableCell>
                            <TableCell className="font-mono text-xs text-muted-foreground">{event.mime_type || '—'}</TableCell>
                            <TableCell>
                              <Badge variant={resultVariant as any} className="font-mono text-[10px]">{resultLabel}</Badge>
                            </TableCell>
                            <TableCell className="font-mono text-xs text-muted-foreground">{event.failure_step || '—'}</TableCell>
                            <TableCell className="font-mono text-xs text-muted-foreground max-w-[200px] truncate" title={event.failure_reason || ''}>
                              {event.failure_reason || '—'}
                            </TableCell>
                            <TableCell>
                              <Badge variant={sevVariant as any} className="font-mono text-[10px]">{event.severity.toUpperCase()}</Badge>
                            </TableCell>
                            <TableCell className="font-mono text-xs text-muted-foreground">
                              {new Date(event.created_at).toLocaleString()}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="clusters">
            <Card className="cyber-border">
              <CardHeader>
                <CardTitle className="font-display text-lg gradient-text flex items-center gap-2">
                  <Activity size={18} />
                  CROSS-ACCOUNT CORRELATION SIGNALS
                </CardTitle>
              </CardHeader>
              <CardContent>
                {crossSignals.length === 0 ? (
                  <p className="text-muted-foreground font-mono text-sm text-center py-8">NO SIGNALS DETECTED</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="font-mono text-xs">TYPE</TableHead>
                        <TableHead className="font-mono text-xs">FINGERPRINT</TableHead>
                        <TableHead className="font-mono text-xs">ACCOUNTS</TableHead>
                        <TableHead className="font-mono text-xs">CONFIDENCE</TableHead>
                        <TableHead className="font-mono text-xs">SEVERITY</TableHead>
                        <TableHead className="font-mono text-xs">LAST SEEN</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {crossSignals.map((signal) => (
                        <TableRow key={signal.id}>
                          <TableCell className="font-mono text-xs">{signal.signal_type}</TableCell>
                          <TableCell className="font-mono text-xs text-muted-foreground">{signal.fingerprint_hash.substring(0, 12)}…</TableCell>
                          <TableCell className="font-display font-bold">{signal.account_count}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Progress value={signal.confidence_score * 100} className="h-2 w-16" />
                              <span className="font-mono text-xs">{(signal.confidence_score * 100).toFixed(0)}%</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant={severityColor(signal.severity) as any} className="font-mono text-[10px]">
                              {signal.severity.toUpperCase()}
                            </Badge>
                          </TableCell>
                          <TableCell className="font-mono text-xs text-muted-foreground">
                            {new Date(signal.last_seen_at).toLocaleDateString()}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Boundary Hugging */}
          <TabsContent value="boundary">
            <Card className="cyber-border">
              <CardHeader>
                <CardTitle className="font-display text-lg gradient-text flex items-center gap-2">
                  <Eye size={18} />
                  BOUNDARY-HUGGING SCORES
                </CardTitle>
              </CardHeader>
              <CardContent>
                {evalMeta.length === 0 ? (
                  <p className="text-muted-foreground font-mono text-sm text-center py-8">NO EVALUATION DATA</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="font-mono text-xs">USER</TableHead>
                        <TableHead className="font-mono text-xs">HUGGING SCORE</TableHead>
                        <TableHead className="font-mono text-xs">EVENTS</TableHead>
                        <TableHead className="font-mono text-xs">JITTER EPOCH</TableHead>
                        <TableHead className="font-mono text-xs">LAST AUDIT</TableHead>
                        <TableHead className="font-mono text-xs">RISK</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {evalMeta.map((meta) => {
                        const risk = meta.boundary_hugging_score > 75 ? "CRITICAL" : meta.boundary_hugging_score > 50 ? "HIGH" : meta.boundary_hugging_score > 25 ? "MEDIUM" : "LOW";
                        const riskVariant = risk === "CRITICAL" || risk === "HIGH" ? "destructive" : risk === "MEDIUM" ? "secondary" : "outline";
                        return (
                          <TableRow key={meta.id}>
                            <TableCell className="font-mono text-xs">{getEmail(meta.user_id)}</TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <Progress value={meta.boundary_hugging_score} className="h-2 w-20" />
                                <span className="font-display font-bold text-sm">{meta.boundary_hugging_score.toFixed(0)}</span>
                              </div>
                            </TableCell>
                            <TableCell className="font-display font-bold">{meta.boundary_events}</TableCell>
                            <TableCell className="font-mono text-xs text-muted-foreground">{meta.jitter_epoch}</TableCell>
                            <TableCell className="font-mono text-xs text-muted-foreground">
                              {meta.last_random_audit_at ? new Date(meta.last_random_audit_at).toLocaleDateString() : "—"}
                            </TableCell>
                            <TableCell>
                              <Badge variant={riskVariant as any} className="font-mono text-[10px]">{risk}</Badge>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Trust Timeline */}
          <TabsContent value="timeline">
            <Card className="cyber-border">
              <CardHeader>
                <CardTitle className="font-display text-lg gradient-text flex items-center gap-2">
                  <TrendingDown size={18} />
                  TRUST EVOLUTION TIMELINE
                </CardTitle>
              </CardHeader>
              <CardContent>
                {trustHistory.length === 0 ? (
                  <p className="text-muted-foreground font-mono text-sm text-center py-8">NO TRUST HISTORY</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="font-mono text-xs">USER</TableHead>
                        <TableHead className="font-mono text-xs">EVENT</TableHead>
                        <TableHead className="font-mono text-xs">SCORE</TableHead>
                        <TableHead className="font-mono text-xs">DELTA</TableHead>
                        <TableHead className="font-mono text-xs">DECAY</TableHead>
                        <TableHead className="font-mono text-xs">VIOLATIONS</TableHead>
                        <TableHead className="font-mono text-xs">TIME</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {trustHistory.map((entry) => (
                        <TableRow key={entry.id}>
                          <TableCell className="font-mono text-xs">{getEmail(entry.user_id)}</TableCell>
                          <TableCell className="font-mono text-xs">{entry.event_type}</TableCell>
                          <TableCell className="font-display font-bold">{entry.trust_score_at_time}</TableCell>
                          <TableCell>
                            <span className={`font-display font-bold ${entry.trust_delta > 0 ? "text-[hsl(var(--secure-green))]" : entry.trust_delta < 0 ? "text-destructive" : "text-muted-foreground"}`}>
                              {entry.trust_delta > 0 ? "+" : ""}{entry.trust_delta}
                            </span>
                          </TableCell>
                          <TableCell className="font-mono text-xs text-muted-foreground">
                            {entry.decay_applied ? `-${Number(entry.decay_applied).toFixed(1)}` : "—"}
                          </TableCell>
                          <TableCell>
                            {(entry.rules_violated?.length ?? 0) > 0 ? (
                              <Badge variant="destructive" className="font-mono text-[10px]">
                                {entry.rules_violated!.length} VIOLATED
                              </Badge>
                            ) : (
                              <span className="text-muted-foreground font-mono text-xs">—</span>
                            )}
                          </TableCell>
                          <TableCell className="font-mono text-xs text-muted-foreground">
                            {new Date(entry.created_at).toLocaleString()}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default AdminSecurity;
