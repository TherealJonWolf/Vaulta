import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Shield, ShieldCheck, ShieldAlert, ShieldX, AlertTriangle,
  CheckCircle2, XCircle, FileText, Clock, User, Fingerprint,
  TrendingUp, Star, BookmarkPlus, ArrowLeft, Lock, Building2
} from "lucide-react";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { VaultaLogo } from "@/components/VaultaLogo";
import DocumentVerificationAudit, { DEFAULT_CHECK_EXPLANATIONS, type DocumentAuditData, type VerificationCheck } from "@/components/DocumentVerificationAudit";

interface SharedProfileData {
  tokenId: string;
  applicant: {
    name: string;
    email: string | null;
    memberSince: string;
    mfaEnabled: boolean;
  };
  trustScore: {
    trust_score: number;
    trust_level: string;
    confidence: string;
    explanation: string;
    positive_factors: string[];
    negative_factors: string[];
    recommendations: string[];
    calculated_at: string;
  } | null;
  documents: Array<{
    id: string;
    fileName: string;
    category: string;
    isVerified: boolean;
    verificationResult: any;
    submittedAt: string;
    mimeType: string;
    fileSize: number;
  }>;
  identityVerification: {
    status: string;
    decision: string | null;
    created_at: string;
  } | null;
  accountFlags: Array<{
    flag_type: string;
    reason: string;
    created_at: string;
  }>;
}

const CATEGORY_LABELS: Record<string, string> = {
  identity: "Identity Document",
  financial: "Financial Document",
  general: "General Document",
};

