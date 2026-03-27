import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Landmark, ArrowLeft, Users, ShieldCheck, ShieldAlert, Shield,
  Clock, Trash2, ExternalLink, RefreshCw, Search, StickyNote,
  BookmarkPlus, FileCheck, Lock, Scale, AlertTriangle, CheckCircle2,
  Eye, BadgeCheck, Fingerprint, Server, Calendar, Link2, Globe
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { ApplicantNarratives, ApplicantScoreIndicator } from "@/components/ApplicantNarratives";

interface SavedApplicant {
  id: string;
  landlord_user_id: string;
  applicant_user_id: string;
  shared_token_id: string | null;
  notes: string | null;
  saved_at: string;
  token?: string;
  tokenLabel?: string;
  tokenActive?: boolean;
}

interface ComplianceControl {
  id: string;
  name: string;
  description: string;
  status: "met" | "partial" | "review";
  framework: string;
}

const soxControls: ComplianceControl[] = [
  { id: "SOX-302", name: "Section 302 — Officer Certification", description: "Signing officers certify the accuracy of financial statements and disclosures.", status: "met", framework: "SOX" },
  { id: "SOX-404", name: "Section 404 — Internal Controls", description: "Assessment of internal control over financial reporting with audit trail.", status: "met", framework: "SOX" },
  { id: "SOX-409", name: "Section 409 — Real-Time Disclosure", description: "Material changes in financial condition disclosed on a rapid and current basis.", status: "met", framework: "SOX" },
  { id: "SOX-802", name: "Section 802 — Record Retention", description: "Alteration, destruction, or concealment of records is prohibited.", status: "met", framework: "SOX" },
];

const glbaControls: ComplianceControl[] = [
  { id: "GLBA-PRI", name: "Financial Privacy Rule", description: "Governs collection and disclosure of consumers' personal financial information.", status: "met", framework: "GLBA" },
  { id: "GLBA-SAF", name: "Safeguards Rule", description: "Financial institutions must develop a written information security plan.", status: "met", framework: "GLBA" },
  { id: "GLBA-PRE", name: "Pretexting Protection", description: "Prohibits obtaining personal financial information under false pretenses.", status: "met", framework: "GLBA" },
  { id: "GLBA-OPT", name: "Opt-Out Provisions", description: "Consumers can opt out of having information shared with unaffiliated third parties.", status: "met", framework: "GLBA" },
];

const fcraControls: ComplianceControl[] = [
  { id: "FCRA-ACC", name: "Accuracy of Information", description: "Furnishers must report accurate and complete information to consumer reporting agencies.", status: "met", framework: "FCRA" },
  { id: "FCRA-DIS", name: "Disclosure Obligations", description: "Consumers must be informed when information is used against them in credit decisions.", status: "met", framework: "FCRA" },
  { id: "FCRA-DSP", name: "Dispute Resolution", description: "Consumers can dispute inaccurate information and agencies must investigate.", status: "met", framework: "FCRA" },
  { id: "FCRA-PER", name: "Permissible Purpose", description: "Consumer reports may only be obtained for a legally permissible purpose.", status: "met", framework: "FCRA" },
];

