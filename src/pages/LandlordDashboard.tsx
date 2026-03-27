import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Building2, ArrowLeft, Users, Shield, ShieldCheck, ShieldAlert,
  Clock, Trash2, ExternalLink, RefreshCw, Search, StickyNote, BookmarkPlus,
  CheckCircle2, Lock, Globe, FileCheck, Scale, Landmark, Eye, X, Calendar, Link2, Download
} from "lucide-react";
import { exportComplianceCertificatePdf } from "@/lib/complianceCertificatePdf";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { ApplicantNarratives, ApplicantScoreIndicator } from "@/components/ApplicantNarratives";

const complianceFrameworks = [
  {
    name: "SOC 2", status: "Compliant", icon: <ShieldCheck size={14} />, color: "text-[#1D9E75]",
    desc: "Service Organization Control",
    lastAudit: "2026-02-15",
    detail: "SOC 2 Type II certification validates that Vaulta's security controls operate effectively over time. Covers Trust Service Criteria: Security, Availability, Processing Integrity, Confidentiality, and Privacy.",
    controls: ["Access Controls", "Encryption at Rest & Transit", "Continuous Monitoring", "Incident Response"],
    certLink: "/documentation#soc2",
  },
  {
    name: "GDPR", status: "Compliant", icon: <Globe size={14} />, color: "text-[#1D9E75]",
    desc: "EU Data Protection",
    lastAudit: "2026-01-20",
    detail: "Full compliance with the EU General Data Protection Regulation. Vaulta processes data under lawful basis, enforces data minimization, and supports data subject rights including erasure and portability.",
    controls: ["Right to Erasure", "Data Portability", "Consent Management", "DPO Appointed"],
    certLink: "/privacy",
  },
  {
    name: "FCRA", status: "Compliant", icon: <Scale size={14} />, color: "text-[#1D9E75]",
    desc: "Fair Credit Reporting Act",
    lastAudit: "2026-03-01",
    detail: "Vaulta does not act as a Consumer Reporting Agency. Assessments are informational trust narratives — not credit reports — and do not constitute adverse action triggers under FCRA §604.",
    controls: ["No Adverse Action", "Permissible Purpose Docs", "Dispute Resolution", "Accuracy Standards"],
    certLink: "/documentation#fcra",
  },
  {
    name: "FHA", status: "Aligned", icon: <Landmark size={14} />, color: "text-primary",
    desc: "Fair Housing Act",
    lastAudit: "2026-02-28",
    detail: "Vaulta's assessment engine is designed to avoid discrimination based on race, color, religion, sex, national origin, disability, or familial status. No protected-class data is used in scoring.",
    controls: ["Bias-Free Scoring", "No Protected Class Inputs", "Equal Treatment Protocols", "Audit Trail"],
    certLink: "/documentation#fha",
  },
  {
    name: "ECOA", status: "Aligned", icon: <Scale size={14} />, color: "text-primary",
    desc: "Equal Credit Opportunity",
    lastAudit: "2026-02-28",
    detail: "Alignment with the Equal Credit Opportunity Act ensures Vaulta's trust scoring does not discriminate on prohibited bases. All applicants receive identical evaluation criteria.",
    controls: ["Uniform Criteria", "No Demographic Scoring", "Transparency Requirements", "Record Retention"],
    certLink: "/documentation#ecoa",
  },
  {
    name: "GLBA", status: "Compliant", icon: <Lock size={14} />, color: "text-[#1D9E75]",
    desc: "Gramm-Leach-Bliley Act",
    lastAudit: "2026-01-15",
    detail: "Financial data shared through Vaulta is protected under GLBA Safeguards Rule. AES-256-GCM encryption, zero-knowledge architecture, and strict access controls protect nonpublic personal information.",
    controls: ["Safeguards Rule", "Privacy Notices", "Information Security Program", "Third-Party Oversight"],
    certLink: "/documentation#glba",
  },
  {
    name: "CCPA", status: "Compliant", icon: <Eye size={14} />, color: "text-[#1D9E75]",
    desc: "CA Consumer Privacy Act",
    lastAudit: "2026-01-20",
    detail: "California residents have full rights under CCPA including right to know, right to delete, and right to opt-out. Vaulta does not sell personal information.",
    controls: ["Right to Know", "Right to Delete", "Opt-Out Rights", "No Data Sales"],
    certLink: "/privacy#ccpa",
  },
  {
    name: "NIST 800-53", status: "Verified", icon: <FileCheck size={14} />, color: "text-[#1D9E75]",
    desc: "Federal Security Controls",
    lastAudit: "2026-03-10",
    detail: "Vaulta implements controls from NIST SP 800-53 Rev. 5 across four control families: Access Control (AC), Audit & Accountability (AU), Identification & Authentication (IA), and System & Communications Protection (SC).",
    controls: ["AC — Access Control", "AU — Audit & Accountability", "IA — Identification & Auth", "SC — System & Comms Protection"],
    certLink: "/documentation#nist",
  },
];

