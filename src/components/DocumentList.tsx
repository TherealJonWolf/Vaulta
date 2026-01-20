import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FileText, Download, Trash2, Eye, Lock, Building2, Upload as UploadIcon, ExternalLink } from "lucide-react";
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
}

interface DocumentListProps {
  refreshTrigger: number;
}

const DocumentList = ({ refreshTrigger }: DocumentListProps) => {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewName, setPreviewName] = useState<string>("");
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

      const url = URL.createObjectURL(data);
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
        .createSignedUrl(doc.file_path, 60);

      if (error) throw error;

      setPreviewUrl(data.signedUrl);
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

              <div className="mt-4 pt-4 border-t border-border flex items-center justify-between">
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
    </>
  );
};

export default DocumentList;
