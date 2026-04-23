import { useState } from "react";
import { FileCheck2, Loader2, ShieldCheck, Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import {
  downloadTrustReportPdf,
  type TrustReportSnapshot,
} from "@/lib/trustReportPdf";

interface SuccessState {
  reportHash: string;
  snapshotId: string;
  generatedAt: string;
}

export function TrustReportButton() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState<SuccessState | null>(null);
  const [copied, setCopied] = useState(false);

  const handleGenerate = async () => {
    setLoading(true);
    setSuccess(null);
    try {
      const { data, error } = await supabase.functions.invoke(
        "generate-trust-report",
        { body: {} },
      );
      if (error) throw new Error(error.message ?? "Snapshot generation failed");
      if (!data?.ok) {
        throw new Error(data?.message ?? data?.error ?? "Snapshot rejected");
      }

      downloadTrustReportPdf({
        snapshot: data.snapshot as TrustReportSnapshot,
        report_hash: data.report_hash,
        snapshot_id: data.snapshot_id,
      });

      setSuccess({
        reportHash: data.report_hash,
        snapshotId: data.snapshot_id,
        generatedAt: data.generated_at,
      });
      toast({
        title: "Verified Trust Report generated",
        description: "Snapshot recorded and PDF downloaded.",
      });
    } catch (err) {
      toast({
        title: "Could not generate report",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const copyHash = async () => {
    if (!success) return;
    await navigator.clipboard.writeText(success.reportHash);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <>
      <Button
        onClick={handleGenerate}
        disabled={loading}
        variant="outline"
        className="gap-2"
      >
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <FileCheck2 className="h-4 w-4" />
        )}
        {loading ? "Snapshotting…" : "Download Verified Trust Report"}
      </Button>

      <Dialog open={!!success} onOpenChange={(o) => !o && setSuccess(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-primary" />
              Verified Trust Report Generated
            </DialogTitle>
            <DialogDescription>
              Your PDF has been downloaded. The snapshot is stored immutably and
              can be independently verified using the report hash below.
            </DialogDescription>
          </DialogHeader>
          {success && (
            <div className="space-y-4">
              <div className="rounded-md border bg-muted/30 p-3">
                <div className="text-xs font-semibold text-muted-foreground">
                  REPORT HASH (SHA-256)
                </div>
                <div className="mt-1 flex items-start justify-between gap-2">
                  <code className="break-all font-mono text-xs">
                    {success.reportHash}
                  </code>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={copyHash}
                    className="shrink-0"
                  >
                    {copied ? (
                      <Check className="h-3.5 w-3.5" />
                    ) : (
                      <Copy className="h-3.5 w-3.5" />
                    )}
                  </Button>
                </div>
              </div>
              <div className="rounded-md border bg-muted/30 p-3 text-xs">
                <div className="font-semibold text-muted-foreground">
                  VERIFY URL
                </div>
                <code className="mt-1 block break-all font-mono">
                  {window.location.origin}/verify/{success.reportHash}
                </code>
              </div>
              <p className="text-xs text-muted-foreground">
                Share this URL or hash with any third party. The verification
                endpoint returns only score, level, and timestamp — never
                personally identifying information.
              </p>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}