import { useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { Upload, FileText, AlertTriangle, CheckCircle2, Play, FlaskConical } from "lucide-react";

interface RowResult {
  row: number;
  email: string;
  reason: string | null;
  status: "valid" | "invalid_email" | "duplicate_in_csv" | "already_banned" | "inserted" | "error";
  message?: string;
  associated_user_id?: string | null;
}

interface ImportResponse {
  dryRun: boolean;
  summary: {
    total_rows: number;
    valid: number;
    invalid_email: number;
    duplicate_in_csv: number;
    already_banned: number;
    inserted: number;
    errors: number;
  };
  results: RowResult[];
  error?: string;
}

const statusVariant: Record<RowResult["status"], { label: string; color: string }> = {
  valid: { label: "WILL BAN", color: "bg-emerald-500/10 text-emerald-600 border-emerald-500/30" },
  inserted: { label: "BANNED", color: "bg-emerald-500/10 text-emerald-600 border-emerald-500/30" },
  invalid_email: { label: "INVALID", color: "bg-destructive/10 text-destructive border-destructive/30" },
  duplicate_in_csv: { label: "DUPLICATE", color: "bg-amber-500/10 text-amber-600 border-amber-500/30" },
  already_banned: { label: "ALREADY BANNED", color: "bg-muted text-muted-foreground border-border" },
  error: { label: "ERROR", color: "bg-destructive/10 text-destructive border-destructive/30" },
};

export const BulkBanImportPanel = ({ onImported }: { onImported?: () => void }) => {
  const { toast } = useToast();
  const [csv, setCsv] = useState("");
  const [defaultReason, setDefaultReason] = useState("Bulk import — admin action");
  const [response, setResponse] = useState<ImportResponse | null>(null);
  const [running, setRunning] = useState<"dry" | "real" | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const onFile = async (file: File) => {
    if (file.size > 1_000_000) {
      toast({ title: "File too large", description: "CSV must be under 1MB.", variant: "destructive" });
      return;
    }
    const text = await file.text();
    setCsv(text);
    setResponse(null);
  };

  const run = async (dryRun: boolean) => {
    if (!csv.trim()) {
      toast({ title: "No CSV provided", description: "Paste rows or upload a file.", variant: "destructive" });
      return;
    }
    setRunning(dryRun ? "dry" : "real");
    const { data, error } = await supabase.functions.invoke("admin-bulk-ban-emails", {
      body: { csv, dryRun, defaultReason },
    });
    setRunning(null);
    if (error || (data as any)?.error) {
      toast({
        title: dryRun ? "Preview failed" : "Import failed",
        description: error?.message ?? (data as any)?.error ?? "Unknown error",
        variant: "destructive",
      });
      return;
    }
    setResponse(data as ImportResponse);
    if (!dryRun) {
      toast({
        title: "Import complete",
        description: `${(data as ImportResponse).summary.inserted} accounts banned.`,
      });
      onImported?.();
    }
  };

  const summary = response?.summary;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-mono text-sm flex items-center gap-2">
          <Upload size={14} /> BULK IMPORT BANNED EMAILS
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <p className="text-[11px] font-mono text-muted-foreground">
            CSV format: <code>email,reason</code> (header optional). Reason column is optional and falls
            back to the default below. Max 5000 rows / 1MB.
          </p>
          <div className="flex items-center gap-2">
            <Input
              ref={fileRef}
              type="file"
              accept=".csv,text/csv,text/plain"
              onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])}
              className="h-8 text-xs font-mono max-w-xs"
            />
            <Input
              value={defaultReason}
              onChange={(e) => setDefaultReason(e.target.value)}
              placeholder="Default ban reason"
              className="h-8 text-xs font-mono flex-1"
            />
          </div>
          <Textarea
            value={csv}
            onChange={(e) => { setCsv(e.target.value); setResponse(null); }}
            placeholder={"email,reason\nfraud@example.com,Suspected fraud ring\nspam@example.com,"}
            className="font-mono text-xs min-h-[140px]"
          />
        </div>

        <div className="flex items-center gap-2">
          <Button
            onClick={() => run(true)}
            disabled={running !== null}
            variant="outline"
            size="sm"
            className="gap-1.5"
          >
            <FlaskConical size={12} />
            {running === "dry" ? "Validating…" : "Dry Run Preview"}
          </Button>
          <Button
            onClick={() => {
              if (!response) {
                toast({ title: "Run a dry-run first", description: "Preview the import before executing.", variant: "destructive" });
                return;
              }
              if (!summary || summary.valid === 0) {
                toast({ title: "Nothing to import", description: "No valid rows in preview.", variant: "destructive" });
                return;
              }
              if (!confirm(`Ban ${summary.valid} email(s)? This will lock any matching accounts.`)) return;
              run(false);
            }}
            disabled={running !== null || !response || (summary?.valid ?? 0) === 0}
            size="sm"
            className="gap-1.5"
            variant="destructive"
          >
            <Play size={12} />
            {running === "real" ? "Importing…" : "Execute Import"}
          </Button>
        </div>

        {summary && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 text-xs font-mono">
            <Stat label="ROWS" value={summary.total_rows} />
            <Stat label="VALID" value={summary.valid} tone="good" />
            <Stat label="INSERTED" value={summary.inserted} tone="good" />
            <Stat label="ALREADY BANNED" value={summary.already_banned} tone="muted" />
            <Stat label="DUPLICATES" value={summary.duplicate_in_csv} tone="warn" />
            <Stat label="INVALID" value={summary.invalid_email} tone="bad" />
          </div>
        )}

        {response && response.results.length > 0 && (
          <div className="border rounded-md max-h-[420px] overflow-auto">
            <Table>
              <TableHeader className="sticky top-0 bg-card">
                <TableRow>
                  <TableHead className="font-mono text-[11px] w-12">ROW</TableHead>
                  <TableHead className="font-mono text-[11px]">EMAIL</TableHead>
                  <TableHead className="font-mono text-[11px]">REASON</TableHead>
                  <TableHead className="font-mono text-[11px]">STATUS</TableHead>
                  <TableHead className="font-mono text-[11px]">LINKED USER</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {response.results.map((r, i) => {
                  const v = statusVariant[r.status];
                  return (
                    <TableRow key={`${r.row}-${i}`}>
                      <TableCell className="font-mono text-[11px] text-muted-foreground">{r.row}</TableCell>
                      <TableCell className="font-mono text-xs">{r.email || <span className="text-muted-foreground">—</span>}</TableCell>
                      <TableCell className="text-xs max-w-[260px] truncate" title={r.reason ?? ""}>{r.reason ?? "—"}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={`font-mono text-[10px] ${v.color}`}>{v.label}</Badge>
                      </TableCell>
                      <TableCell className="font-mono text-[10px] text-muted-foreground">
                        {r.associated_user_id ? r.associated_user_id.slice(0, 8) + "…" : "—"}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}

        <p className="text-[10px] text-muted-foreground font-mono flex items-start gap-1.5">
          <AlertTriangle size={11} className="mt-0.5" />
          Always run a dry-run preview first. Execute is irreversible from this panel — use the
          banned accounts list to reinstate individual emails afterwards.
        </p>
      </CardContent>
    </Card>
  );
};

const Stat = ({ label, value, tone }: { label: string; value: number; tone?: "good" | "bad" | "warn" | "muted" }) => {
  const color =
    tone === "good" ? "text-emerald-600" :
    tone === "bad" ? "text-destructive" :
    tone === "warn" ? "text-amber-600" :
    tone === "muted" ? "text-muted-foreground" : "text-foreground";
  return (
    <div className="border rounded-md px-2 py-1.5">
      <div className="text-[10px] text-muted-foreground">{label}</div>
      <div className={`text-sm font-semibold ${color}`}>{value}</div>
    </div>
  );
};