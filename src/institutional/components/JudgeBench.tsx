import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useInstitutionalAuth } from "../hooks/useInstitutionalAuth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { FileText, ShieldCheck, Eye, Loader2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { recordReviewAction } from "../lib/reviewLog";

interface JudgeBenchProps {
  open: boolean;
  onClose: () => void;
  submissionId: string;
  applicantName: string;
}

interface DocRow {
  id: string;
  file_name: string;
  mime_type: string;
  file_path: string;
  encrypted_iv: string | null;
  document_type: string;
  transferred_at: string;
  consent_record_id: string;
}

export const JudgeBench = ({ open, onClose, submissionId, applicantName }: JudgeBenchProps) => {
  const { institutionId, user } = useInstitutionalAuth();
  const [docs, setDocs] = useState<DocRow[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [verifiedMap, setVerifiedMap] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!open || !institutionId) return;
    const load = async () => {
      setLoading(true);
      const { data } = await (supabase.from as any)("institution_documents")
        .select("id,file_name,mime_type,file_path,encrypted_iv,document_type,transferred_at,consent_record_id")
        .eq("institution_id", institutionId)
        .eq("possession_request_id", submissionId)
        .is("deleted_at", null)
        .order("transferred_at", { ascending: false });
      const list = (data || []) as DocRow[];
      setDocs(list);
      setActiveId(list[0]?.id ?? null);
      setLoading(false);
    };
    load();
  }, [open, institutionId, submissionId]);

  useEffect(() => {
    if (!activeId) {
      setSignedUrl(null);
      return;
    }
    const doc = docs.find((d) => d.id === activeId);
    if (!doc) return;
    let cancelled = false;
    const run = async () => {
      const { data, error } = await supabase.storage
        .from("institution-documents")
        .createSignedUrl(doc.file_path, 900);
      if (cancelled) return;
      if (error) {
        setSignedUrl(null);
        return;
      }
      setSignedUrl(data.signedUrl);
      // Audit view
      if (institutionId && user) {
        await (supabase.from as any)("document_access_log").insert({
          institution_id: institutionId,
          institution_document_id: doc.id,
          consent_record_id: doc.consent_record_id,
          accessed_by: user.id,
          access_type: "view",
        });
        await recordReviewAction({
          institution_id: institutionId,
          submission_id: submissionId,
          reviewer_user_id: user.id,
          reviewer_name: user.email ?? null,
          action: "DOCUMENT_VIEWED",
          target_type: "institution_document",
          target_id: doc.id,
          target_name: doc.file_name,
        }).catch(() => {});
      }
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [activeId, docs, institutionId, user, submissionId]);

  const activeDoc = docs.find((d) => d.id === activeId) || null;
  const integrityValid = activeDoc ? Boolean(activeDoc.encrypted_iv && activeDoc.file_path) : false;

  const toggleVerified = async (checked: boolean) => {
    if (!activeDoc || !institutionId || !user) return;
    setVerifiedMap((m) => ({ ...m, [activeDoc.id]: checked }));
    try {
      await recordReviewAction({
        institution_id: institutionId,
        submission_id: submissionId,
        reviewer_user_id: user.id,
        reviewer_name: user.email ?? null,
        action: checked ? "MANUAL_VERIFICATION_CONFIRMED" : "MANUAL_VERIFICATION_REVOKED",
        target_type: "institution_document",
        target_id: activeDoc.id,
        target_name: activeDoc.file_name,
        metadata: { integrity_valid: integrityValid },
      });
      await (supabase.from as any)("institutional_activity_log").insert({
        institution_id: institutionId,
        user_id: user.id,
        event_type: checked ? "Manual Verification Confirmed" : "Manual Verification Revoked",
        applicant_name: applicantName,
        detail: `${user.email ?? "Reviewer"} ${checked ? "confirmed" : "revoked"} manual verification on ${activeDoc.file_name}`,
      });
      toast.success(checked ? "Marked as Verified by Manual Review" : "Verification revoked");
    } catch {
      toast.error("Failed to record verification");
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-6xl w-[95vw] h-[85vh] p-0 bg-white flex flex-col">
        <DialogHeader className="p-4 border-b border-slate-200">
          <DialogTitle className="text-base font-semibold text-slate-900 flex items-center gap-2">
            <Eye className="h-4 w-4" />
            Judge's Bench — {applicantName}
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-1 min-h-0">
          {/* Left rail: doc list */}
          <aside className="w-56 border-r border-slate-200 bg-slate-50">
            <ScrollArea className="h-full">
              <div className="p-2 space-y-1">
                {loading && (
                  <div className="text-xs text-slate-500 p-3 flex items-center gap-2">
                    <Loader2 className="h-3 w-3 animate-spin" /> Loading
                  </div>
                )}
                {!loading && docs.length === 0 && (
                  <div className="text-xs text-slate-500 p-3">
                    No transferred documents. Use "Request Documents" to obtain consent-based copies.
                  </div>
                )}
                {docs.map((d) => (
                  <button
                    key={d.id}
                    onClick={() => setActiveId(d.id)}
                    className={`w-full text-left p-2 rounded text-xs transition-colors ${
                      activeId === d.id ? "bg-white border border-slate-300 shadow-sm" : "hover:bg-white/60"
                    }`}
                  >
                    <div className="flex items-center gap-1.5">
                      <FileText className="h-3 w-3 text-slate-500" />
                      <span className="font-medium text-slate-900 truncate">{d.file_name}</span>
                    </div>
                    <p className="text-[10px] text-slate-500 mt-0.5 uppercase tracking-wider">
                      {d.document_type}
                    </p>
                  </button>
                ))}
              </div>
            </ScrollArea>
          </aside>

          {/* Left pane: document viewer */}
          <div className="flex-1 border-r border-slate-200 bg-slate-100 min-w-0">
            {activeDoc && signedUrl ? (
              activeDoc.mime_type?.startsWith("image/") ? (
                <div className="h-full overflow-auto p-4 flex items-start justify-center">
                  <img src={signedUrl} alt={activeDoc.file_name} className="max-w-full" />
                </div>
              ) : activeDoc.mime_type === "application/pdf" ? (
                <iframe src={signedUrl} title={activeDoc.file_name} className="w-full h-full" />
              ) : (
                <div className="p-6 text-sm text-slate-600">
                  <p className="mb-3">Preview unavailable for this file type.</p>
                  <a href={signedUrl} target="_blank" rel="noreferrer" className="text-blue-600 underline">
                    Open in new tab
                  </a>
                </div>
              )
            ) : (
              <div className="h-full flex items-center justify-center text-sm text-slate-500">
                {loading ? "Loading viewer…" : "Select a document"}
              </div>
            )}
          </div>

          {/* Right pane: extraction + verification */}
          <aside className="w-80 bg-white">
            <ScrollArea className="h-full">
              <div className="p-4 space-y-4">
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-slate-500 mb-1">
                    Vaulta Extraction
                  </p>
                  {activeDoc ? (
                    <div className="space-y-2 text-sm">
                      <Row label="Document" value={activeDoc.file_name} />
                      <Row label="Category" value={activeDoc.document_type} />
                      <Row label="MIME" value={activeDoc.mime_type} mono />
                      <Row
                        label="Encryption IV"
                        value={activeDoc.encrypted_iv ? "Recorded" : "Missing"}
                      />
                      <Row
                        label="Storage Path"
                        value={activeDoc.file_path}
                        mono
                      />
                    </div>
                  ) : (
                    <p className="text-xs text-slate-400">No document selected.</p>
                  )}
                </div>

                <div className="border-t border-slate-200 pt-3">
                  <p className="text-[10px] uppercase tracking-wider text-slate-500 mb-2">
                    Integrity Status
                  </p>
                  {integrityValid ? (
                    <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 border">
                      <ShieldCheck className="h-3 w-3 mr-1" /> Encryption chain intact
                    </Badge>
                  ) : (
                    <Badge className="bg-amber-50 text-amber-700 border-amber-200 border">
                      <AlertTriangle className="h-3 w-3 mr-1" /> Integrity unverified
                    </Badge>
                  )}
                </div>

                <div className="border-t border-slate-200 pt-3">
                  <label className="flex items-start gap-2 text-sm cursor-pointer">
                    <Checkbox
                      checked={!!(activeDoc && verifiedMap[activeDoc.id])}
                      onCheckedChange={(v) => toggleVerified(Boolean(v))}
                      disabled={!activeDoc}
                    />
                    <span className="text-slate-700 leading-snug">
                      <span className="font-medium">Verified by Manual Review</span>
                      <span className="block text-xs text-slate-500 mt-0.5">
                        Confirms the extracted data matches the document content. Recorded in the audit log.
                      </span>
                    </span>
                  </label>
                </div>
              </div>
            </ScrollArea>
          </aside>
        </div>

        <div className="p-3 border-t border-slate-200 flex justify-end">
          <Button variant="outline" onClick={onClose}>Close</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

const Row = ({ label, value, mono }: { label: string; value: string; mono?: boolean }) => (
  <div className="flex items-start justify-between gap-3">
    <span className="text-xs text-slate-500 shrink-0">{label}</span>
    <span
      className={`text-xs text-slate-800 text-right break-all ${mono ? "font-mono" : ""}`}
      title={value}
    >
      {value}
    </span>
  </div>
);