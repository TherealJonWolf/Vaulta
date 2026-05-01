import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { Ban, RotateCcw, Search } from "lucide-react";

interface BannedRow {
  id: string;
  email: string;
  reason: string | null;
  blacklisted_at: string;
  associated_user_id: string | null;
}

export const BannedAccountsPanel = () => {
  const { toast } = useToast();
  const [rows, setRows] = useState<BannedRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("");
  const [manualEmail, setManualEmail] = useState("");
  const [working, setWorking] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("blacklisted_emails")
      .select("id, email, reason, blacklisted_at, associated_user_id")
      .order("blacklisted_at", { ascending: false })
      .limit(500);
    if (error) {
      toast({ title: "Failed to load banned accounts", description: error.message, variant: "destructive" });
    } else {
      setRows((data ?? []) as BannedRow[]);
    }
    setLoading(false);
  }, [toast]);

  useEffect(() => { load(); }, [load]);

  const reinstate = async (row: BannedRow) => {
    if (!confirm(`Reinstate ${row.email}? They will be able to sign in and upload again.`)) return;
    setWorking(row.id);
    const { data, error } = await supabase.functions.invoke("admin-unban-account", {
      body: { email: row.email, reason: "Admin reinstatement via dashboard" },
    });
    setWorking(null);
    if (error || (data as any)?.error) {
      toast({
        title: "Reinstatement failed",
        description: error?.message ?? (data as any)?.error ?? "Unknown error",
        variant: "destructive",
      });
      return;
    }
    toast({ title: "Account reinstated", description: row.email });
    setRows((prev) => prev.filter((r) => r.id !== row.id));
  };

  const reinstateByEmail = async () => {
    const email = manualEmail.trim().toLowerCase();
    if (!email) return;
    if (!confirm(`Clear all ban states for ${email}?`)) return;
    setWorking("manual");
    const { data, error } = await supabase.functions.invoke("admin-unban-account", {
      body: { email, reason: "Admin reinstatement by email via dashboard" },
    });
    setWorking(null);
    if (error || (data as any)?.error) {
      toast({
        title: "Reinstatement failed",
        description: error?.message ?? (data as any)?.error ?? "Unknown error",
        variant: "destructive",
      });
      return;
    }
    toast({ title: "Account reinstated", description: email });
    setManualEmail("");
    setRows((prev) => prev.filter((r) => r.email.toLowerCase() !== email));
    load();
  };

  const filtered = rows.filter((r) =>
    !filter || r.email.toLowerCase().includes(filter.toLowerCase()),
  );

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-4">
        <CardTitle className="font-mono text-sm flex items-center gap-2">
          <Ban size={14} /> BANNED ACCOUNTS ({rows.length})
        </CardTitle>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Filter by email…"
              className="pl-7 h-8 w-56 text-xs font-mono"
            />
          </div>
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            Refresh
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="text-xs text-muted-foreground font-mono">Loading…</p>
        ) : filtered.length === 0 ? (
          <p className="text-xs text-muted-foreground font-mono">No banned accounts match.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="font-mono text-[11px]">EMAIL</TableHead>
                <TableHead className="font-mono text-[11px]">REASON</TableHead>
                <TableHead className="font-mono text-[11px]">BANNED AT</TableHead>
                <TableHead className="font-mono text-[11px] text-right">ACTION</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="font-mono text-xs">{row.email}</TableCell>
                  <TableCell className="text-xs max-w-md truncate" title={row.reason ?? ""}>
                    {row.reason ?? "—"}
                  </TableCell>
                  <TableCell className="font-mono text-[11px] text-muted-foreground">
                    {new Date(row.blacklisted_at).toLocaleString()}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => reinstate(row)}
                      disabled={working === row.id}
                      className="gap-1.5"
                    >
                      <RotateCcw size={12} />
                      {working === row.id ? "Reinstating…" : "Reinstate"}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
        <p className="text-[10px] text-muted-foreground font-mono mt-3">
          Reinstating removes the email from the blacklist, unlocks the linked profile, and writes an
          <code className="mx-1">account_reinstated</code> entry to the security audit log.
        </p>
      </CardContent>
    </Card>
  );
};