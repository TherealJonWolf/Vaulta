import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Shield, ArrowLeft, Users, Activity, AlertTriangle, TrendingDown, Eye, RefreshCw, Lock, Unlock, FileWarning, Upload } from "lucide-react";
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
  const [refreshing, setRefreshing] = useState(false);

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
    const [signalsRes, historyRes, evalRes, profilesRes, uploadEventsRes] = await Promise.all([
      (supabase.from("cross_account_signals") as any).select("*").order("last_seen_at", { ascending: false }).limit(50),
      (supabase.from("trust_history") as any).select("*").order("created_at", { ascending: false }).limit(100),
      (supabase.from("evaluation_metadata") as any).select("*").order("boundary_hugging_score", { ascending: false }),
      (supabase.from("profiles") as any).select("user_id, email, full_name, failed_login_attempts, account_locked_at"),
      (supabase.from("document_upload_events") as any).select("*").order("created_at", { ascending: false }).limit(200),
    ]);

    if (signalsRes.data) setCrossSignals(signalsRes.data);
    if (historyRes.data) setTrustHistory(historyRes.data);
    if (evalRes.data) setEvalMeta(evalRes.data);
    if (profilesRes.data) setProfiles(profilesRes.data);
    if (uploadEventsRes.data) setUploadEvents(uploadEventsRes.data);
    setRefreshing(false);
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
          <TabsList className="bg-card border border-border">
            <TabsTrigger value="locked" className="font-mono text-xs">LOCKED ACCOUNTS</TabsTrigger>
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

          {/* Cross-Account Clusters */}
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
