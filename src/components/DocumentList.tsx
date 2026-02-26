import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FileText, Download, Trash2, Eye, Lock, Building2, Upload as UploadIcon, ExternalLink, Languages, Loader2 } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

interface Document {
  id: string;
  file_name: string;
  file_path: string;
  file_size: number;
  mime_type: string;
  source: string;
  institution_name: string | null;
  created_at: string;
  encrypted_iv: string | null;
}

interface DocumentListProps {
  refreshTrigger: number;
  encryptFile: (fileBuffer: ArrayBuffer) => Promise<{ encrypted: ArrayBuffer; iv: string }>;
  decryptFile: (encryptedBuffer: ArrayBuffer, ivHex: string) => Promise<ArrayBuffer>;
}

const DocumentList = ({ refreshTrigger, encryptFile, decryptFile }: DocumentListProps) => {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewName, setPreviewName] = useState<string>("");
  const [translating, setTranslating] = useState<string | null>(null);
  const [translationResult, setTranslationResult] = useState<{ text: string; docName: string; lang: string } | null>(null);
  const { user } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    if (user) {
      fetchDocuments();
    }
  }, [user, refreshTrigger]);

  const fetchDocuments = async () => {
    try {
      const { data, error } = await supabase
        .from("documents")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setDocuments(data || []);
    } catch (error) {
      console.error("Error fetching documents:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Unable to fetch documents.",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async (doc: Document) => {
    try {
      const { data, error } = await supabase.storage
        .from("documents")
        .download(doc.file_path);

      if (error) throw error;

      let blob: Blob;
      if (doc.encrypted_iv) {
        const encryptedBuffer = await data.arrayBuffer();
        const decryptedBuffer = await decryptFile(encryptedBuffer, doc.encrypted_iv);
        blob = new Blob([decryptedBuffer], { type: doc.mime_type });
      } else {
        blob = data;
      }

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = doc.file_name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast({
        title: "Download Started",
        description: `${doc.file_name} is being downloaded.`,
      });
    } catch (error) {
      console.error("Download error:", error);
      toast({
        variant: "destructive",
        title: "Download Failed",
        description: "Unable to download document.",
      });
    }
  };

  const handlePreview = async (doc: Document) => {
    try {
      const { data, error } = await supabase.storage
        .from("documents")
        .download(doc.file_path);

      if (error) throw error;

      let blob: Blob;
      if (doc.encrypted_iv) {
        const encryptedBuffer = await data.arrayBuffer();
        const decryptedBuffer = await decryptFile(encryptedBuffer, doc.encrypted_iv);
        blob = new Blob([decryptedBuffer], { type: doc.mime_type });
      } else {
        blob = data;
      }

      const url = URL.createObjectURL(blob);
      setPreviewUrl(url);
      setPreviewName(doc.file_name);
    } catch (error) {
      console.error("Preview error:", error);
      toast({
        variant: "destructive",
        title: "Preview Failed",
        description: "Unable to preview document.",
      });
    }
  };

  const handleDelete = async (doc: Document) => {
    try {
      // Delete from storage
      const { error: storageError } = await supabase.storage
        .from("documents")
        .remove([doc.file_path]);

      if (storageError) throw storageError;

      // Delete from database
      const { error: dbError } = await supabase
        .from("documents")
        .delete()
        .eq("id", doc.id);

      if (dbError) throw dbError;

      setDocuments((prev) => prev.filter((d) => d.id !== doc.id));
      toast({
        title: "Document Deleted",
        description: `${doc.file_name} has been permanently removed.`,
      });
    } catch (error) {
      console.error("Delete error:", error);
      toast({
        variant: "destructive",
        title: "Delete Failed",
        description: "Unable to delete document.",
      });
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const handleTranslate = async (doc: Document, targetLanguage: string) => {
    setTranslating(doc.id);
    try {
      // Download and decrypt the document
      const { data: fileData, error: fileError } = await supabase.storage
        .from("documents")
        .download(doc.file_path);
      if (fileError) throw fileError;

      let textContent: string;
      if (doc.encrypted_iv) {
        const encryptedBuffer = await fileData.arrayBuffer();
        const decryptedBuffer = await decryptFile(encryptedBuffer, doc.encrypted_iv);
        textContent = new TextDecoder().decode(decryptedBuffer);
      } else {
        textContent = await fileData.text();
      }

      if (!textContent || textContent.length < 5) {
        toast({ variant: "destructive", title: "Cannot Translate", description: "Document content could not be extracted as text." });
        return;
      }

      const { data, error } = await supabase.functions.invoke("translate-document", {
        body: { text: textContent.substring(0, 10000), targetLanguage },
      });

      if (error) throw error;

      const langLabels: Record<string, string> = { en: "English", "fr-CA": "French Canadian", es: "Spanish" };
      setTranslationResult({ text: data.translatedText, docName: doc.file_name, lang: langLabels[targetLanguage] || targetLanguage });
    } catch (error) {
      console.error("Translation error:", error);
      toast({ variant: "destructive", title: "Translation Failed", description: "Unable to translate this document." });
    } finally {
      setTranslating(null);
    }
  };

  const getSourceIcon = (source: string) => {
    switch (source) {
      case "institution":
        return <Building2 size={14} className="text-accent" />;
      case "external":
        return <ExternalLink size={14} className="text-yellow-500" />;
      default:
        return <UploadIcon size={14} className="text-primary" />;
    }
  };

  if (loading) {
    return (
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="cyber-border rounded-xl p-6 animate-pulse"
          >
            <div className="w-12 h-12 rounded-xl bg-muted mb-4" />
            <div className="h-4 bg-muted rounded w-3/4 mb-2" />
            <div className="h-3 bg-muted rounded w-1/2" />
          </div>
        ))}
      </div>
    );
  }

  if (documents.length === 0) {
    return null;
  }

  return (
    <>
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        <AnimatePresence>
          {documents.map((doc, index) => (
            <motion.div
              key={doc.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ delay: index * 0.05 }}
              className="cyber-border rounded-xl p-6 card-hover group"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="w-12 h-12 rounded-xl bg-primary/10 border border-primary/30 flex items-center justify-center">
                  <FileText className="text-primary" size={24} />
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => handlePreview(doc)}
                  >
                    <Eye size={16} />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => handleDownload(doc)}
                  >
                    <Download size={16} />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive"
                    onClick={() => handleDelete(doc)}
                  >
                    <Trash2 size={16} />
                  </Button>
                </div>
              </div>

              <h3 className="font-display font-bold text-foreground mb-1 truncate">
                {doc.file_name}
              </h3>
              <div className="flex items-center gap-3 text-xs text-muted-foreground font-mono">
                <span>{formatFileSize(doc.file_size)}</span>
                <span>•</span>
                <span>{format(new Date(doc.created_at), "MMM d, yyyy")}</span>
              </div>

              <div className="mt-3 pt-3 border-t border-border">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    {getSourceIcon(doc.source)}
                    <span className="text-xs text-muted-foreground capitalize">
                      {doc.institution_name || doc.source}
                    </span>
                  </div>
                  <div className="flex items-center gap-1 text-xs text-primary font-mono">
                    <Lock size={10} />
                    Encrypted
                  </div>
                </div>
                <Select
                  onValueChange={(lang) => handleTranslate(doc, lang)}
                  disabled={translating === doc.id}
                >
                  <SelectTrigger className="h-8 text-xs w-full">
                    {translating === doc.id ? (
                      <span className="flex items-center gap-2"><Loader2 size={12} className="animate-spin" /> Translating...</span>
                    ) : (
                      <span className="flex items-center gap-2"><Languages size={12} /> Translate</span>
                    )}
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="en">English</SelectItem>
                    <SelectItem value="fr-CA">French Canadian</SelectItem>
                    <SelectItem value="es">Spanish</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Preview Modal */}
      <AnimatePresence>
        {previewUrl && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/90 backdrop-blur-sm z-50 flex items-center justify-center p-6"
            onClick={() => setPreviewUrl(null)}
          >
            <motion.div
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.9 }}
              className="w-full max-w-4xl max-h-[90vh] cyber-border rounded-2xl bg-card overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between p-4 border-b border-border">
                <h3 className="font-display font-bold text-foreground truncate">
                  {previewName}
                </h3>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setPreviewUrl(null)}
                >
                  Close
                </Button>
              </div>
              <div className="p-4 max-h-[calc(90vh-80px)] overflow-auto">
                {previewUrl.includes(".pdf") ? (
                  <iframe
                    src={previewUrl}
                    className="w-full h-[70vh] rounded-lg"
                    title={previewName}
                  />
                ) : (
                  <img
                    src={previewUrl}
                    alt={previewName}
                    className="max-w-full h-auto mx-auto rounded-lg"
                  />
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      {/* Translation Result Dialog */}
      <Dialog open={!!translationResult} onOpenChange={() => setTranslationResult(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle className="font-display flex items-center gap-2">
              <Languages size={18} className="text-primary" />
              {translationResult?.docName} — {translationResult?.lang}
            </DialogTitle>
          </DialogHeader>
          <div className="overflow-auto max-h-[60vh] p-4 rounded-lg bg-muted/50 border border-border">
            <pre className="whitespace-pre-wrap text-sm text-foreground font-mono leading-relaxed">
              {translationResult?.text}
            </pre>
          </div>
          <div className="flex justify-end">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                if (translationResult) {
                  navigator.clipboard.writeText(translationResult.text);
                  toast({ title: "Copied", description: "Translation copied to clipboard." });
                }
              }}
            >
              Copy Translation
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default DocumentList;