const LenderDashboard = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const [saved, setSaved] = useState<SavedApplicant[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [editingNotes, setEditingNotes] = useState<string | null>(null);
  const [noteText, setNoteText] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth?mode=signup&role=landlord");
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (user) fetchSaved();
  }, [user]);

  const fetchSaved = async () => {
    setRefreshing(true);
    const { data, error } = await (supabase.from("landlord_saved_applicants") as any)
      .select("*, shared_profile_tokens(token, label, is_active, expires_at)")
      .eq("landlord_user_id", user!.id)
      .order("saved_at", { ascending: false });

    if (!error && data) {
      setSaved(data.map((item: any) => ({
        ...item,
        token: item.shared_profile_tokens?.token,
        tokenLabel: item.shared_profile_tokens?.label,
        tokenActive: item.shared_profile_tokens?.is_active && new Date(item.shared_profile_tokens?.expires_at) > new Date(),
      })));
    }
    setLoading(false);
    setRefreshing(false);
  };

  const removeSaved = async (id: string) => {
    await (supabase.from("landlord_saved_applicants") as any).delete().eq("id", id);
    setSaved(prev => prev.filter(s => s.id !== id));
    toast({ title: "Removed", description: "Applicant removed from your saved list." });
  };

  const saveNotes = async (id: string) => {
    await (supabase.from("landlord_saved_applicants") as any).update({ notes: noteText }).eq("id", id);
    setSaved(prev => prev.map(s => s.id === id ? { ...s, notes: noteText } : s));
    setEditingNotes(null);
    toast({ title: "Notes Saved" });
  };

  const filtered = saved.filter(s =>
    !searchQuery ||
    s.tokenLabel?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.notes?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const StatusIcon = ({ status }: { status: string }) => {
    if (status === "met") return <CheckCircle2 size={14} className="text-emerald-500" />;
    if (status === "partial") return <AlertTriangle size={14} className="text-amber-500" />;
    return <Eye size={14} className="text-muted-foreground" />;
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-background grid-bg flex items-center justify-center">
        <div className="text-primary font-mono animate-pulse">Initializing lender portal...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background grid-bg">
      <div className="p-6">
        <Link to="/" className="inline-flex items-center gap-2 text-muted-foreground hover:text-primary transition-colors font-mono text-sm">
          <ArrowLeft size={16} />
          Back to home
        </Link>
      </div>

      <div className="max-w-6xl mx-auto px-6 pb-12">
        {/* Header */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-xl border border-primary/30 bg-primary/10">
                <Landmark size={32} className="text-primary" />
              </div>
              <div>
                <h1 className="font-display text-2xl font-bold gradient-text">LENDER DASHBOARD</h1>
                <p className="text-muted-foreground font-mono text-xs">// FINANCIAL INSTITUTION COMPLIANCE CENTER //</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge className="bg-primary/15 text-primary border-primary/30 font-mono text-[10px]">
                <Lock size={10} className="mr-1" /> E2E ENCRYPTED
              </Badge>
              <Badge className="bg-emerald-500/15 text-emerald-500 border-emerald-500/30 font-mono text-[10px]">
                <BadgeCheck size={10} className="mr-1" /> ZERO-KNOWLEDGE
              </Badge>
            </div>
          </div>
        </motion.div>

        {/* Compliance Status Banner */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <Card className="cyber-border mb-8 bg-card/80 backdrop-blur">
            <CardContent className="p-4">
              <div className="flex items-center gap-3 mb-3">
                <ShieldCheck size={20} className="text-emerald-500" />
                <span className="font-display text-sm font-bold text-foreground">REGULATORY COMPLIANCE STATUS</span>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                  { label: "SOX", desc: "Sarbanes-Oxley", color: "text-primary" },
                  { label: "GLBA", desc: "Gramm-Leach-Bliley", color: "text-emerald-500" },
                  { label: "FCRA", desc: "Fair Credit Reporting", color: "text-amber-500" },
                  { label: "SOC 2", desc: "Type II Controls", color: "text-violet-400" },
                ].map(fw => (
                  <div key={fw.label} className="p-3 rounded-lg border border-border bg-muted/20 text-center">
                    <p className={`font-display text-sm font-bold ${fw.color}`}>{fw.label}</p>
                    <p className="text-[10px] text-muted-foreground font-mono">{fw.desc}</p>
                    <Badge className="mt-1 bg-emerald-500/10 text-emerald-500 border-emerald-500/20 font-mono text-[9px]">
                      COMPLIANT
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Main Tabs */}
        <Tabs defaultValue="applicants" className="space-y-6">
          <TabsList className="bg-card/50 border border-border">
            <TabsTrigger value="applicants" className="font-mono text-xs gap-1.5">
              <Users size={14} /> Applicants
            </TabsTrigger>
            <TabsTrigger value="sox" className="font-mono text-xs gap-1.5">
              <Scale size={14} /> SOX
            </TabsTrigger>
            <TabsTrigger value="glba" className="font-mono text-xs gap-1.5">
              <Lock size={14} /> GLBA
            </TabsTrigger>
            <TabsTrigger value="fcra" className="font-mono text-xs gap-1.5">
              <FileCheck size={14} /> FCRA
            </TabsTrigger>
          </TabsList>

          {/* ── Applicants Tab ── */}
          <TabsContent value="applicants" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card className="cyber-border">
                <CardContent className="p-4 flex items-center gap-4">
                  <Users size={24} className="text-primary" />
                  <div>
                    <p className="text-muted-foreground font-mono text-[10px]">SAVED BORROWERS</p>
                    <p className="font-display text-2xl font-bold text-primary">{saved.length}</p>
                  </div>
                </CardContent>
              </Card>
              <Card className="cyber-border">
                <CardContent className="p-4 flex items-center gap-4">
                  <ShieldCheck size={24} className="text-emerald-500" />
                  <div>
                    <p className="text-muted-foreground font-mono text-[10px]">ACTIVE LINKS</p>
                    <p className="font-display text-2xl font-bold text-emerald-500">{saved.filter(s => s.tokenActive).length}</p>
                  </div>
                </CardContent>
              </Card>
              <Card className="cyber-border">
                <CardContent className="p-4 flex items-center gap-4">
                  <Clock size={24} className="text-muted-foreground" />
                  <div>
                    <p className="text-muted-foreground font-mono text-[10px]">EXPIRED</p>
                    <p className="font-display text-2xl font-bold text-muted-foreground">{saved.filter(s => !s.tokenActive).length}</p>
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input placeholder="Search borrowers by label or notes..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-9 bg-card/50" />
              </div>
              <Button onClick={fetchSaved} disabled={refreshing} variant="outline" size="sm" className="font-mono text-xs">
                <RefreshCw size={14} className={refreshing ? "animate-spin mr-1" : "mr-1"} /> REFRESH
              </Button>
            </div>

            {filtered.length === 0 ? (
              <Card className="cyber-border">
                <CardContent className="py-16 text-center">
                  <BookmarkPlus size={48} className="text-muted-foreground mx-auto mb-4" />
                  <h3 className="font-display text-lg font-bold text-foreground mb-2">No Saved Borrowers</h3>
                  <p className="text-muted-foreground font-rajdhani max-w-md mx-auto">
                    When borrowers share their verified profile with you, click "Save Applicant" to add them here for underwriting review.
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {filtered.map((item, i) => (
                  <motion.div key={item.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
                    <Card className="cyber-border card-hover">
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <Shield size={16} className="text-primary shrink-0" />
                              <span className="font-display font-bold text-sm truncate">{item.tokenLabel || "Shared Profile"}</span>
                              <ApplicantScoreIndicator applicantUserId={item.applicant_user_id} />
                              {item.tokenActive ? (
                                <Badge className="bg-emerald-500/15 text-emerald-500 border-emerald-500/30 font-mono text-[10px] shrink-0">ACTIVE</Badge>
                              ) : (
                                <Badge variant="secondary" className="font-mono text-[10px] shrink-0">EXPIRED</Badge>
                              )}
                            </div>
                            <p className="text-[11px] text-muted-foreground font-mono">Saved {new Date(item.saved_at).toLocaleDateString()}</p>
                            {item.notes && (
                              <p className="text-xs text-muted-foreground font-rajdhani mt-2 p-2 rounded bg-muted/30 border border-border">📝 {item.notes}</p>
                            )}
                            <ApplicantNarratives applicantUserId={item.applicant_user_id} applicantLabel={item.tokenLabel || "Shared Profile"} compact />
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            {item.token && item.tokenActive && (
                              <Button variant="outline" size="sm" className="font-mono text-xs gap-1" onClick={() => navigate(`/shared/${item.token}`)}>
                                <ExternalLink size={12} /> VIEW
                              </Button>
                            )}
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setEditingNotes(item.id); setNoteText(item.notes || ""); }}>
                              <StickyNote size={14} />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => removeSaved(item.id)}>
                              <Trash2 size={14} />
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                ))}
              </div>
            )}
          </TabsContent>

          {/* ── SOX Tab ── */}
          <TabsContent value="sox" className="space-y-4">
            <ComplianceFrameworkView
              title="Sarbanes-Oxley Act (SOX)"
              description="Financial record-keeping and reporting standards to protect investors from fraudulent accounting."
              controls={soxControls}
              icon={<Scale size={24} className="text-primary" />}
              features={[
                { icon: <Server size={16} />, label: "Immutable Audit Trails", desc: "All document modifications are logged with tamper-proof timestamps." },
                { icon: <Lock size={16} />, label: "Access Control Matrix", desc: "Role-based access with principle of least privilege enforced at database level." },
                { icon: <Fingerprint size={16} />, label: "Data Integrity Verification", desc: "SHA-256 document hashing ensures no unauthorized alterations." },
                { icon: <Eye size={16} />, label: "Real-Time Monitoring", desc: "Continuous monitoring of data access patterns and anomaly detection." },
              ]}
            />
          </TabsContent>

          {/* ── GLBA Tab ── */}
          <TabsContent value="glba" className="space-y-4">
            <ComplianceFrameworkView
              title="Gramm-Leach-Bliley Act (GLBA)"
              description="Requires financial institutions to explain how they share and protect customers' private information."
              controls={glbaControls}
              icon={<Lock size={24} className="text-emerald-500" />}
              features={[
                { icon: <Lock size={16} />, label: "End-to-End Encryption", desc: "AES-256 encryption at rest, TLS 1.3 in transit. Zero-knowledge architecture." },
                { icon: <ShieldCheck size={16} />, label: "Privacy-by-Design", desc: "Masked PII, minimal data exposure, and consent-based sharing model." },
                { icon: <ShieldAlert size={16} />, label: "Pretexting Countermeasures", desc: "Multi-factor authentication and session validation prevent social engineering." },
                { icon: <Users size={16} />, label: "Consumer Opt-Out Rights", desc: "Applicants control sharing via revocable, time-limited tokens." },
              ]}
            />
          </TabsContent>

          {/* ── FCRA Tab ── */}
          <TabsContent value="fcra" className="space-y-4">
            <ComplianceFrameworkView
              title="Fair Credit Reporting Act (FCRA)"
              description="Promotes accuracy, fairness, and privacy of consumer information contained in credit reporting agencies' files."
              controls={fcraControls}
              icon={<FileCheck size={24} className="text-amber-500" />}
              features={[
                { icon: <BadgeCheck size={16} />, label: "8-Layer Verification", desc: "Multi-layered document verification pipeline ensures data accuracy." },
                { icon: <Scale size={16} />, label: "Adverse Action Notices", desc: "System supports disclosure obligations when information affects decisions." },
                { icon: <AlertTriangle size={16} />, label: "Dispute Handling Framework", desc: "Architecture supports dispute workflows with evidence audit trails." },
                { icon: <FileCheck size={16} />, label: "Permissible Purpose Logging", desc: "All data access is logged with purpose justification for FCRA compliance." },
              ]}
            />
          </TabsContent>
        </Tabs>

        {/* Notes Dialog */}
        <Dialog open={!!editingNotes} onOpenChange={() => setEditingNotes(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="font-display flex items-center gap-2">
                <StickyNote size={18} className="text-primary" />
                Borrower Notes
              </DialogTitle>
            </DialogHeader>
            <Textarea
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              placeholder="Add private notes about this borrower (e.g. loan type, underwriting status, follow-up dates)..."
              rows={4}
              className="bg-card/50"
            />
            <Button onClick={() => editingNotes && saveNotes(editingNotes)} className="btn-gradient font-rajdhani font-bold text-primary-foreground">
              Save Notes
            </Button>
          </DialogContent>
        </Dialog>

        <div className="mt-12 text-center">
          <div className="p-4 rounded-xl bg-muted/30 border border-border inline-block">
            <p className="text-xs text-muted-foreground font-mono">
              🏦 Lender Dashboard • SOX · GLBA · FCRA Compliant • Powered by Vaulta
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

/* ── Reusable Compliance Framework View ── */
interface FrameworkFeature {
  icon: React.ReactNode;
  label: string;
  desc: string;
}

const ComplianceFrameworkView = ({
  title, description, controls, icon, features,
}: {
  title: string;
  description: string;
  controls: ComplianceControl[];
  icon: React.ReactNode;
  features: FrameworkFeature[];
}) => {
  const metCount = controls.filter(c => c.status === "met").length;
  const pct = Math.round((metCount / controls.length) * 100);

  return (
    <>
      <Card className="cyber-border bg-card/80 backdrop-blur">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-3">
            {icon}
            <div>
              <CardTitle className="font-display text-lg">{title}</CardTitle>
              <p className="text-xs text-muted-foreground font-rajdhani mt-1">{description}</p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-3">
            <Progress value={pct} className="flex-1 h-2" />
            <span className="text-sm font-mono text-emerald-500 font-bold">{pct}%</span>
          </div>
          <div className="space-y-2">
            {controls.map(ctrl => (
              <div key={ctrl.id} className="flex items-start gap-3 p-3 rounded-lg border border-border bg-muted/10 hover:bg-muted/20 transition-colors">
                <CheckCircle2 size={16} className="text-emerald-500 mt-0.5 shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[11px] text-muted-foreground">{ctrl.id}</span>
                    <span className="font-display text-sm font-semibold text-foreground">{ctrl.name}</span>
                  </div>
                  <p className="text-xs text-muted-foreground font-rajdhani mt-0.5">{ctrl.description}</p>
                </div>
                <Badge className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20 font-mono text-[9px] shrink-0">MET</Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {features.map((f, i) => (
          <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }}>
            <Card className="cyber-border card-hover h-full">
              <CardContent className="p-4 flex items-start gap-3">
                <div className="p-2 rounded-lg bg-primary/10 text-primary shrink-0">{f.icon}</div>
                <div>
                  <p className="font-display text-sm font-bold text-foreground">{f.label}</p>
                  <p className="text-xs text-muted-foreground font-rajdhani mt-1">{f.desc}</p>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>
    </>
  );
};

export default LenderDashboard;
