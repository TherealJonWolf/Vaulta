import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Loader2, FileText, ShieldCheck, AlertCircle } from "lucide-react";
import { format } from "date-fns";

interface PossessionRequest {
  id: string;
  institution_id: string;
  applicant_name: string;
  document_types: string[];
  legal_basis: string;
  retention_period: string;
  retention_expires_at: string | null;
  status: string;
  created_at: string;
  reference_id: string | null;
  request_expires_at?: string | null;
}

interface Props {
  open: boolean;
  onClose: () => void;
  userId?: string;
}

const DocumentPossessionReview = ({ open, onClose, userId }: Props) => {
  const [loading, setLoading] = useState(true);
  const [requests, setRequests] = useState<PossessionRequest[]>([]);
  const [selectedRequest, setSelectedRequest] = useState<PossessionRequest | null>(null);
  const [consentChecked, setConsentChecked] = useState(false);
  const [declineReason, setDeclineReason] = useState("");
  const [showDecline, setShowDecline] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [userDocuments, setUserDocuments] = useState<any[]>([]);
  const [selectedDocIds, setSelectedDocIds] = useState<Set<string>>(new Set());

  const fetchRequests = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    const { data } = await (supabase.from as any)("document_possession_requests")
      .select("*")
      .eq("applicant_user_id", userId)
      .in("status", ["pending", "approved", "declined"])
      .order("created_at", { ascending: false });
    setRequests((data || []) as PossessionRequest[]);
    setLoading(false);
  }, [userId]);

  const fetchDocuments = useCallback(async () => {
    if (!userId) return;
    const { data } = await supabase.from("documents").select("*").eq("user_id", userId);
    setUserDocuments(data || []);
  }, [userId]);

  useEffect(() => {
    if (open && userId) {
      fetchRequests();
      fetchDocuments();
      setSelectedDocIds(new Set());
    }
  }, [open, userId, fetchRequests, fetchDocuments]);

  const getInstitutionName = async (institutionId: string): Promise<string> => {
    const { data } = await (supabase.from as any)("institution_settings")
      .select("display_name")
      .eq("institution_id", institutionId)
      .maybeSingle();
    return data?.display_name || "the requesting institution";
  };

  const handleApprove = async () => {
    if (!selectedRequest || !userId || !consentChecked) return;
    if (selectedDocIds.size === 0) {
      toast.error("Select at least one document to share.");
      return;
    }
    setProcessing(true);

    try {
      const institutionName = await getInstitutionName(selectedRequest.institution_id);

      // Build consent text
      const consentText = `I understand that ${institutionName} will retain copies of these documents for ${selectedRequest.retention_period} as required by ${selectedRequest.legal_basis}.`;
      
      // Hash the consent text for immutable record
      const encoder = new TextEncoder();
      const hashBuffer = await crypto.subtle.digest("SHA-256", encoder.encode(consentText));
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const consentHash = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");

      // User-selected documents only — no auto-matching.
      const matchedDocs = userDocuments.filter((doc) => selectedDocIds.has(doc.id));

      const docIds = matchedDocs.map((d: any) => d.id);
      const docNames = matchedDocs.map((d: any) => d.file_name);

      // Create consent record
      const { data: consentData, error: consentError } = await (supabase.from as any)("consent_records").insert({
        user_id: userId,
        institution_id: selectedRequest.institution_id,
        possession_request_id: selectedRequest.id,
        document_ids: docIds,
        document_names: docNames.length > 0 ? docNames : selectedRequest.document_types,
        legal_basis: selectedRequest.legal_basis,
        retention_period: selectedRequest.retention_period,
        consent_text_hash: consentHash,
      }).select("id").single();

      if (consentError) throw consentError;

      // Copy documents to institution storage
      for (const doc of matchedDocs) {
        const destPath = `${selectedRequest.institution_id}/${selectedRequest.id}/${doc.file_name}`;

        // Download from user's vault
        const { data: fileData, error: dlError } = await supabase.storage
          .from("documents")
          .download(doc.file_path);

        if (dlError || !fileData) {
          console.error("Download error for", doc.file_name, dlError);
          continue;
        }

        // Upload to institution bucket
        const { error: upError } = await supabase.storage
          .from("institution-documents")
          .upload(destPath, fileData, { contentType: "application/octet-stream" });

        if (upError) {
          console.error("Upload to institution error:", upError);
          continue;
        }

        // Create institution document record
        await (supabase.from as any)("institution_documents").insert({
          institution_id: selectedRequest.institution_id,
          consent_record_id: consentData.id,
          possession_request_id: selectedRequest.id,
          original_document_id: doc.id,
          document_type: doc.document_category || "general",
          file_name: doc.file_name,
          file_path: destPath,
          file_size: doc.file_size,
          mime_type: doc.mime_type,
          encrypted_iv: doc.encrypted_iv,
          applicant_name: selectedRequest.applicant_name,
          applicant_user_id: userId,
          retention_expires_at: selectedRequest.retention_expires_at,
          share_status: "shared",
          uploaded_via: "vault",
        });

        await (supabase.from as any)("institutional_activity_log").insert({
          institution_id: selectedRequest.institution_id,
          user_id: userId,
          event_type: "Document Shared",
          applicant_name: selectedRequest.applicant_name,
          detail: `Applicant shared ${doc.file_name}`,
        });
      }

      // Update request status
      await (supabase.from as any)("document_possession_requests")
        .update({ status: "approved", responded_at: new Date().toISOString() })
        .eq("id", selectedRequest.id);

      toast.success(`Transfer complete. ${matchedDocs.length} document(s) sent.`);
      setSelectedRequest(null);
      setConsentChecked(false);
      setSelectedDocIds(new Set());
      fetchRequests();
    } catch (err: any) {
      console.error("Approve error:", err);
      toast.error(err.message || "Transfer failed");
    } finally {
      setProcessing(false);
    }
  };

  const handleDecline = async () => {
    if (!selectedRequest) return;
    setProcessing(true);
    try {
      await (supabase.from as any)("document_possession_requests")
        .update({
          status: "declined",
          responded_at: new Date().toISOString(),
          declined_reason: declineReason.trim() || null,
        })
        .eq("id", selectedRequest.id);

      toast.success("Request declined");
      setSelectedRequest(null);
      setShowDecline(false);
      setDeclineReason("");
      fetchRequests();
    } catch (err: any) {
      toast.error("Failed to decline");
    } finally {
      setProcessing(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-[500px] sm:w-[560px] overflow-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5" /> Document Requests
          </SheetTitle>
        </SheetHeader>

        {loading ? (
          <div className="flex items-center justify-center h-48">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : selectedRequest ? (() => {
          const reqExpired = selectedRequest.request_expires_at &&
            new Date(selectedRequest.request_expires_at) < new Date();
          const isPending = selectedRequest.status === "pending" && !reqExpired;
          return (
          <div className="space-y-5 mt-4">
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm text-amber-900">
              <p className="font-medium mb-2">Document Possession Request</p>
              <p>An institution has requested access to the following documents for <strong>{selectedRequest.legal_basis}</strong>. You must approve this request before any documents are transferred. You may decline.</p>
            </div>

            <div className="text-sm text-slate-600 bg-slate-50 border border-slate-200 rounded-lg p-4">
              You control what is shared. Only the documents you tick below will be sent.
              They will be retained for <strong>{selectedRequest.retention_period}</strong> as required by <strong>{selectedRequest.legal_basis}</strong>.
              Vaulta keeps an immutable record of your approval and every download.
            </div>

            <div className="space-y-3">
              <p className="text-xs text-slate-500 uppercase tracking-wider">Requested Document Types</p>
              <ul className="text-sm text-slate-700 list-disc list-inside bg-slate-50 rounded-md p-3 border border-slate-200">
                {selectedRequest.document_types.map((t, i) => <li key={i}>{t}</li>)}
              </ul>

              <p className="text-xs text-slate-500 uppercase tracking-wider pt-2">
                Choose documents from your vault to share
              </p>
              {userDocuments.length === 0 ? (
                <div className="text-xs text-slate-500 bg-slate-50 border border-slate-200 rounded-md p-3 flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 text-amber-500 mt-0.5" />
                  Your vault is empty. Upload documents to your Vault first, then return here to share them.
                </div>
              ) : (
                <div className="space-y-1 max-h-64 overflow-auto border border-slate-200 rounded-md">
                  {userDocuments.map((doc) => (
                    <label
                      key={doc.id}
                      className="flex items-center gap-3 px-3 py-2 hover:bg-slate-50 cursor-pointer border-b border-slate-100 last:border-b-0"
                    >
                      <Checkbox
                        checked={selectedDocIds.has(doc.id)}
                        onCheckedChange={(c) => {
                          setSelectedDocIds((prev) => {
                            const next = new Set(prev);
                            if (c) next.add(doc.id); else next.delete(doc.id);
                            return next;
                          });
                        }}
                      />
                      <FileText className="h-4 w-4 text-slate-400 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-slate-800 truncate">{doc.file_name}</p>
                        <p className="text-[10px] text-slate-400">
                          {doc.document_category || "general"} • {format(new Date(doc.created_at), "MMM d, yyyy")}
                        </p>
                      </div>
                      {doc.is_verified && (
                        <Badge variant="outline" className="text-[10px] bg-emerald-50 text-emerald-700 border-emerald-200">Verified</Badge>
                      )}
                    </label>
                  ))}
                </div>
              )}
              <p className="text-[11px] text-slate-500">
                {selectedDocIds.size} of {userDocuments.length} document(s) selected.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <span className="text-xs text-slate-500">Retention Period</span>
                <p className="font-medium text-slate-900">{selectedRequest.retention_period}</p>
              </div>
              <div>
                <span className="text-xs text-slate-500">Requested On</span>
                <p className="font-medium text-slate-900">{format(new Date(selectedRequest.created_at), "MMM d, yyyy")}</p>
              </div>
            </div>

            {!isPending ? (
              <div className="bg-slate-50 border border-slate-200 rounded-md p-3 text-xs text-slate-600">
                This request is {reqExpired ? "expired" : selectedRequest.status} and is shown for your records only.
              </div>
            ) : showDecline ? (
              <div className="space-y-3">
                <Textarea value={declineReason} onChange={(e) => setDeclineReason(e.target.value)} placeholder="Reason for declining (optional)" rows={3} />
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => setShowDecline(false)} className="flex-1">Cancel</Button>
                  <Button variant="destructive" onClick={handleDecline} disabled={processing} className="flex-1">
                    {processing ? <Loader2 className="h-4 w-4 animate-spin" /> : "Confirm Decline"}
                  </Button>
                </div>
              </div>
            ) : (
              <>
                <label className="flex items-start gap-3 cursor-pointer p-3 border border-slate-200 rounded-lg">
                  <Checkbox checked={consentChecked} onCheckedChange={(c) => setConsentChecked(!!c)} className="mt-0.5" />
                  <span className="text-sm text-slate-700">
                    I understand that the requesting institution will retain copies of these documents for {selectedRequest.retention_period} as required by {selectedRequest.legal_basis}.
                  </span>
                </label>

                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => setShowDecline(true)} className="flex-1">Decline</Button>
                  <Button onClick={handleApprove} disabled={!consentChecked || processing || selectedDocIds.size === 0} className="flex-1 gap-2">
                    {processing ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
                    Share Selected ({selectedDocIds.size})
                  </Button>
                </div>
              </>
            )}

            <Button variant="ghost" onClick={() => { setSelectedRequest(null); setConsentChecked(false); setShowDecline(false); setSelectedDocIds(new Set()); }} className="w-full text-slate-500">
              ← Back to all requests
            </Button>
          </div>
          );
        })() : requests.length === 0 ? (
          <div className="text-center py-12 text-sm text-muted-foreground">
            <ShieldCheck className="h-8 w-8 mx-auto mb-3 text-slate-300" />
            <p>No pending document requests</p>
          </div>
        ) : (
          <div className="space-y-3 mt-4">
            {requests.map((req) => {
              const expired = req.request_expires_at &&
                req.status === "pending" &&
                new Date(req.request_expires_at) < new Date();
              const statusLabel = expired
                ? "Expired"
                : req.status === "pending"
                  ? "Requested"
                  : req.status === "approved"
                    ? "Shared"
                    : req.status === "declined"
                      ? "Declined"
                      : req.status;
              const statusClass = expired
                ? "bg-slate-100 text-slate-600 border-slate-200"
                : req.status === "pending"
                  ? "bg-amber-50 text-amber-700 border-amber-200"
                  : req.status === "approved"
                    ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                    : "bg-slate-50 text-slate-600 border-slate-200";
              return (
                <button key={req.id} onClick={() => setSelectedRequest(req)}
                  className="w-full text-left p-4 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium text-slate-900">{req.document_types.length} document type(s) requested</span>
                    <Badge variant="outline" className={statusClass}>{statusLabel}</Badge>
                  </div>
                  <p className="text-xs text-slate-500">Legal basis: {req.legal_basis}</p>
                  <p className="text-xs text-slate-400 mt-1">{format(new Date(req.created_at), "MMM d, yyyy")}</p>
                </button>
              );
            })}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
};

export default DocumentPossessionReview;
