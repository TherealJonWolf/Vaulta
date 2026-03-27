import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useInstitutionalAuth } from "../hooks/useInstitutionalAuth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { format, isPast } from "date-fns";
import { Download, Eye, AlertTriangle, Trash2 } from "lucide-react";

interface Props {
  submissionId: string;
  applicantName: string;
}

export const DocumentsOnFile = ({ submissionId, applicantName }: Props) => {
  const { institutionId, user } = useInstitutionalAuth();
  const [documents, setDocuments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!institutionId) return;
    const fetch = async () => {
      const { data } = await (supabase.from as any)("institution_documents")
        .select("*")
        .eq("institution_id", institutionId)
        .eq("possession_request_id", submissionId)
        .is("deleted_at", null)
        .order("transferred_at", { ascending: false });
      setDocuments(data || []);
      setLoading(false);
    };
    fetch();
  }, [institutionId, submissionId]);

  const logAccess = async (doc: any, accessType: string) => {
    if (!institutionId || !user) return;
    await (supabase.from as any)("document_access_log").insert({
      institution_id: institutionId,
      institution_document_id: doc.id,
      consent_record_id: doc.consent_record_id,
      accessed_by: user.id,
      access_type: accessType,
    });

    await (supabase.from as any)("institutional_activity_log").insert({
      institution_id: institutionId,
      user_id: user.id,
      event_type: `Document ${accessType === "view" ? "Viewed" : "Downloaded"}`,
      applicant_name: applicantName,
      detail: `${accessType === "view" ? "Viewed" : "Downloaded"} ${doc.file_name}`,
    });
  };

  const handleView = async (doc: any) => {
    try {
      const { data, error } = await supabase.storage
        .from("institution-documents")
        .createSignedUrl(doc.file_path, 900); // 15 min
      if (error) throw error;
      await logAccess(doc, "view");
      window.open(data.signedUrl, "_blank");
    } catch {
      toast.error("Failed to generate view URL");
    }
  };

  const handleDownload = async (doc: any) => {
    try {
      const { data, error } = await supabase.storage
        .from("institution-documents")
        .createSignedUrl(doc.file_path, 900);
      if (error) throw error;
      await logAccess(doc, "download");
      const a = document.createElement("a");
      a.href = data.signedUrl;
      a.download = doc.file_name;
      a.click();
    } catch {
      toast.error("Failed to generate download URL");
    }
  };

  const handleDelete = async (doc: any) => {
    try {
      await (supabase.from as any)("institution_documents")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", doc.id);

      await (supabase.from as any)("institutional_activity_log").insert({
        institution_id: institutionId,
        user_id: user?.id,
        event_type: "Document Deleted (Retention Expired)",
        applicant_name: applicantName,
        detail: `Deleted ${doc.file_name} after retention period expiry`,
      });

      setDocuments((prev) => prev.filter((d) => d.id !== doc.id));
      toast.success("Document deleted");
    } catch {
      toast.error("Failed to delete document");
    }
  };

  if (loading || documents.length === 0) return null;

  return (
    <div className="space-y-3">
      <p className="text-xs text-slate-500 uppercase tracking-wider">Documents on File</p>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="text-xs">Document</TableHead>
            <TableHead className="text-xs">Transferred</TableHead>
            <TableHead className="text-xs">Retention Expires</TableHead>
            <TableHead className="text-xs text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {documents.map((doc) => {
            const expired = doc.retention_expires_at && isPast(new Date(doc.retention_expires_at));
            return (
              <TableRow key={doc.id}>
                <TableCell className="text-sm">{doc.file_name}</TableCell>
                <TableCell className="text-xs text-slate-500">
                  {format(new Date(doc.transferred_at), "MMM d, yyyy")}
                </TableCell>
                <TableCell>
                  {doc.retention_expires_at ? (
                    expired ? (
                      <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200 text-xs">
                        <AlertTriangle className="h-3 w-3 mr-1" /> Expired
                      </Badge>
                    ) : (
                      <span className="text-xs text-slate-500">{format(new Date(doc.retention_expires_at), "MMM d, yyyy")}</span>
                    )
                  ) : (
                    <span className="text-xs text-slate-400">Open-ended</span>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-1">
                    <Button variant="ghost" size="sm" onClick={() => handleView(doc)} className="h-7 w-7 p-0">
                      <Eye className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => handleDownload(doc)} className="h-7 w-7 p-0">
                      <Download className="h-3.5 w-3.5" />
                    </Button>
                    {expired && (
                      <Button variant="ghost" size="sm" onClick={() => handleDelete(doc)} className="h-7 w-7 p-0 text-red-500 hover:text-red-700">
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
      {documents.some((d) => d.retention_expires_at && isPast(new Date(d.retention_expires_at))) && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-xs text-red-800">
          <AlertTriangle className="h-4 w-4 inline mr-1" />
          Retention period expired for one or more documents. These should be deleted per your stated compliance obligation.
        </div>
      )}
    </div>
  );
};