const SharedProfile = () => {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const [data, setData] = useState<SharedProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedDoc, setSelectedDoc] = useState<SharedProfileData["documents"][0] | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (token) fetchProfile();
  }, [token]);

  const fetchProfile = async () => {
    setLoading(true);
    try {
      const { data: result, error: fnError } = await supabase.functions.invoke(
        "resolve-shared-profile",
        { body: { token } }
      );
      if (fnError) throw fnError;
      if (result?.error) {
        setError(result.error);
      } else {
        setData(result);
      }
    } catch (err: any) {
      setError(err.message || "Failed to load profile");
    } finally {
      setLoading(false);
    }
  };

  const saveApplicant = async () => {
    if (!user || !data) return;
    setSaving(true);
    try {
      const { error } = await (supabase.from("landlord_saved_applicants") as any).insert({
        landlord_user_id: user.id,
        applicant_user_id: data.applicant.email, // We use tokenId for reference
        shared_token_id: data.tokenId,
      });
      if (error && error.code === "23505") {
        toast({ title: "Already Saved", description: "This applicant is already in your saved list." });
      } else if (error) {
        throw error;
      } else {
        toast({ title: "Applicant Saved", description: "Added to your landlord dashboard." });
      }
    } catch (err: any) {
      toast({ variant: "destructive", title: "Error", description: err.message });
    } finally {
      setSaving(false);
    }
  };

  const trustColor = (level: string) => {
    switch (level?.toLowerCase().replace(/\s+/g, "_")) {
      case "highly_trusted": return "text-[#1D9E75]";
      case "trusted": return "text-[#1D9E75]";
      case "neutral": return "text-[hsl(var(--warning-amber))]";
      case "low_trust": return "text-[#E24B4A]";
      case "restricted": return "text-[#E24B4A]";
      default: return "text-muted-foreground";
    }
  };

  const trustBgColor = (level: string) => {
    switch (level?.toLowerCase().replace(/\s+/g, "_")) {
      case "highly_trusted": return "bg-[#1D9E75]/10 border-[#1D9E75]/30";
      case "trusted": return "bg-[#1D9E75]/10 border-[#1D9E75]/30";
      case "neutral": return "bg-yellow-500/10 border-yellow-500/30";
      case "low_trust": return "bg-[#E24B4A]/10 border-[#E24B4A]/30";
      case "restricted": return "bg-[#E24B4A]/10 border-[#E24B4A]/30";
      default: return "bg-muted/10 border-border";
    }
  };

  const TrustIcon = ({ level }: { level: string }) => {
    switch (level?.toLowerCase().replace(/\s+/g, "_")) {
      case "highly_trusted": return <ShieldCheck size={28} className="text-[#1D9E75]" />;
      case "trusted": return <Shield size={28} className="text-[#1D9E75]" />;
      case "neutral": return <Shield size={28} className="text-yellow-500" />;
      case "low_trust": return <ShieldAlert size={28} className="text-[#E24B4A]" />;
      case "restricted": return <ShieldX size={28} className="text-[#E24B4A]" />;
      default: return <Shield size={28} className="text-muted-foreground" />;
    }
  };

  const buildDocAudit = (doc: SharedProfileData["documents"][0]): DocumentAuditData => {
    const vr = doc.verificationResult || {};
    const checkNames = [
      "Magic-Byte Signature Check", "Malicious Content Scan", "SHA-256 Fingerprint",
      "EXIF & Metadata Analysis", "Document Structure Validation",
      "Cross-User Duplicate Detection", "AI Authenticity Analysis", "Data Consistency Check",
    ];
    const checks: VerificationCheck[] = checkNames.map((name) => {
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
      documentType: CATEGORY_LABELS[doc.category] || doc.category,
      fileName: doc.fileName,
      submittedBy: data?.applicant.name || "Applicant",
      submissionDate: new Date(doc.submittedAt).toLocaleDateString(),
      overallVerified: doc.isVerified,
      checks,
    };
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background grid-bg flex items-center justify-center">
        <div className="text-center">
          <Shield className="mx-auto text-primary animate-pulse" size={48} />
          <p className="mt-4 text-muted-foreground font-mono">Loading verified profile...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background grid-bg flex items-center justify-center p-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center max-w-md"
        >
          <ShieldX size={64} className="text-destructive mx-auto mb-4" />
          <h1 className="font-display text-2xl font-bold text-foreground mb-2">
            Profile Unavailable
          </h1>
          <p className="text-muted-foreground font-rajdhani mb-6">{error}</p>
          <Button onClick={() => navigate("/")} variant="outline">
            <ArrowLeft size={16} className="mr-2" />
            Back to Vaulta
          </Button>
        </motion.div>
      </div>
    );
  }

  if (!data) return null;

  const ts = data.trustScore;
  const hasFlags = data.accountFlags.length > 0;

  return (
    <div className="min-h-screen bg-background grid-bg">
      {/* Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur sticky top-0 z-40">
        <div className="container mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => navigate("/")}>
            <VaultaLogo />
            <span className="font-display text-lg font-bold gradient-text">VAULTA</span>
          </div>
          <div className="flex items-center gap-3">
            {user && (
              <Button onClick={saveApplicant} disabled={saving} variant="outline" size="sm" className="font-mono text-xs">
                <BookmarkPlus size={14} className="mr-2" />
                {saving ? "Saving..." : "Save Applicant"}
              </Button>
            )}
            <Badge variant="secondary" className="font-mono text-[10px]">
              <Lock size={10} className="mr-1" />
              VERIFIED PROFILE
            </Badge>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-6 py-8 max-w-4xl">
        {/* Applicant Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <div className="flex items-start gap-4 mb-4">
            <div className="w-16 h-16 rounded-xl bg-primary/10 border border-primary/30 flex items-center justify-center">
              <User size={32} className="text-primary" />
            </div>
            <div>
              <h1 className="font-display text-2xl font-bold text-foreground">
                {data.applicant.name}
              </h1>
              {data.applicant.email && (
                <p className="text-muted-foreground font-mono text-sm">{data.applicant.email}</p>
              )}
              <div className="flex items-center gap-4 mt-1 text-xs text-muted-foreground font-mono">
                <span className="flex items-center gap-1">
                  <Clock size={10} />
                  Member since {new Date(data.applicant.memberSince).toLocaleDateString()}
                </span>
                {data.applicant.mfaEnabled && (
                  <span className="flex items-center gap-1 text-[#1D9E75]">
                    <Fingerprint size={10} />
                    MFA Enabled
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Account Flags Warning */}
          {hasFlags && (
            <div className="p-4 rounded-xl border border-destructive/30 bg-destructive/5 mb-4">
              <div className="flex items-center gap-2 text-destructive font-display font-bold text-sm mb-1">
                <AlertTriangle size={16} />
                ACCOUNT FLAGS DETECTED
              </div>
              {data.accountFlags.map((flag, i) => (
                <p key={i} className="text-xs text-destructive/80 font-mono mt-1">
                  {flag.flag_type.toUpperCase()} — {flag.reason}
                </p>
              ))}
            </div>
          )}
        </motion.div>

        {/* Trust Score Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="mb-8"
        >
          <Card className={`cyber-border ${ts ? trustBgColor(ts.trust_level) : ""}`}>
            <CardContent className="p-6">
              {ts ? (
                <div className="flex flex-col md:flex-row items-center gap-6">
                  <div className="text-center">
                    <TrustIcon level={ts.trust_level} />
                    <div className={`font-display text-5xl font-bold mt-2 ${trustColor(ts.trust_level)}`}>
                      {ts.trust_score}
                    </div>
                    <p className="text-xs font-mono text-muted-foreground mt-1">out of 100</p>
                  </div>
                  <Separator orientation="vertical" className="hidden md:block h-24" />
                  <div className="flex-1 space-y-3">
                    <div className="flex items-center gap-2">
                      <Badge className={`font-mono text-xs ${trustBgColor(ts.trust_level)} ${trustColor(ts.trust_level)} border`}>
                        {ts.trust_level.replace(/_/g, " ").toUpperCase()}
                      </Badge>
                      <Badge variant="outline" className="font-mono text-[10px]">
                        {ts.confidence} Confidence
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground font-rajdhani">{ts.explanation}</p>
                    <Progress value={ts.trust_score} className="h-2" />
                    <p className="text-[10px] text-muted-foreground font-mono">
                      Last calculated: {new Date(ts.calculated_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8">
                  <Shield size={40} className="text-muted-foreground mx-auto mb-3" />
                  <p className="text-muted-foreground font-mono text-sm">
                    Trust score has not been calculated yet.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Trust Factors */}
        {ts && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="grid md:grid-cols-2 gap-4 mb-8"
          >
            <Card className="cyber-border">
              <CardHeader className="pb-3">
                <CardTitle className="font-display text-sm flex items-center gap-2 text-[#1D9E75]">
                  <CheckCircle2 size={16} />
                  Positive Factors
                </CardTitle>
              </CardHeader>
              <CardContent>
                {(ts.positive_factors as string[] || []).length > 0 ? (
                  <ul className="space-y-1.5">
                    {(ts.positive_factors as string[]).map((f, i) => (
                      <li key={i} className="text-xs text-muted-foreground font-rajdhani flex items-start gap-2">
                        <CheckCircle2 size={12} className="text-[#1D9E75] shrink-0 mt-0.5" />
                        {f}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-xs text-muted-foreground font-mono">No positive factors recorded.</p>
                )}
              </CardContent>
            </Card>

            <Card className="cyber-border">
              <CardHeader className="pb-3">
                <CardTitle className="font-display text-sm flex items-center gap-2 text-[#E24B4A]">
                  <XCircle size={16} />
                  Risk Factors
                </CardTitle>
              </CardHeader>
              <CardContent>
                {(ts.negative_factors as string[] || []).length > 0 ? (
                  <ul className="space-y-1.5">
                    {(ts.negative_factors as string[]).map((f, i) => (
                      <li key={i} className="text-xs text-muted-foreground font-rajdhani flex items-start gap-2">
                        <XCircle size={12} className="text-[#E24B4A] shrink-0 mt-0.5" />
                        {f}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-xs text-muted-foreground font-mono">No risk factors detected.</p>
                )}
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Identity Verification */}
        {data.identityVerification && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="mb-8"
          >
            <Card className="cyber-border">
              <CardContent className="p-4 flex items-center gap-4">
                <Fingerprint size={24} className={
                  data.identityVerification.decision === "approved" ? "text-[#1D9E75]" : "text-muted-foreground"
                } />
                <div>
                  <p className="font-display font-bold text-sm">Government ID Verification</p>
                  <p className="text-xs text-muted-foreground font-mono">
                    Status: {" "}
                    <span className={
                      data.identityVerification.decision === "approved"
                        ? "text-[#1D9E75]"
                        : "text-[#E24B4A]"
                    }>
                      {data.identityVerification.decision?.toUpperCase() || data.identityVerification.status.toUpperCase()}
                    </span>
                  </p>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Documents & Audit Reports */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
        >
          <h2 className="font-display text-lg font-bold gradient-text mb-4 flex items-center gap-2">
            <FileText size={20} />
            Document Verification Reports
          </h2>

          {selectedDoc ? (
            <div className="space-y-4">
              <Button
                variant="ghost"
                size="sm"
                className="font-mono text-xs gap-1"
                onClick={() => setSelectedDoc(null)}
              >
                <ArrowLeft size={14} /> Back to Documents
              </Button>
              <DocumentVerificationAudit audit={buildDocAudit(selectedDoc)} />
            </div>
          ) : data.documents.length === 0 ? (
            <Card className="cyber-border">
              <CardContent className="py-12 text-center">
                <FileText size={40} className="text-muted-foreground mx-auto mb-3" />
                <p className="text-muted-foreground font-mono text-sm">
                  No documents have been submitted yet.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-3">
              {data.documents.map((doc, i) => (
                <motion.div
                  key={doc.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.3 + i * 0.05 }}
                >
                  <Card
                    className="cyber-border cursor-pointer card-hover"
                    onClick={() => setSelectedDoc(doc)}
                  >
                    <CardContent className="p-4 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                          doc.isVerified
                            ? "bg-[#1D9E75]/10 border border-[#1D9E75]/30"
                            : "bg-[#E24B4A]/10 border border-[#E24B4A]/30"
                        }`}>
                          {doc.isVerified
                            ? <ShieldCheck size={18} className="text-[#1D9E75]" />
                            : <ShieldAlert size={18} className="text-[#E24B4A]" />}
                        </div>
                        <div>
                          <p className="font-display font-bold text-sm">{doc.fileName}</p>
                          <div className="flex items-center gap-2 text-[11px] text-muted-foreground font-mono">
                            <Badge variant="outline" className="text-[10px] uppercase">
                              {doc.category}
                            </Badge>
                            <span>{new Date(doc.submittedAt).toLocaleDateString()}</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge className={`font-mono text-[10px] ${
                          doc.isVerified
                            ? "bg-[#1D9E75]/15 text-[#1D9E75] border-[#1D9E75]/30"
                            : "bg-[#E24B4A]/15 text-[#E24B4A] border-[#E24B4A]/30"
                        }`}>
                          {doc.isVerified ? "VERIFIED" : "FLAGGED"}
                        </Badge>
                        <span className="text-xs text-muted-foreground font-mono">
                          View Audit →
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>
          )}
        </motion.div>

        {/* Footer */}
        <div className="mt-12 text-center">
          <div className="p-4 rounded-xl bg-muted/30 border border-border inline-block">
            <p className="text-xs text-muted-foreground font-mono flex items-center gap-2">
              <Lock size={12} className="text-primary" />
              Powered by Vaulta's 8-layer verification pipeline • E2E encrypted • Zero-knowledge architecture
            </p>
          </div>
          {!user && (
            <div className="mt-6">
              <p className="text-sm text-muted-foreground font-rajdhani mb-3">
                Are you a landlord or property manager?
              </p>
              <Button onClick={() => navigate("/auth?mode=signup&role=landlord")} className="btn-gradient font-rajdhani font-bold text-primary-foreground">
                <Building2 size={16} className="mr-2" />
                Create Free Landlord Account
              </Button>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default SharedProfile;
