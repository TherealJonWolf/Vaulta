import { useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Download, X, FileText, FolderInput } from "lucide-react";
import { format } from "date-fns";
import { useInstitutionalAuth } from "../hooks/useInstitutionalAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { DocumentPossessionRequest } from "./DocumentPossessionRequest";
import { DocumentsOnFile } from "./DocumentsOnFile";

interface Submission {
  id: string;
  applicant_name: string;
  reference_id: string;
  document_count: number;
  trust_score: number | null;
  score_state: string;
  assessment_narrative: string | null;
  document_types: string[];
  submitted_at: string;
  assessed_at: string | null;
}

interface Props {
  submission: Submission | null;
  open: boolean;
  onClose: () => void;
}

const scoreConfig: Record<string, { label: string; className: string }> = {
  clear: { label: "Clear", className: "bg-emerald-100 text-emerald-800 border-emerald-200" },
  review: { label: "Under Review", className: "bg-amber-100 text-amber-800 border-amber-200" },
  flag: { label: "Flagged", className: "bg-red-100 text-red-800 border-red-200" },
  insufficient: { label: "Insufficient", className: "bg-slate-100 text-slate-600 border-slate-200" },
};

export const ApplicantDetailDrawer = ({ submission, open, onClose }: Props) => {
  const { institutionId, user } = useInstitutionalAuth();
  const [requestOpen, setRequestOpen] = useState(false);

  const handleExportPdf = async () => {
    if (!submission) return;
    try {
      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(
        `https://${projectId}.supabase.co/functions/v1/institutional-pdf-export`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session?.access_token}`,
          },
          body: JSON.stringify({ submission_id: submission.id }),
        }
      );
      if (!res.ok) throw new Error("Failed to generate PDF");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `vaulta-assessment-${submission.reference_id}.pdf`;
      a.click();
      URL.revokeObjectURL(url);

      if (institutionId && user) {
        await (supabase.from as any)('institutional_activity_log').insert({
          institution_id: institutionId,
          user_id: user.id,
          event_type: 'PDF Exported',
          reference_id: submission.reference_id,
          applicant_name: submission.applicant_name,
          detail: `Assessment PDF exported for ${submission.applicant_name}`,
        });
      }
      toast.success("PDF exported successfully");
    } catch {
      toast.error("Failed to export PDF. Please try again.");
    }
  };

  if (!submission) return null;
  const config = scoreConfig[submission.score_state] || scoreConfig.insufficient;

  return (
    <>
      <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
        <SheetContent className="w-[480px] sm:w-[540px] bg-white border-l border-slate-200 p-0">
          <div className="flex items-center justify-between p-6 border-b border-slate-200">
            <SheetHeader className="p-0">
              <SheetTitle className="text-lg font-semibold text-slate-900">
                {submission.applicant_name}
              </SheetTitle>
            </SheetHeader>
            <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="p-6 space-y-6 overflow-auto" style={{ maxHeight: "calc(100vh - 160px)" }}>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <p className="text-xs text-slate-500 uppercase tracking-wider">Reference ID</p>
                <p className="text-sm font-medium text-slate-900">{submission.reference_id}</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-slate-500 uppercase tracking-wider">Submitted</p>
                <p className="text-sm font-medium text-slate-900">
                  {format(new Date(submission.submitted_at), "MMM d, yyyy HH:mm")}
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-slate-500 uppercase tracking-wider">Documents</p>
                <p className="text-sm font-medium text-slate-900">{submission.document_count}</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-slate-500 uppercase tracking-wider">Trust Score</p>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-slate-900">{submission.trust_score ?? "—"}</span>
                  <Badge variant="outline" className={config.className}>{config.label}</Badge>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-xs text-slate-500 uppercase tracking-wider">Assessment Narrative</p>
              <p className="text-sm text-slate-700 leading-relaxed">
                {submission.assessment_narrative || "Assessment pending."}
              </p>
            </div>

            <div className="space-y-2">
              <p className="text-xs text-slate-500 uppercase tracking-wider">Document Types Received</p>
              <div className="flex flex-wrap gap-1.5">
                {(submission.document_types || []).map((type, i) => (
                  <Badge key={i} variant="outline" className="text-xs bg-slate-50 text-slate-600 border-slate-200">
                    <FileText className="h-3 w-3 mr-1" />{type}
                  </Badge>
                ))}
                {(!submission.document_types || submission.document_types.length === 0) && (
                  <p className="text-sm text-slate-400">No document types recorded</p>
                )}
              </div>
            </div>

            {/* Documents on File section */}
            <DocumentsOnFile submissionId={submission.id} applicantName={submission.applicant_name} />
          </div>

          <div className="p-6 border-t border-slate-200 space-y-2">
            <Button onClick={() => setRequestOpen(true)} variant="outline" className="w-full gap-2 border-slate-300">
              <FolderInput className="h-4 w-4" />
              Request Documents
            </Button>
            <Button onClick={handleExportPdf} className="w-full bg-slate-900 hover:bg-slate-800 text-white">
              <Download className="h-4 w-4 mr-2" />
              Export PDF Assessment Record
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      <DocumentPossessionRequest
        open={requestOpen}
        onClose={() => setRequestOpen(false)}
        applicantName={submission.applicant_name}
        submissionId={submission.id}
        referenceId={submission.reference_id}
      />
    </>
  );
};
