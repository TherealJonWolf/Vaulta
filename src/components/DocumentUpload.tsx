import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Upload, X, FileText, Lock, CheckCircle2, AlertCircle, ShieldAlert, Search, Brain, Fingerprint } from "lucide-react";
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
  encryptFile: (fileBuffer: ArrayBuffer) => Promise<{ encrypted: ArrayBuffer; iv: string }>;
}

type VerificationStep = {
  id: string;
  label: string;
  status: "pending" | "running" | "passed" | "failed" | "warning" | "skipped";
  detail?: string;
};

const DocumentUpload = ({ isOpen, onClose, onUploadComplete, onUpgradeRequired, encryptFile }: DocumentUploadProps) => {
  const [dragActive, setDragActive] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [uploadStatus, setUploadStatus] = useState<"idle" | "verifying" | "encrypting" | "uploading" | "success" | "error">("idle");
  const [checking, setChecking] = useState(false);
  const [verificationSteps, setVerificationSteps] = useState<VerificationStep[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const { user } = useAuth();
  const { toast } = useToast();
  const { fetchDocumentCount, checkCanUpload } = useSubscription();

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
    "application/pdf": [[0x25, 0x50, 0x44, 0x46]],
    "image/jpeg": [[0xFF, 0xD8, 0xFF]],
    "image/png": [[0x89, 0x50, 0x4E, 0x47]],
    "image/webp": [[0x52, 0x49, 0x46, 0x46]],
    "application/msword": [[0xD0, 0xCF, 0x11, 0xE0]],
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [[0x50, 0x4B, 0x03, 0x04]],
  };

  const SUSPICIOUS_PATTERNS = /\.(exe|bat|cmd|sh|ps1|vbs|js|msi|scr|com|pif|hta|wsf)$/i;

  const verifyFileSignature = async (file: File): Promise<boolean> => {
    const signatures = ALLOWED_TYPES[file.type];
    if (!signatures) return false;
    const buffer = await file.slice(0, 8).arrayBuffer();
    const bytes = new Uint8Array(buffer);
    return signatures.some(sig => sig.every((b, i) => bytes[i] === b));
  };

  const sanitizeFilename = (name: string): string => {
    const cleaned = DOMPurify.sanitize(name, { ALLOWED_TAGS: [] });
    return cleaned.replace(/[^a-zA-Z0-9._\-\s]/g, '_').substring(0, 255);
  };

  const scanForMaliciousContent = async (file: File): Promise<{ safe: boolean; reason?: string }> => {
    if (file.type === 'application/pdf') {
      const buffer = await file.slice(0, Math.min(file.size, 65536)).arrayBuffer();
      const text = new TextDecoder('utf-8', { fatal: false }).decode(new Uint8Array(buffer));
      const maliciousPatterns = [
        /\/JavaScript\s/i, /\/JS\s/i, /<script/i, /eval\s*\(/i,
        /document\.cookie/i, /window\.location/i, /onclick\s*=/i,
        /onerror\s*=/i, /onload\s*=/i, /fromCharCode/i,
        /SELECT\s+.*\s+FROM/i, /INSERT\s+INTO/i, /DROP\s+TABLE/i, /UNION\s+SELECT/i,
      ];
      for (const pattern of maliciousPatterns) {
        if (pattern.test(text)) {
          return { safe: false, reason: `Embedded script or SQL injection pattern detected` };
        }
      }
    }
    return { safe: true };
  };

  // Compute SHA-256 hash of file
  const computeSHA256 = async (file: File): Promise<string> => {
    const buffer = await file.arrayBuffer();
    const hashBuffer = await crypto.subtle.digest("SHA-256", buffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
  };

  // Extract EXIF/metadata from file
  const extractMetadata = async (file: File): Promise<Record<string, any>> => {
    const metadata: Record<string, any> = {};

    if (file.type === "application/pdf") {
      const buffer = await file.slice(0, Math.min(file.size, 131072)).arrayBuffer();
      const text = new TextDecoder('utf-8', { fatal: false }).decode(new Uint8Array(buffer));

      // Extract PDF producer/creator
      const producerMatch = text.match(/\/Producer\s*\(([^)]+)\)/);
      const creatorMatch = text.match(/\/Creator\s*\(([^)]+)\)/);
      const modDateMatch = text.match(/\/ModDate\s*\(D:(\d{14})/);
      const createDateMatch = text.match(/\/CreationDate\s*\(D:(\d{14})/);

      if (producerMatch) metadata.software = producerMatch[1];
      if (creatorMatch) metadata.creator = creatorMatch[1];
      if (modDateMatch) metadata.modifyDate = modDateMatch[1];
      if (createDateMatch) metadata.createDate = createDateMatch[1];

      // PDF structure checks
      metadata.pdfInfo = {
        hasIncrementalSaves: (text.match(/%%EOF/g) || []).length > 1,
        hasAnnotations: /\/Annot/.test(text),
        hasFormFields: /\/AcroForm/.test(text),
        producer: producerMatch?.[1] || null,
      };
    }

    if (file.type.startsWith("image/")) {
      // Check for EXIF data in JPEG
      if (file.type === "image/jpeg") {
        const buffer = await file.slice(0, Math.min(file.size, 65536)).arrayBuffer();
        const view = new DataView(buffer);
        // Look for EXIF APP1 marker
        let offset = 2;
        while (offset < view.byteLength - 4) {
          const marker = view.getUint16(offset);
          if (marker === 0xFFE1) {
            // APP1 - EXIF
            const exifData = new TextDecoder('utf-8', { fatal: false }).decode(
              new Uint8Array(buffer, offset, Math.min(2000, view.byteLength - offset))
            );
            const softwareMatch = exifData.match(/Adobe|Photoshop|GIMP|Paint|Canva|Pixlr/i);
            if (softwareMatch) {
              metadata.software = softwareMatch[0];
            }
            break;
          }
          const segLength = view.getUint16(offset + 2);
          offset += 2 + segLength;
        }
      }
    }

    return metadata;
  };

  // Generate base64 preview for AI analysis
  const generateBase64Preview = async (file: File): Promise<string | null> => {
    // For images, use the file directly (limited to 1MB for AI)
    if (file.type.startsWith("image/")) {
      const slice = file.slice(0, Math.min(file.size, 1048576));
      const buffer = await slice.arrayBuffer();
      const bytes = new Uint8Array(buffer);
      let binary = "";
      for (let i = 0; i < bytes.length; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      return btoa(binary);
    }

    // For PDFs, we can't easily render client-side; send first 500KB for text analysis
    if (file.type === "application/pdf") {
      const slice = file.slice(0, Math.min(file.size, 524288));
      const buffer = await slice.arrayBuffer();
      const bytes = new Uint8Array(buffer);
      let binary = "";
      for (let i = 0; i < bytes.length; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      return btoa(binary);
    }

    return null;
  };

  const updateStep = (id: string, update: Partial<VerificationStep>) => {
    setVerificationSteps(prev =>
      prev.map(s => s.id === id ? { ...s, ...update } : s)
    );
  };

  const flagAccountAsFraudulent = async (reason: string, fileName: string) => {
    if (!user) return;
    try {
      await supabase.from('account_flags').insert({
        user_id: user.id,
        flag_type: 'suspended',
        reason,
        flagged_document_name: fileName,
      });
      await supabase.from('security_events').insert({
        user_id: user.id,
        event_type: 'fraud_detected',
        event_description: `Fraudulent document upload blocked: ${reason}. File: ${fileName}`,
        metadata: { fileName, reason, action: 'account_suspended' },
      });
      await supabase.functions.invoke('flag-fraudulent-account', {
        body: { userId: user.id, reason, fileName },
      });
    } catch (err) {
      console.error('Error flagging account:', err);
    }
  };

  const handleFiles = async (files: FileList) => {
    if (!user) {
      toast({ variant: "destructive", title: "Authentication Required", description: "Please log in to upload documents." });
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

    if (file.size === 0) {
      toast({ variant: "destructive", title: "Invalid Document", description: "The file is empty and cannot be accepted." });
      return;
    }

    if (file.size > maxSize) {
      toast({ variant: "destructive", title: "File Too Large", description: "Maximum file size is 50MB." });
      return;
    }

    const safeName = sanitizeFilename(file.name);

    if (SUSPICIOUS_PATTERNS.test(file.name)) {
      toast({ variant: "destructive", title: "Blocked — Suspicious File", description: "Executable and script files are not permitted." });
      return;
    }

    if (!ALLOWED_TYPES[file.type]) {
      toast({ variant: "destructive", title: "Unsupported File Type", description: "Only PDF, image (JPG/PNG/WebP), and Word documents are accepted." });
      return;
    }

    // Start multi-layer verification
    setUploading(true);
    setUploadStatus("verifying");
    setProgress(0);

    const steps: VerificationStep[] = [
      { id: "signature", label: "Magic-byte Signature Check", status: "pending" },
      { id: "content", label: "Malicious Content Scan", status: "pending" },
      { id: "hash", label: "SHA-256 Fingerprint Check", status: "pending" },
      { id: "metadata", label: "EXIF & Metadata Analysis", status: "pending" },
      { id: "pdf", label: "Document Structure Validation", status: "pending" },
      { id: "duplicate", label: "Cross-User Duplicate Detection", status: "pending" },
      { id: "ai", label: "AI Authenticity Analysis", status: "pending" },
    ];
    setVerificationSteps(steps);

    let blocked = false;

    // Step 1: Magic-byte signature
    updateStep("signature", { status: "running" });
    setProgress(5);
    const signatureValid = await verifyFileSignature(file);
    if (!signatureValid) {
      updateStep("signature", { status: "failed", detail: "File header doesn't match declared type" });
      await flagAccountAsFraudulent('File signature mismatch: contents do not match declared MIME type', file.name);
      toast({ variant: "destructive", title: "⚠️ Document Rejected — Account Flagged", description: "This file appears to be tampered with." });
      setUploadStatus("error");
      setUploading(false);
      return;
    }
    updateStep("signature", { status: "passed", detail: "File signature verified" });
    setProgress(10);

    // Step 2: Content scan
    updateStep("content", { status: "running" });
    const scanResult = await scanForMaliciousContent(file);
    if (!scanResult.safe) {
      updateStep("content", { status: "failed", detail: scanResult.reason });
      await flagAccountAsFraudulent(`Malicious content: ${scanResult.reason}`, file.name);
      toast({ variant: "destructive", title: "⚠️ Malicious Document Blocked", description: "Embedded scripts or injection patterns detected." });
      setUploadStatus("error");
      setUploading(false);
      return;
    }
    updateStep("content", { status: "passed", detail: "No malicious patterns found" });
    setProgress(20);

    // Step 3: SHA-256 hash
    updateStep("hash", { status: "running" });
    const sha256Hash = await computeSHA256(file);
    updateStep("hash", { status: "passed", detail: `Hash: ${sha256Hash.substring(0, 16)}...` });
    setProgress(30);

    // Step 4: Metadata extraction
    updateStep("metadata", { status: "running" });
    const metadata = await extractMetadata(file);
    if (metadata.software) {
      const suspiciousEditors = ["photoshop", "gimp", "paint.net", "pixlr", "canva", "affinity"];
      const isSuspicious = suspiciousEditors.some(e => (metadata.software || "").toLowerCase().includes(e));
      if (isSuspicious) {
        updateStep("metadata", { status: "warning", detail: `Edited with: ${metadata.software}` });
      } else {
        updateStep("metadata", { status: "passed", detail: metadata.software ? `Creator: ${metadata.software}` : "No suspicious editors detected" });
      }
    } else {
      updateStep("metadata", { status: "passed", detail: "No suspicious metadata found" });
    }
    setProgress(40);

    // Step 5: PDF structure
    updateStep("pdf", { status: "running" });
    if (file.type === "application/pdf" && metadata.pdfInfo) {
      const issues: string[] = [];
      if (metadata.pdfInfo.hasIncrementalSaves) issues.push("incremental saves");
      if (metadata.pdfInfo.hasAnnotations) issues.push("annotation layers");
      if (metadata.pdfInfo.hasFormFields) issues.push("form fields");

      if (issues.length > 0 && metadata.pdfInfo.hasIncrementalSaves) {
        updateStep("pdf", { status: "warning", detail: `Detected: ${issues.join(", ")}` });
      } else if (issues.length > 0) {
        updateStep("pdf", { status: "passed", detail: `Found: ${issues.join(", ")}` });
      } else {
        updateStep("pdf", { status: "passed", detail: "Clean PDF structure" });
      }
    } else {
      updateStep("pdf", { status: "skipped", detail: "Not a PDF file" });
    }
    setProgress(50);

    // Step 6 & 7: Server-side verification (hash check, duplicates, AI)
    updateStep("duplicate", { status: "running" });
    updateStep("ai", { status: "running" });

    let base64Preview: string | null = null;
    try {
      base64Preview = await generateBase64Preview(file);
    } catch {
      // Preview generation failed, AI analysis will be skipped
    }

    try {
      const { data: verifyData, error: verifyError } = await supabase.functions.invoke("verify-document", {
        body: {
          sha256Hash,
          fileName: safeName,
          fileSize: file.size,
          mimeType: file.type,
          metadata: {
            ...metadata,
            base64Preview,
          },
        },
      });

      setProgress(70);

      if (verifyError) {
        console.error("Verification error:", verifyError);
        updateStep("duplicate", { status: "skipped", detail: "Verification service unavailable" });
        updateStep("ai", { status: "skipped", detail: "Verification service unavailable" });
      } else if (verifyData) {
        // Hash check
        if (verifyData.results?.hashCheck?.passed === false) {
          updateStep("hash", { status: "failed", detail: verifyData.results.hashCheck.reason });
          blocked = true;
        }

        // Duplicate detection
        if (verifyData.results?.duplicateCheck?.passed === false) {
          updateStep("duplicate", { status: "failed", detail: verifyData.results.duplicateCheck.reason });
          blocked = true;
        } else {
          updateStep("duplicate", { status: "passed", detail: "No suspicious duplicates found" });
        }

        // AI analysis
        if (verifyData.results?.aiAnalysis) {
          const ai = verifyData.results.aiAnalysis;
          if (ai.note) {
            updateStep("ai", { status: "skipped", detail: ai.note });
          } else if (ai.passed === false) {
            updateStep("ai", {
              status: "warning",
              detail: `Confidence: ${ai.confidence}% — ${ai.summary || "Potential issues detected"}`,
            });
          } else {
            updateStep("ai", {
              status: "passed",
              detail: ai.confidence
                ? `Confidence: ${ai.confidence}% — ${ai.summary || "Document appears authentic"}`
                : "Document appears authentic",
            });
          }
        }

        // Server-side metadata check
        if (verifyData.results?.metadataCheck?.passed === false) {
          updateStep("metadata", {
            status: "warning",
            detail: verifyData.results.metadataCheck.reason,
          });
        }

        if (blocked) {
          await flagAccountAsFraudulent(
            verifyData.criticalFailures?.map((f: any) => f.reason).join("; ") || "Failed verification",
            file.name
          );
          toast({
            variant: "destructive",
            title: "⚠️ Document Rejected",
            description: "This document failed verification checks. Your account has been flagged.",
          });
          setUploadStatus("error");
          setUploading(false);
          return;
        }
      }
    } catch (err) {
      console.error("Verification service error:", err);
      updateStep("duplicate", { status: "skipped", detail: "Service unavailable" });
      updateStep("ai", { status: "skipped", detail: "Service unavailable" });
    }

    // Proceed with upload
    setUploadStatus("encrypting");
    for (let i = 70; i <= 85; i++) {
      await new Promise(r => setTimeout(r, 15));
      setProgress(i);
    }

    setUploadStatus("uploading");

    try {
      const fileExt = file.name.split(".").pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
      const filePath = `${user.id}/${fileName}`;

      // E2E Encrypt the file client-side before upload
      const fileBuffer = await file.arrayBuffer();
      const { encrypted, iv } = await encryptFile(fileBuffer);
      const encryptedBlob = new Blob([encrypted], { type: "application/octet-stream" });

      const { error: uploadError } = await supabase.storage
        .from("documents")
        .upload(filePath, encryptedBlob);

      if (uploadError) throw uploadError;

      for (let i = 85; i <= 95; i++) {
        await new Promise(r => setTimeout(r, 10));
        setProgress(i);
      }

      const { error: dbError } = await supabase.from("documents").insert({
        user_id: user.id,
        file_name: file.name,
        file_path: filePath,
        file_size: file.size,
        mime_type: file.type,
        source: "upload",
        encrypted_iv: iv,
      });

      if (dbError) throw dbError;

      setProgress(100);
      setUploadStatus("success");
      toast({
        title: "Document Secured",
        description: `${file.name} has been verified, encrypted, and stored in your Sovereign Sector.`,
      });

      fetchDocumentCount();

      setTimeout(() => {
        onUploadComplete();
        onClose();
        resetState();
      }, 2000);
    } catch (error) {
      console.error("Upload error:", error);
      setUploadStatus("error");
      toast({ variant: "destructive", title: "Upload Failed", description: "Unable to secure document. Please try again." });
    } finally {
      setUploading(false);
    }
  };

  const resetState = () => {
    setProgress(0);
    setUploadStatus("idle");
    setUploading(false);
    setVerificationSteps([]);
  };

  if (!isOpen) return null;

  const stepIcon = (status: VerificationStep["status"]) => {
    switch (status) {
      case "passed": return <CheckCircle2 className="text-green-500" size={16} />;
      case "failed": return <AlertCircle className="text-red-500" size={16} />;
      case "warning": return <ShieldAlert className="text-yellow-500" size={16} />;
      case "running": return <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: "linear" }}><Search className="text-primary" size={16} /></motion.div>;
      case "skipped": return <X className="text-muted-foreground" size={16} />;
      default: return <div className="w-4 h-4 rounded-full border border-muted-foreground/30" />;
    }
  };

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
          className="w-full max-w-lg cyber-border rounded-2xl bg-card p-8 max-h-[90vh] overflow-y-auto"
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
                <p className="text-sm text-muted-foreground font-mono">7-Layer Verification</p>
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
                dragActive ? "border-primary bg-primary/10" : "border-border hover:border-primary/50"
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

          {/* Verification Steps */}
          {uploadStatus === "verifying" && verificationSteps.length > 0 && (
            <div className="space-y-3 mb-4">
              <div className="flex items-center gap-2 mb-4">
                <Brain className="text-primary" size={20} />
                <h3 className="font-display font-bold text-foreground">Multi-Layer Verification</h3>
              </div>
              {verificationSteps.map((step) => (
                <motion.div
                  key={step.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  className={`flex items-start gap-3 p-3 rounded-lg border ${
                    step.status === "failed" ? "border-red-500/30 bg-red-500/5" :
                    step.status === "warning" ? "border-yellow-500/30 bg-yellow-500/5" :
                    step.status === "passed" ? "border-green-500/30 bg-green-500/5" :
                    "border-border bg-muted/20"
                  }`}
                >
                  <div className="mt-0.5">{stepIcon(step.status)}</div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground">{step.label}</p>
                    {step.detail && (
                      <p className={`text-xs mt-0.5 ${
                        step.status === "failed" ? "text-red-400" :
                        step.status === "warning" ? "text-yellow-400" :
                        "text-muted-foreground"
                      }`}>
                        {step.detail}
                      </p>
                    )}
                  </div>
                </motion.div>
              ))}
            </div>
          )}

          {/* Progress States */}
          {(uploadStatus === "encrypting" || uploadStatus === "uploading" || uploadStatus === "success" || uploadStatus === "error") && (
            <div className="space-y-6">
              {/* Show compact verification results */}
              {verificationSteps.length > 0 && (
                <div className="space-y-1.5 mb-4">
                  <p className="text-xs font-mono text-muted-foreground mb-2">Verification Results:</p>
                  {verificationSteps.map(step => (
                    <div key={step.id} className="flex items-center gap-2">
                      {stepIcon(step.status)}
                      <span className="text-xs text-muted-foreground">{step.label}</span>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex items-center gap-4">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                  uploadStatus === "success" ? "bg-green-500/20 border border-green-500/30" :
                  uploadStatus === "error" ? "bg-red-500/20 border border-red-500/30" :
                  "bg-primary/10 border border-primary/30"
                }`}>
                  {uploadStatus === "success" ? <CheckCircle2 className="text-green-500" size={24} /> :
                   uploadStatus === "error" ? <AlertCircle className="text-red-500" size={24} /> :
                   <FileText className="text-primary" size={24} />}
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
                    {uploadStatus === "success" && "Verified, encrypted, and stored"}
                    {uploadStatus === "error" && "Please try again"}
                  </p>
                </div>
              </div>

              {(uploadStatus === "encrypting" || uploadStatus === "uploading") && (
                <Progress value={progress} className="h-2" />
              )}

              {uploadStatus === "error" && (
                <Button onClick={resetState} className="w-full btn-gradient font-rajdhani font-bold text-primary-foreground">
                  Try Again
                </Button>
              )}
            </div>
          )}

          {/* Security Note */}
          <div className="mt-6 p-4 rounded-xl bg-muted/30 border border-border">
            <p className="text-xs text-muted-foreground font-mono flex items-center gap-2">
              <Fingerprint size={12} className="text-primary" />
              7-layer verification: signature check, content scan, SHA-256 fingerprinting, EXIF analysis, structure validation, duplicate detection, AI authenticity analysis.
            </p>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default DocumentUpload;
