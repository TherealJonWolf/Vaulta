import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Bell, CheckCircle2, Clock, Mail, MailCheck, MailX } from "lucide-react";

interface AlertRecord {
  id: string;
  alert_type: string;
  severity: string;
  category: string;
  title: string;
  detail: string | null;
  delivery_channel: string;
  delivery_status: string;
  delivered_at: string | null;
  acknowledged_at: string | null;
  acknowledged_by: string | null;
  recipient_admin_id: string;
  incident_id: string | null;
  created_at: string;
}

const SEVERITY_COLORS: Record<string, string> = {
  critical: "bg-destructive/15 text-destructive border-destructive/30",
  high: "bg-[hsl(var(--warning-amber))]/15 text-[hsl(var(--warning-amber))] border-[hsl(var(--warning-amber))]/30",
  medium: "bg-secondary text-secondary-foreground",
  low: "bg-muted text-muted-foreground",
  info: "bg-muted text-muted-foreground",
};

const DELIVERY_ICONS: Record<string, React.ReactNode> = {
  pending: <Mail size={14} className="text-muted-foreground" />,
  sent: <MailCheck size={14} className="text-[hsl(var(--secure-green))]" />,
  failed: <MailX size={14} className="text-destructive" />,
  delivered: <MailCheck size={14} className="text-primary" />,
};

export const AlertHistory = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [alerts, setAlerts] = useState<AlertRecord[]>([]);
  const [timeRange, setTimeRange] = useState("7d");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [severityFilter, setSeverityFilter] = useState("all");

  const getTimeRangeDate = () => {
    const now = new Date();
    switch (timeRange) {
      case "24h": return new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
      case "7d": return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
      case "30d": return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
      case "90d": return new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000).toISOString();
      default: return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
    }
  };

  const fetchAlerts = useCallback(async () => {
    let query = (supabase.from("alert_history") as any)
      .select("*")
      .gte("created_at", getTimeRangeDate())
      .order("created_at", { ascending: false })
      .limit(200);

    if (categoryFilter !== "all") query = query.eq("category", categoryFilter);
    if (severityFilter !== "all") query = query.eq("severity", severityFilter);

    const { data } = await query;
    if (data) setAlerts(data);
  }, [timeRange, categoryFilter, severityFilter]);

  useEffect(() => { fetchAlerts(); }, [fetchAlerts]);

  // Realtime
  useEffect(() => {
    const channel = supabase
      .channel("soc-alerts")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "alert_history" }, () => {
        fetchAlerts();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchAlerts]);

  const handleAcknowledge = async (alertId: string) => {
    if (!user) return;
    await (supabase.from("alert_history") as any)
      .update({ acknowledged_at: new Date().toISOString(), acknowledged_by: user.id })
      .eq("id", alertId);
    fetchAlerts();
    toast({ title: "Alert acknowledged" });
  };

  const unackedCount = alerts.filter(a => !a.acknowledged_at).length;
  const sentCount = alerts.filter(a => a.delivery_status === "sent" || a.delivery_status === "delivered").length;
  const failedCount = alerts.filter(a => a.delivery_status === "failed").length;

  return (
    <Card className="cyber-border">
      <CardHeader>
        <div className="flex items-center justify-between flex-wrap gap-2">
          <CardTitle className="font-display text-lg gradient-text flex items-center gap-2">
            <Bell size={18} />
            ALERT HISTORY & DELIVERY
            {unackedCount > 0 && (
              <span className="ml-1 px-1.5 py-0.5 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold">{unackedCount}</span>
            )}
          </CardTitle>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-2 text-[10px] font-mono">
              <span className="text-[hsl(var(--secure-green))]">✓ {sentCount} sent</span>
              {failedCount > 0 && <span className="text-destructive">✗ {failedCount} failed</span>}
            </div>
            <select value={timeRange} onChange={(e) => setTimeRange(e.target.value)}
              className="bg-card border border-border rounded px-2 py-1 font-mono text-xs text-foreground">
              <option value="24h">Last 24h</option>
              <option value="7d">Last 7 days</option>
              <option value="30d">Last 30 days</option>
              <option value="90d">Last 90 days</option>
            </select>
            <select value={severityFilter} onChange={(e) => setSeverityFilter(e.target.value)}
              className="bg-card border border-border rounded px-2 py-1 font-mono text-xs text-foreground">
              <option value="all">All Severity</option>
              <option value="critical">Critical</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
            </select>
            <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}
              className="bg-card border border-border rounded px-2 py-1 font-mono text-xs text-foreground">
              <option value="all">All Categories</option>
              <option value="fraud">Fraud</option>
              <option value="auth">Auth</option>
              <option value="upload">Upload</option>
              <option value="trust">Trust</option>
              <option value="system">System</option>
              <option value="digest">Daily Digest</option>
            </select>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {alerts.length === 0 ? (
          <div className="text-center py-12">
            <CheckCircle2 size={48} className="mx-auto text-[hsl(var(--secure-green))] mb-3 opacity-50" />
            <p className="text-muted-foreground font-mono text-sm">NO ALERTS IN SELECTED RANGE</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="font-mono text-xs">SEVERITY</TableHead>
                <TableHead className="font-mono text-xs">CATEGORY</TableHead>
                <TableHead className="font-mono text-xs">TITLE</TableHead>
                <TableHead className="font-mono text-xs">DELIVERY</TableHead>
                <TableHead className="font-mono text-xs">STATUS</TableHead>
                <TableHead className="font-mono text-xs">TIME</TableHead>
                <TableHead className="font-mono text-xs">ACTION</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {alerts.map((alert) => (
                <TableRow key={alert.id} className={!alert.acknowledged_at ? "bg-card" : "opacity-60"}>
                  <TableCell>
                    <Badge className={`font-mono text-[10px] ${SEVERITY_COLORS[alert.severity] || ""}`}>
                      {alert.severity.toUpperCase()}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="font-mono text-[10px] uppercase">{alert.category}</Badge>
                  </TableCell>
                  <TableCell className="font-mono text-xs max-w-[250px]">
                    <div className="truncate font-semibold">{alert.title}</div>
                    {alert.detail && <div className="truncate text-muted-foreground text-[10px]">{alert.detail}</div>}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1.5">
                      {DELIVERY_ICONS[alert.delivery_status]}
                      <span className="font-mono text-[10px] uppercase">{alert.delivery_status}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    {alert.acknowledged_at ? (
                      <div className="flex items-center gap-1 text-[hsl(var(--secure-green))]">
                        <CheckCircle2 size={12} />
                        <span className="font-mono text-[10px]">ACK</span>
                      </div>
                    ) : (
                      <span className="font-mono text-[10px] text-muted-foreground">PENDING</span>
                    )}
                  </TableCell>
                  <TableCell className="font-mono text-[10px] text-muted-foreground flex items-center gap-1">
                    <Clock size={10} />
                    {new Date(alert.created_at).toLocaleString()}
                  </TableCell>
                  <TableCell>
                    {!alert.acknowledged_at && (
                      <Button size="sm" variant="outline" className="font-mono text-[10px] h-7" onClick={() => handleAcknowledge(alert.id)}>
                        ACK
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
};