interface SavedApplicant {
  id: string;
  landlord_user_id: string;
  applicant_user_id: string;
  shared_token_id: string | null;
  notes: string | null;
  saved_at: string;
  // Joined data
  token?: string;
  tokenLabel?: string;
  tokenActive?: boolean;
}

const LandlordDashboard = () => {
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
    await (supabase.from("landlord_saved_applicants") as any)
      .delete()
      .eq("id", id);
    setSaved(prev => prev.filter(s => s.id !== id));
    toast({ title: "Removed", description: "Applicant removed from your saved list." });
  };

  const saveNotes = async (id: string) => {
    await (supabase.from("landlord_saved_applicants") as any)
      .update({ notes: noteText })
      .eq("id", id);
    setSaved(prev =>
      prev.map(s => s.id === id ? { ...s, notes: noteText } : s)
    );
    setEditingNotes(null);
    toast({ title: "Notes Saved" });
  };

  const filtered = saved.filter(s =>
    !searchQuery ||
    s.tokenLabel?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.notes?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-background grid-bg flex items-center justify-center">
        <div className="text-primary font-mono animate-pulse">Loading dashboard...</div>
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

      <div className="max-w-5xl mx-auto px-6 pb-12">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-xl border border-accent/30 bg-accent/10">
                <Building2 size={32} className="text-accent" />
              </div>
              <div>
                <h1 className="font-display text-2xl font-bold gradient-text">LANDLORD DASHBOARD</h1>
                <p className="text-muted-foreground font-mono text-xs">// APPLICANT VERIFICATION CENTER //</p>
              </div>
            </div>
            <Button onClick={fetchSaved} disabled={refreshing} variant="outline" size="sm" className="font-mono text-xs">
              <RefreshCw size={14} className={refreshing ? "animate-spin mr-2" : "mr-2"} />
              REFRESH
            </Button>
          </div>
        </motion.div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <Card className="cyber-border">
            <CardContent className="p-4 flex items-center gap-4">
              <Users size={24} className="text-primary" />
              <div>
                <p className="text-muted-foreground font-mono text-[10px]">SAVED APPLICANTS</p>
                <p className="font-display text-2xl font-bold text-primary">{saved.length}</p>
              </div>
            </CardContent>
          </Card>
          <Card className="cyber-border">
            <CardContent className="p-4 flex items-center gap-4">
              <ShieldCheck size={24} className="text-[#1D9E75]" />
              <div>
                <p className="text-muted-foreground font-mono text-[10px]">ACTIVE LINKS</p>
                <p className="font-display text-2xl font-bold text-[#1D9E75]">
                  {saved.filter(s => s.tokenActive).length}
                </p>
              </div>
            </CardContent>
          </Card>
          <Card className="cyber-border">
            <CardContent className="p-4 flex items-center gap-4">
              <Clock size={24} className="text-muted-foreground" />
              <div>
                <p className="text-muted-foreground font-mono text-[10px]">EXPIRED LINKS</p>
                <p className="font-display text-2xl font-bold text-muted-foreground">
                  {saved.filter(s => !s.tokenActive).length}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Compliance & Framework Badges */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="mb-8"
        >
          <Card className="cyber-border overflow-hidden">
            <CardContent className="p-0">
              <div className="px-5 py-3 border-b border-border flex items-center gap-2">
                <ShieldCheck size={16} className="text-primary" />
                <span className="font-display text-xs font-bold text-foreground tracking-wide">COMPLIANCE FRAMEWORKS</span>
                <div className="ml-auto flex items-center gap-3">
                  <span className="text-[10px] font-mono text-muted-foreground hidden sm:inline">All assessments comply with:</span>
                  <Button
                    onClick={() => exportComplianceCertificatePdf(user?.email ? `Landlord — ${user.email}` : undefined)}
                    variant="outline"
                    size="sm"
                    className="font-mono text-[10px] gap-1.5 h-6 px-2"
                  >
                    <Download size={10} /> CERTIFICATE
                  </Button>
                </div>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-px bg-border">
                {complianceFrameworks.map((fw) => (
                  <Popover key={fw.name}>
                    <PopoverTrigger asChild>
                      <button className="bg-card p-3 flex items-start gap-2.5 text-left w-full hover:bg-accent/5 transition-colors cursor-pointer group">
                        <div className={`mt-0.5 shrink-0 ${fw.color}`}>{fw.icon}</div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="font-display text-xs font-bold text-foreground group-hover:text-primary transition-colors">{fw.name}</span>
                            <CheckCircle2 size={10} className={fw.color} />
                          </div>
                          <p className="text-[10px] font-mono text-muted-foreground leading-tight mt-0.5">{fw.desc}</p>
                          <Badge
                            className={`mt-1 text-[9px] px-1.5 py-0 font-mono border ${
                              fw.status === "Compliant"
                                ? "bg-[#1D9E75]/10 text-[#1D9E75] border-[#1D9E75]/20"
                                : fw.status === "Verified"
                                ? "bg-[#1D9E75]/10 text-[#1D9E75] border-[#1D9E75]/20"
                                : "bg-primary/10 text-primary border-primary/20"
                            }`}
                          >
                            {fw.status}
                          </Badge>
                        </div>
                      </button>
                    </PopoverTrigger>
                    <PopoverContent className="w-80 p-0 bg-card border-border" side="bottom" align="start">
                      <div className="p-4 space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className={fw.color}>{fw.icon}</div>
                            <span className="font-display text-sm font-bold text-foreground">{fw.name}</span>
                            <Badge
                              className={`text-[9px] px-1.5 py-0 font-mono border ${
                                fw.status === "Aligned"
                                  ? "bg-primary/10 text-primary border-primary/20"
                                  : "bg-[#1D9E75]/10 text-[#1D9E75] border-[#1D9E75]/20"
                              }`}
                            >
                              {fw.status}
                            </Badge>
                          </div>
                        </div>

                        <p className="text-xs text-muted-foreground leading-relaxed">{fw.detail}</p>

                        <div className="flex items-center gap-2 text-[10px] font-mono text-muted-foreground">
                          <Calendar size={10} />
                          <span>Last Audit: {new Date(fw.lastAudit).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}</span>
                        </div>

                        <div className="space-y-1.5">
                          <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">Key Controls</span>
                          <div className="flex flex-wrap gap-1">
                            {fw.controls.map((ctrl) => (
                              <span key={ctrl} className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-accent/10 text-accent border border-accent/20">
                                {ctrl}
                              </span>
                            ))}
                          </div>
                        </div>

                        <Link
                          to={fw.certLink}
                          className="flex items-center gap-1.5 text-[10px] font-mono text-primary hover:text-primary/80 transition-colors"
                        >
                          <Link2 size={10} />
                          View Certification Details
                        </Link>
                      </div>
                    </PopoverContent>
                  </Popover>
                ))}
              </div>
              <div className="px-5 py-2.5 border-t border-border flex items-center gap-2">
                <Lock size={12} className="text-muted-foreground" />
                <span className="text-[10px] font-mono text-muted-foreground">
                  E2E Encrypted · Zero-Knowledge Architecture · AES-256-GCM · ISO 27001 Aligned
                </span>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Search */}
        <div className="relative mb-6">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search applicants by label or notes..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 bg-card/50"
          />
        </div>

        {/* Applicant List */}
        {filtered.length === 0 ? (
          <Card className="cyber-border">
            <CardContent className="py-16 text-center">
              <BookmarkPlus size={48} className="text-muted-foreground mx-auto mb-4" />
              <h3 className="font-display text-lg font-bold text-foreground mb-2">No Saved Applicants</h3>
              <p className="text-muted-foreground font-rajdhani max-w-md mx-auto">
                When applicants share their verified profile with you, click "Save Applicant" to add them here for easy access and notes.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {filtered.map((item, i) => (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
              >
                <Card className="cyber-border card-hover">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <Shield size={16} className="text-primary shrink-0" />
                          <span className="font-display font-bold text-sm truncate">
                            {item.tokenLabel || "Shared Profile"}
                          </span>
                          <ApplicantScoreIndicator applicantUserId={item.applicant_user_id} />
                          {item.tokenActive ? (
                            <Badge className="bg-[#1D9E75]/15 text-[#1D9E75] border-[#1D9E75]/30 font-mono text-[10px] shrink-0">
                              ACTIVE
                            </Badge>
                          ) : (
                            <Badge variant="secondary" className="font-mono text-[10px] shrink-0">
                              EXPIRED
                            </Badge>
                          )}
                        </div>
                        <p className="text-[11px] text-muted-foreground font-mono">
                          Saved {new Date(item.saved_at).toLocaleDateString()}
                        </p>
                        {item.notes && (
                          <p className="text-xs text-muted-foreground font-rajdhani mt-2 p-2 rounded bg-muted/30 border border-border">
                            📝 {item.notes}
                          </p>
                        )}
                        <ApplicantNarratives applicantUserId={item.applicant_user_id} applicantLabel={item.tokenLabel || "Shared Profile"} compact />
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        {item.token && item.tokenActive && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="font-mono text-xs gap-1"
                            onClick={() => navigate(`/shared/${item.token}`)}
                          >
                            <ExternalLink size={12} />
                            VIEW
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => {
                            setEditingNotes(item.id);
                            setNoteText(item.notes || "");
                          }}
                        >
                          <StickyNote size={14} />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive"
                          onClick={() => removeSaved(item.id)}
                        >
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

        {/* Notes Dialog */}
        <Dialog open={!!editingNotes} onOpenChange={() => setEditingNotes(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="font-display flex items-center gap-2">
                <StickyNote size={18} className="text-primary" />
                Applicant Notes
              </DialogTitle>
            </DialogHeader>
            <Textarea
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              placeholder="Add private notes about this applicant (e.g. property, application status, follow-up dates)..."
              rows={4}
              className="bg-card/50"
            />
            <Button
              onClick={() => editingNotes && saveNotes(editingNotes)}
              className="btn-gradient font-rajdhani font-bold text-primary-foreground"
            >
              Save Notes
            </Button>
          </DialogContent>
        </Dialog>

        {/* CTA for non-landlords */}
        <div className="mt-12 text-center">
          <div className="p-4 rounded-xl bg-muted/30 border border-border inline-block">
            <p className="text-xs text-muted-foreground font-mono">
              🏠 Landlord Dashboard • Powered by Vaulta's verification pipeline
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LandlordDashboard;
