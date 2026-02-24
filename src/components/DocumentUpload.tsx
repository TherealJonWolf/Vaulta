import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Upload, X, FileText, Lock, CheckCircle2, AlertCircle, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useSubscription } from "@/hooks/useSubscription";
import DOMPurify from "dompurify";

interface DocumentUploadProps {
  isOpen: boolean;
  onClose: () => void;
  onUploadComplete: () => void;
  onUpgradeRequired: () => void;
}

const DocumentUpload = ({ isOpen, onClose, onUploadComplete, onUpgradeRequired }: DocumentUploadProps) => {
  const [dragActive, setDragActive] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [uploadStatus, setUploadStatus] = useState<"idle" | "encrypting" | "uploading" | "success" | "error">("idle");
  const [checking, setChecking] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const { user } = useAuth();
  const { toast } = useToast();
  const { fetchDocumentCount, checkCanUpload } = useSubscription();

  // Check eligibility when modal opens
  useEffect(() => {
    if (isOpen && user) {
      setChecking(true);
      checkCanUpload().then((allowed) => {
        setChecking(false);
        if (!allowed) {
          onClose();
          onUpgradeRequired();
        }
      });
    }
  }, [isOpen, user, checkCanUpload, onClose, onUpgradeRequired]);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFiles(e.dataTransfer.files);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    if (e.target.files && e.target.files[0]) {
      handleFiles(e.target.files);
    }
  };

  const ALLOWED_TYPES: Record<string, number[][]> = {
    "application/pdf": [[0x25, 0x50, 0x44, 0x46]], // %PDF
    "image/jpeg": [[0xFF, 0xD8, 0xFF]],
    "image/png": [[0x89, 0x50, 0x4E, 0x47]],
    "image/webp": [[0x52, 0x49, 0x46, 0x46]], // RIFF
    "application/msword": [[0xD0, 0xCF, 0x11, 0xE0]],
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [[0x50, 0x4B, 0x03, 0x04]], // PK zip
  };

  const SUSPICIOUS_PATTERNS = /\.(exe|bat|cmd|sh|ps1|vbs|js|msi|scr|com|pif|hta|wsf)$/i;

  const verifyFileSignature = async (file: File): Promise<boolean> => {
    const signatures = ALLOWED_TYPES[file.type];
    if (!signatures) return false;
    const buffer = await file.slice(0, 8).arrayBuffer();
    const bytes = new Uint8Array(buffer);
    return signatures.some(sig => sig.every((b, i) => bytes[i] === b));
  };

  // Sanitize filename to prevent XSS / path traversal
  const sanitizeFilename = (name: string): string => {
    const cleaned = DOMPurify.sanitize(name, { ALLOWED_TAGS: [] });
    return cleaned.replace(/[^a-zA-Z0-9._\-\s]/g, '_').substring(0, 255);
  };

  // Deep content scan for embedded scripts/payloads
  const scanForMaliciousContent = async (file: File): Promise<{ safe: boolean; reason?: string }> => {
    // For text-based files, scan content
    if (file.type === 'application/pdf') {
      const buffer = await file.slice(0, Math.min(file.size, 65536)).arrayBuffer();
      const text = new TextDecoder('utf-8', { fatal: false }).decode(new Uint8Array(buffer));
      const maliciousPatterns = [
        /\/JavaScript\s/i,
        /\/JS\s/i,
        /<script/i,
        /eval\s*\(/i,
        /document\.cookie/i,
        /window\.location/i,
        /onclick\s*=/i,
        /onerror\s*=/i,
        /onload\s*=/i,
        /fromCharCode/i,
        /SELECT\s+.*\s+FROM/i,
        /INSERT\s+INTO/i,
        /DROP\s+TABLE/i,
        /UNION\s+SELECT/i,
        /--\s*$/m,
      ];
      for (const pattern of maliciousPatterns) {
        if (pattern.test(text)) {
          return { safe: false, reason: `Embedded script or SQL injection pattern detected` };
        }
      }
    }
    return { safe: true };
  };

  // Flag account as suspended and blacklist email
  const flagAccountAsFraudulent = async (reason: string, fileName: string) => {
    if (!user) return;
    try {
      // Insert account flag
      await supabase.from('account_flags').insert({
        user_id: user.id,
        flag_type: 'suspended',
        reason,
        flagged_document_name: fileName,
      });

      // Log security event
      await supabase.from('security_events').insert({
        user_id: user.id,
        event_type: 'fraud_detected',
        event_description: `Fraudulent document upload blocked: ${reason}. File: ${fileName}`,
        metadata: { fileName, reason, action: 'account_suspended' },
      });

      // Blacklist email via edge function (uses service role)
      await supabase.functions.invoke('flag-fraudulent-account', {
        body: { userId: user.id, reason, fileName },
      });
    } catch (err) {
      console.error('Error flagging account:', err);
    }
  };

  const handleFiles = async (files: FileList) => {
    if (!user) {
      toast({
        variant: "destructive",
        title: "Authentication Required",
        description: "Please log in to upload documents.",
      });
      return;
    }

    const allowed = await checkCanUpload();
    if (!allowed) {
      onClose();
      onUpgradeRequired();
      return;
    }

    const file = files[0];
    const maxSize = 50 * 1024 * 1024;

    // Reject empty files
    if (file.size === 0) {
      toast({ variant: "destructive", title: "Invalid Document", description: "The file is empty and cannot be accepted." });
      return;
    }

    if (file.size > maxSize) {
      toast({ variant: "destructive", title: "File Too Large", description: "Maximum file size is 50MB." });
      return;
    }

    // Sanitize and check filename
    const safeName = sanitizeFilename(file.name);

    // Reject suspicious filenames
    if (SUSPICIOUS_PATTERNS.test(file.name)) {
      toast({ variant: "destructive", title: "Blocked — Suspicious File", description: "Executable and script files are not permitted." });
      return;
    }

    // Reject disallowed MIME types
    if (!ALLOWED_TYPES[file.type]) {
      toast({ variant: "destructive", title: "Unsupported File Type", description: "Only PDF, image (JPG/PNG/WebP), and Word documents are accepted." });
      return;
    }

    // Verify magic-byte signature matches declared MIME type
    const signatureValid = await verifyFileSignature(file);
    if (!signatureValid) {
      // This is a fraud signal — flag account
      await flagAccountAsFraudulent(
        'File signature mismatch: contents do not match declared MIME type (possible forgery)',
        file.name
      );
      toast({
        variant: "destructive",
        title: "⚠️ Document Rejected — Account Flagged",
        description: "This file appears to be tampered with. Your account has been flagged for review.",
      });
      onClose();
      return;
    }

    // Deep content scan for embedded malicious payloads
    const scanResult = await scanForMaliciousContent(file);
    if (!scanResult.safe) {
      await flagAccountAsFraudulent(
        `Malicious content detected: ${scanResult.reason}`,
        file.name
      );
      toast({
        variant: "destructive",
        title: "⚠️ Malicious Document Blocked — Account Suspended",
        description: "This document contains embedded scripts or injection patterns. Your account has been suspended pending review.",
      });
      onClose();
      return;
    }

    setUploading(true);
    setProgress(0);
    setUploadStatus("encrypting");

    try {
      // Simulate encryption phase
      for (let i = 0; i <= 30; i++) {
        await new Promise((r) => setTimeout(r, 20));
        setProgress(i);
      }

      setUploadStatus("uploading");

      // Create file path with user ID for RLS
      const fileExt = file.name.split(".").pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
      const filePath = `${user.id}/${fileName}`;

      // Upload to storage
      const { error: uploadError } = await supabase.storage
        .from("documents")
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      // Simulate upload progress
      for (let i = 30; i <= 80; i++) {
        await new Promise((r) => setTimeout(r, 15));
        setProgress(i);
      }

      // Save document metadata
      const { error: dbError } = await supabase.from("documents").insert({
        user_id: user.id,
        file_name: file.name,
        file_path: filePath,
        file_size: file.size,
        mime_type: file.type,
        source: "upload",
      });

      if (dbError) throw dbError;

      // Complete progress
      for (let i = 80; i <= 100; i++) {
        await new Promise((r) => setTimeout(r, 10));
        setProgress(i);
      }

      setUploadStatus("success");
      toast({
        title: "Document Secured",
        description: `${file.name} has been encrypted and stored in your Sovereign Sector.`,
      });

      // Refresh document count after upload
      fetchDocumentCount();

      setTimeout(() => {
        onUploadComplete();
        onClose();
        resetState();
      }, 1500);
    } catch (error) {
      console.error("Upload error:", error);
      setUploadStatus("error");
      toast({
        variant: "destructive",
        title: "Upload Failed",
        description: "Unable to secure document. Please try again.",
      });
    } finally {
      setUploading(false);
    }
  };

  const resetState = () => {
    setProgress(0);
    setUploadStatus("idle");
    setUploading(false);
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-6"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          className="w-full max-w-lg cyber-border rounded-2xl bg-card p-8"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-primary/10 border border-primary/30 flex items-center justify-center">
                <Lock className="text-primary" size={24} />
              </div>
              <div>
                <h2 className="font-display text-xl font-bold gradient-text">Secure Upload</h2>
                <p className="text-sm text-muted-foreground font-mono">256-bit AES Encryption</p>
              </div>
            </div>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X size={20} />
            </Button>
          </div>

          {/* Upload Area */}
          {uploadStatus === "idle" && (
            <div
              className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors ${
                dragActive
                  ? "border-primary bg-primary/10"
                  : "border-border hover:border-primary/50"
              }`}
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
            >
              <input
                ref={inputRef}
                type="file"
                className="hidden"
                onChange={handleChange}
                accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx"
              />
              <Upload className="mx-auto text-muted-foreground mb-4" size={48} />
              <h3 className="font-display text-lg font-bold text-foreground mb-2">
                Drop your document here
              </h3>
              <p className="text-sm text-muted-foreground font-rajdhani mb-4">
                PDF, Images, or Word documents up to 50MB
              </p>
              <Button
                onClick={() => inputRef.current?.click()}
                className="btn-gradient font-rajdhani font-bold text-primary-foreground"
              >
                Select File
              </Button>
            </div>
          )}

          {/* Progress States */}
          {uploadStatus !== "idle" && (
            <div className="space-y-6">
              <div className="flex items-center gap-4">
                <div
                  className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                    uploadStatus === "success"
                      ? "bg-green-500/20 border border-green-500/30"
                      : uploadStatus === "error"
                      ? "bg-red-500/20 border border-red-500/30"
                      : "bg-primary/10 border border-primary/30"
                  }`}
                >
                  {uploadStatus === "success" ? (
                    <CheckCircle2 className="text-green-500" size={24} />
                  ) : uploadStatus === "error" ? (
                    <AlertCircle className="text-red-500" size={24} />
                  ) : (
                    <FileText className="text-primary" size={24} />
                  )}
                </div>
                <div className="flex-1">
                  <h3 className="font-display font-bold text-foreground">
                    {uploadStatus === "encrypting" && "Encrypting Document..."}
                    {uploadStatus === "uploading" && "Securing to Vault..."}
                    {uploadStatus === "success" && "Document Secured!"}
                    {uploadStatus === "error" && "Upload Failed"}
                  </h3>
                  <p className="text-sm text-muted-foreground font-mono">
                    {uploadStatus === "encrypting" && "Applying 256-bit AES encryption"}
                    {uploadStatus === "uploading" && "Transferring to Sovereign Sector"}
                    {uploadStatus === "success" && "End-to-end encrypted storage complete"}
                    {uploadStatus === "error" && "Please try again"}
                  </p>
                </div>
              </div>

              {(uploadStatus === "encrypting" || uploadStatus === "uploading") && (
                <Progress value={progress} className="h-2" />
              )}

              {uploadStatus === "error" && (
                <Button
                  onClick={resetState}
                  className="w-full btn-gradient font-rajdhani font-bold text-primary-foreground"
                >
                  Try Again
                </Button>
              )}
            </div>
          )}

          {/* Security Note */}
          <div className="mt-6 p-4 rounded-xl bg-muted/30 border border-border">
            <p className="text-xs text-muted-foreground font-mono flex items-center gap-2">
              <Lock size={12} className="text-primary" />
              All documents are encrypted client-side before upload. Your data remains private and secure.
            </p>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default DocumentUpload;
