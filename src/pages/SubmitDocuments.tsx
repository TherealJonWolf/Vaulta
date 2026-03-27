import { useState, useEffect, useCallback } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Upload, CheckCircle, AlertTriangle, Loader2, FileText, X } from "lucide-react";
import { toast } from "sonner";

const MAX_FILE_SIZE = 25 * 1024 * 1024;
const MAX_FILES = 20;
const ACCEPTED_TYPES = ["application/pdf", "image/jpeg", "image/png"];

interface TokenData {
  id: string;
  applicant_name: string;
  reference_id: string;
  institution_name: string;
  is_valid: boolean;
}

interface InstitutionBranding {
  display_name: string | null;
  logo_url: string | null;
  accent_color: string;
  welcome_message: string | null;
}

const SubmitDocuments = () => {
  const { token } = useParams<{ token: string }>();
  const [tokenData, setTokenData] = useState<TokenData | null>(null);
  const [validating, setValidating] = useState(true);
  const [invalid, setInvalid] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [branding, setBranding] = useState<InstitutionBranding | null>(null);

  useEffect(() => {
    const validate = async () => {
      if (!token) { setInvalid(true); setValidating(false); return; }
      const { data, error } = await (supabase.rpc as any)('validate_intake_token', { p_token: token });
      if (error || !data || data.length === 0 || !data[0].is_valid) {
        setInvalid(true); setValidating(false); return;
      }
      setTokenData(data[0]);

      // Fetch institution branding via the intake link
      const linkId = data[0].id;
      const { data: linkData } = await (supabase.from as any)('intake_links')
        .select('institution_id')
        .eq('id', linkId)
        .maybeSingle();

      if (linkData?.institution_id) {
        const { data: settings } = await (supabase.from as any)('institution_settings')
          .select('display_name, logo_path, accent_color, welcome_message')
          .eq('institution_id', linkData.institution_id)
          .maybeSingle();

        if (settings) {
          let logoUrl = null;
          if (settings.logo_path) {
            const { data: urlData } = supabase.storage.from("documents").getPublicUrl(settings.logo_path);
            logoUrl = urlData.publicUrl;
          }
          setBranding({
            display_name: settings.display_name,
            logo_url: logoUrl,
            accent_color: settings.accent_color || "#0f172a",
            welcome_message: settings.welcome_message,
          });
        }
      }

      setValidating(false);
    };
    validate();
  }, [token]);

  const addFiles = useCallback((newFiles: File[]) => {
    const valid = newFiles.filter(f => {
      if (!ACCEPTED_TYPES.includes(f.type)) { toast.error(`${f.name}: Only PDF, JPG, and PNG files are accepted.`); return false; }
      if (f.size > MAX_FILE_SIZE) { toast.error(`${f.name}: File exceeds 25MB limit.`); return false; }
      return true;
    });
    setFiles(prev => {
      const combined = [...prev, ...valid].slice(0, MAX_FILES);
      if (prev.length + valid.length > MAX_FILES) toast.error(`Maximum ${MAX_FILES} documents per submission.`);
      return combined;
    });
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    addFiles(Array.from(e.dataTransfer.files));
  }, [addFiles]);

  const handleSubmit = async () => {
    if (files.length === 0) { toast.error("Please add at least one document."); return; }
    if (!token) return;
    setSubmitting(true);
    try {
      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const formData = new FormData();
      formData.append("token", token);
      files.forEach(f => formData.append("files", f));
      const res = await fetch(
        `https://${projectId}.supabase.co/functions/v1/institutional-submit`,
        { method: "POST", body: formData }
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Submission failed" }));
        throw new Error(err.error || "Submission failed");
      }
      setSubmitted(true);
    } catch (err: any) {
      toast.error(err.message || "Failed to submit documents. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (validating) return (
    <div className="min-h-screen bg-white flex items-center justify-center">
      <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
    </div>
  );

  if (invalid) return (
    <div className="min-h-screen bg-white flex items-center justify-center p-8">
      <div className="text-center max-w-md">
        <AlertTriangle className="h-12 w-12 text-amber-500 mx-auto mb-4" />
        <h1 className="text-lg font-semibold text-slate-900 mb-2">Link Expired or Invalid</h1>
        <p className="text-sm text-slate-500">This link has expired or is invalid. Contact your lender or property manager for a new link.</p>
      </div>
    </div>
  );

  if (submitted) return (
    <div className="min-h-screen bg-white flex items-center justify-center p-8">
      <div className="text-center max-w-md">
        <CheckCircle className="h-12 w-12 text-emerald-500 mx-auto mb-4" />
        <h1 className="text-lg font-semibold text-slate-900 mb-2">Documents Received Securely</h1>
        <p className="text-sm text-slate-500">Your documents have been received securely. Your lender or property manager will be notified of the assessment result.</p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center p-8">
      <div className="w-full max-w-lg">
        <div className="text-center mb-8">
          <span className="text-xl font-semibold text-slate-900 tracking-tight">Vaulta</span>
          <p className="text-sm text-slate-500 mt-3">
            Securely upload your documents for {tokenData?.institution_name || "your institution"}.
            All files are encrypted before transmission and stored securely.
          </p>
          <p className="text-xs text-slate-400 mt-1">Accepted: PDF, JPG, PNG · Max 25MB per file · Up to 20 documents</p>
        </div>

        <div
          onDrop={handleDrop}
          onDragOver={e => e.preventDefault()}
          className="border-2 border-dashed border-slate-200 rounded-lg p-8 text-center hover:border-slate-300 transition-colors cursor-pointer"
          onClick={() => document.getElementById("intake-file-input")?.click()}
        >
          <Upload className="h-8 w-8 text-slate-300 mx-auto mb-3" />
          <p className="text-sm text-slate-600">Drag and drop files here, or click to browse</p>
          <input
            id="intake-file-input"
            type="file"
            multiple
            accept=".pdf,.jpg,.jpeg,.png"
            className="hidden"
            onChange={e => addFiles(Array.from(e.target.files || []))}
          />
        </div>

        {files.length > 0 && (
          <div className="mt-4 space-y-2">
            {files.map((f, i) => (
              <div key={i} className="flex items-center justify-between px-3 py-2 bg-slate-50 rounded-md border border-slate-200">
                <div className="flex items-center gap-2 min-w-0">
                  <FileText className="h-4 w-4 text-slate-400 shrink-0" />
                  <span className="text-sm text-slate-700 truncate">{f.name}</span>
                  <span className="text-xs text-slate-400 shrink-0">({(f.size / 1024 / 1024).toFixed(1)} MB)</span>
                </div>
                <button onClick={() => setFiles(prev => prev.filter((_, idx) => idx !== i))} className="text-slate-400 hover:text-slate-600 shrink-0 ml-2">
                  <X className="h-4 w-4" />
                </button>
              </div>
            ))}
            <p className="text-xs text-slate-400 text-right">{files.length} / {MAX_FILES} documents</p>
          </div>
        )}

        <Button onClick={handleSubmit} disabled={submitting || files.length === 0} className="w-full mt-6 bg-slate-900 hover:bg-slate-800 text-white">
          {submitting ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Encrypting & Submitting...</> : <><Upload className="h-4 w-4 mr-2" />Submit Documents Securely</>}
        </Button>
      </div>
    </div>
  );
};

export default SubmitDocuments;
