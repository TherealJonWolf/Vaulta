import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertTriangle, Plus, Eye, CheckCircle2, Clock, XCircle, Shield } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface Incident {
  id: string;
  title: string;
  description: string | null;
  severity: string;
  status: string;
  category: string;
  created_by: string;
  assigned_to: string | null;
  resolved_at: string | null;
  resolved_by: string | null;
  resolution_notes: string | null;
  metadata: any;
  created_at: string;
  updated_at: string;
}

interface IncidentEvent {
  id: string;
  incident_id: string;
  event_type: string;
  event_source: string;
  source_id: string | null;
  user_id: string | null;
  ip_address: string | null;
  device_info: string | null;
  severity: string;
  title: string;
  detail: string | null;
  metadata: any;
  occurred_at: string;
}

type SeverityFilter = "all" | "critical" | "high" | "medium" | "low";
type StatusFilter = "all" | "open" | "investigating" | "resolved" | "closed";

const SEVERITY_COLORS: Record<string, string> = {
  critical: "bg-destructive/15 text-destructive border-destructive/30",
  high: "bg-[hsl(var(--warning-amber))]/15 text-[hsl(var(--warning-amber))] border-[hsl(var(--warning-amber))]/30",
  medium: "bg-secondary text-secondary-foreground",
  low: "bg-muted text-muted-foreground",
};

const STATUS_ICONS: Record<string, React.ReactNode> = {
  open: <AlertTriangle size={14} className="text-destructive" />,
  investigating: <Eye size={14} className="text-[hsl(var(--warning-amber))]" />,
  resolved: <CheckCircle2 size={14} className="text-[hsl(var(--secure-green))]" />,
  closed: <XCircle size={14} className="text-muted-foreground" />,
};

interface IncidentQueueProps {
  profiles: Array<{ user_id: string; email: string; full_name: string | null }>;
}

export const IncidentQueue = ({ profiles }: IncidentQueueProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [selectedIncident, setSelectedIncident] = useState<Incident | null>(null);
  const [incidentEvents, setIncidentEvents] = useState<IncidentEvent[]>([]);
  const [severityFilter, setSeverityFilter] = useState<SeverityFilter>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [timeRange, setTimeRange] = useState<string>("7d");
  const [createOpen, setCreateOpen] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newSeverity, setNewSeverity] = useState("medium");
  const [newCategory, setNewCategory] = useState("general");

  const getEmail = (userId: string) => {
    const p = profiles.find(pr => pr.user_id === userId);
    return p?.email ?? userId.substring(0, 8) + "…";
  };

  const getTimeRangeDate = () => {
    const now = new Date();
    switch (timeRange) {
      case "24h": return new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
      case "7d": return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
      case "30d": return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
      default: return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
    }
  };

  const fetchIncidents = useCallback(async () => {
    let query = (supabase.from("security_incidents") as any)
      .select("*")
      .gte("created_at", getTimeRangeDate())
      .order("created_at", { ascending: false })
      .limit(100);

    if (severityFilter !== "all") query = query.eq("severity", severityFilter);
    if (statusFilter !== "all") query = query.eq("status", statusFilter);

    const { data } = await query;
    if (data) setIncidents(data);
  }, [severityFilter, statusFilter, timeRange]);

  useEffect(() => { fetchIncidents(); }, [fetchIncidents]);

  // Realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel("soc-incidents")
      .on("postgres_changes", { event: "*", schema: "public", table: "security_incidents" }, () => {
        fetchIncidents();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchIncidents]);

  const fetchIncidentEvents = async (incidentId: string) => {
    const { data } = await (supabase.from("incident_events") as any)
      .select("*")
      .eq("incident_id", incidentId)
      .order("occurred_at", { ascending: false });
    if (data) setIncidentEvents(data);
  };

  const handleViewIncident = async (incident: Incident) => {
    setSelectedIncident(incident);
    await fetchIncidentEvents(incident.id);
  };

  const handleCreateIncident = async () => {
    if (!newTitle.trim() || !user) return;
    const { error } = await (supabase.from("security_incidents") as any).insert({
      title: newTitle.trim(),
      description: newDesc.trim() || null,
      severity: newSeverity,
      category: newCategory,
      created_by: user.id,
    });
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Incident created" });
      setCreateOpen(false);
      setNewTitle("");
      setNewDesc("");
      fetchIncidents();
    }
  };

  const handleUpdateStatus = async (incidentId: string, newStatus: string) => {
    if (!user) return;
    const updates: any = { status: newStatus, updated_at: new Date().toISOString() };
    if (newStatus === "resolved" || newStatus === "closed") {
      updates.resolved_at = new Date().toISOString();
      updates.resolved_by = user.id;
    }
    await (supabase.from("security_incidents") as any).update(updates).eq("id", incidentId);
    fetchIncidents();
    if (selectedIncident?.id === incidentId) {
      setSelectedIncident(prev => prev ? { ...prev, ...updates } : null);
    }
  };

  const openCount = incidents.filter(i => i.status === "open").length;
  const investigatingCount = incidents.filter(i => i.status === "investigating").length;

  if (selectedIncident) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" className="font-mono text-xs gap-1" onClick={() => setSelectedIncident(null)}>
          ← BACK TO QUEUE
        </Button>
        <Card className="cyber-border">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {STATUS_ICONS[selectedIncident.status]}
                <div>
                  <CardTitle className="font-display text-lg">{selectedIncident.title}</CardTitle>
                  <p className="text-muted-foreground font-mono text-[10px]">
                    Created {new Date(selectedIncident.created_at).toLocaleString()} by {getEmail(selectedIncident.created_by)}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge className={`font-mono text-[10px] ${SEVERITY_COLORS[selectedIncident.severity] || ""}`}>
                  {selectedIncident.severity.toUpperCase()}
                </Badge>
                <Select value={selectedIncident.status} onValueChange={(v) => handleUpdateStatus(selectedIncident.id, v)}>
                  <SelectTrigger className="w-[140px] font-mono text-xs h-8">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="open">Open</SelectItem>
                    <SelectItem value="investigating">Investigating</SelectItem>
                    <SelectItem value="resolved">Resolved</SelectItem>
                    <SelectItem value="closed">Closed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {selectedIncident.description && (
              <p className="text-sm text-muted-foreground">{selectedIncident.description}</p>
            )}
            {selectedIncident.resolved_at && (
              <p className="font-mono text-xs text-[hsl(var(--secure-green))]">
                Resolved {new Date(selectedIncident.resolved_at).toLocaleString()}
                {selectedIncident.resolved_by && ` by ${getEmail(selectedIncident.resolved_by)}`}
              </p>
            )}

            <div>
              <h3 className="font-mono text-xs font-bold mb-3 text-muted-foreground">EVENT TIMELINE</h3>
              {incidentEvents.length === 0 ? (
                <p className="text-muted-foreground font-mono text-xs text-center py-4">No events linked to this incident</p>
              ) : (
                <div className="space-y-2">
                  {incidentEvents.map((evt) => (
                    <div key={evt.id} className="flex items-start gap-3 p-3 rounded-lg border border-border bg-card">
                      <div className="shrink-0 mt-0.5">
                        <Badge className={`font-mono text-[10px] ${SEVERITY_COLORS[evt.severity] || ""}`}>
                          {evt.severity.toUpperCase()}
                        </Badge>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-mono text-xs font-semibold">{evt.title}</p>
                        {evt.detail && <p className="font-mono text-[11px] text-muted-foreground">{evt.detail}</p>}
                        <div className="flex flex-wrap gap-3 mt-1 text-[10px] font-mono text-muted-foreground">
                          <span>Source: {evt.event_source}</span>
                          {evt.user_id && <span>User: {getEmail(evt.user_id)}</span>}
                          {evt.ip_address && <span>IP: {evt.ip_address}</span>}
                          {evt.device_info && <span>Device: {evt.device_info}</span>}
                        </div>
                      </div>
                      <span className="font-mono text-[10px] text-muted-foreground shrink-0 flex items-center gap-1">
                        <Clock size={10} />
                        {new Date(evt.occurred_at).toLocaleString()}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <Card className="cyber-border">
      <CardHeader>
        <div className="flex items-center justify-between flex-wrap gap-2">
          <CardTitle className="font-display text-lg gradient-text flex items-center gap-2">
            <Shield size={18} />
            INCIDENT QUEUE
            {openCount > 0 && (
              <span className="ml-1 px-1.5 py-0.5 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold">{openCount}</span>
            )}
            {investigatingCount > 0 && (
              <span className="ml-1 px-1.5 py-0.5 rounded-full bg-[hsl(var(--warning-amber))] text-black text-[10px] font-bold">{investigatingCount}</span>
            )}
          </CardTitle>
          <div className="flex items-center gap-2 flex-wrap">
            <select value={timeRange} onChange={(e) => setTimeRange(e.target.value)}
              className="bg-card border border-border rounded px-2 py-1 font-mono text-xs text-foreground">
              <option value="24h">Last 24h</option>
              <option value="7d">Last 7 days</option>
              <option value="30d">Last 30 days</option>
            </select>
            <select value={severityFilter} onChange={(e) => setSeverityFilter(e.target.value as SeverityFilter)}
              className="bg-card border border-border rounded px-2 py-1 font-mono text-xs text-foreground">
              <option value="all">All Severity</option>
              <option value="critical">Critical</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
              className="bg-card border border-border rounded px-2 py-1 font-mono text-xs text-foreground">
              <option value="all">All Status</option>
              <option value="open">Open</option>
              <option value="investigating">Investigating</option>
              <option value="resolved">Resolved</option>
              <option value="closed">Closed</option>
            </select>
            <Dialog open={createOpen} onOpenChange={setCreateOpen}>
              <DialogTrigger asChild>
                <Button size="sm" className="font-mono text-xs gap-1">
                  <Plus size={12} /> NEW INCIDENT
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle className="font-display">Create Security Incident</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <label className="font-mono text-xs text-muted-foreground mb-1 block">Title</label>
                    <Input value={newTitle} onChange={(e) => setNewTitle(e.target.value)} placeholder="Brief incident title" className="font-mono text-sm" />
                  </div>
                  <div>
                    <label className="font-mono text-xs text-muted-foreground mb-1 block">Description</label>
                    <Textarea value={newDesc} onChange={(e) => setNewDesc(e.target.value)} placeholder="Detailed description..." className="font-mono text-sm" />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="font-mono text-xs text-muted-foreground mb-1 block">Severity</label>
                      <Select value={newSeverity} onValueChange={setNewSeverity}>
                        <SelectTrigger className="font-mono text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="critical">Critical</SelectItem>
                          <SelectItem value="high">High</SelectItem>
                          <SelectItem value="medium">Medium</SelectItem>
                          <SelectItem value="low">Low</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <label className="font-mono text-xs text-muted-foreground mb-1 block">Category</label>
                      <Select value={newCategory} onValueChange={setNewCategory}>
                        <SelectTrigger className="font-mono text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="fraud">Fraud</SelectItem>
                          <SelectItem value="auth">Authentication</SelectItem>
                          <SelectItem value="upload">Upload Security</SelectItem>
                          <SelectItem value="trust">Trust Violation</SelectItem>
                          <SelectItem value="system">System</SelectItem>
                          <SelectItem value="general">General</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <Button onClick={handleCreateIncident} disabled={!newTitle.trim()} className="w-full font-mono text-xs">
                    CREATE INCIDENT
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {incidents.length === 0 ? (
          <div className="text-center py-12">
            <CheckCircle2 size={48} className="mx-auto text-[hsl(var(--secure-green))] mb-3 opacity-50" />
            <p className="text-muted-foreground font-mono text-sm">NO INCIDENTS IN SELECTED RANGE</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="font-mono text-xs">STATUS</TableHead>
                <TableHead className="font-mono text-xs">SEVERITY</TableHead>
                <TableHead className="font-mono text-xs">TITLE</TableHead>
                <TableHead className="font-mono text-xs">CATEGORY</TableHead>
                <TableHead className="font-mono text-xs">CREATED</TableHead>
                <TableHead className="font-mono text-xs">ACTION</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <AnimatePresence>
                {incidents.map((inc) => (
                  <motion.tr key={inc.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                    className="border-b border-border">
                    <TableCell>
                      <div className="flex items-center gap-1.5">
                        {STATUS_ICONS[inc.status]}
                        <span className="font-mono text-[10px] uppercase">{inc.status}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge className={`font-mono text-[10px] ${SEVERITY_COLORS[inc.severity] || ""}`}>
                        {inc.severity.toUpperCase()}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-mono text-xs max-w-[250px] truncate">{inc.title}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="font-mono text-[10px] uppercase">{inc.category}</Badge>
                    </TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {new Date(inc.created_at).toLocaleString()}
                    </TableCell>
                    <TableCell>
                      <Button size="sm" variant="outline" className="font-mono text-xs gap-1" onClick={() => handleViewIncident(inc)}>
                        <Eye size={12} /> VIEW
                      </Button>
                    </TableCell>
                  </motion.tr>
                ))}
              </AnimatePresence>
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
};
