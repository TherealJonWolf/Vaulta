import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Activity, Clock, AlertCircle, Gauge, RefreshCw, BarChart3 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface DeviceSummary {
  device_id: string;
  lastSeen: string;
  totalEvents: number;
  invalidEvents: number;
  avgLatencyMs: number;
  maxLatencyMs: number;
}

interface RecentEvent {
  id: string;
  device_id: string;
  event_type: string;
  is_valid: boolean;
  validation_errors: string[];
  processing_latency_ms: number;
  created_at: string;
  latitude: number | null;
  longitude: number | null;
}

export const TraceabilityDashboard = () => {
  const [devices, setDevices] = useState<DeviceSummary[]>([]);
  const [recentEvents, setRecentEvents] = useState<RecentEvent[]>([]);
  const [totalEvents, setTotalEvents] = useState(0);
  const [totalErrors, setTotalErrors] = useState(0);
  const [totalAlerts, setTotalAlerts] = useState(0);
  const [avgLatency, setAvgLatency] = useState(0);
  const [droppedEvents, setDroppedEvents] = useState(0);
  const [loading, setLoading] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);

    const [eventsRes, alertsRes] = await Promise.all([
      (supabase.from("device_telemetry_events") as any)
        .select("*")
        .order("created_at", { ascending: false })
        .limit(500),
      (supabase.from("device_telemetry_alerts") as any)
        .select("id", { count: "exact" }),
    ]);

    const events: RecentEvent[] = eventsRes.data || [];
    setRecentEvents(events.slice(0, 50));
    setTotalEvents(events.length);
    setTotalAlerts(alertsRes.count || alertsRes.data?.length || 0);

    const invalid = events.filter((e) => !e.is_valid);
    setTotalErrors(invalid.length);
    setDroppedEvents(invalid.length);

    if (events.length > 0) {
      const latencies = events.map((e) => e.processing_latency_ms || 0);
      setAvgLatency(Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length));
    }

    // Group by device
    const byDevice: Record<string, RecentEvent[]> = {};
    events.forEach((e) => {
      if (!byDevice[e.device_id]) byDevice[e.device_id] = [];
      byDevice[e.device_id].push(e);
    });

    const summaries: DeviceSummary[] = Object.entries(byDevice).map(([devId, devEvents]) => {
      const sorted = devEvents.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      const latencies = devEvents.map((e) => e.processing_latency_ms || 0);
      return {
        device_id: devId,
        lastSeen: sorted[0].created_at,
        totalEvents: devEvents.length,
        invalidEvents: devEvents.filter((e) => !e.is_valid).length,
        avgLatencyMs: Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length),
        maxLatencyMs: Math.max(...latencies),
      };
    });

    setDevices(summaries);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 15000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const timeSince = (iso: string) => {
    const s = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
    if (s < 60) return `${s}s ago`;
    if (s < 3600) return `${Math.floor(s / 60)}m ago`;
    return `${Math.floor(s / 3600)}h ago`;
  };

  return (
    <Card className="cyber-border">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="font-display text-lg gradient-text flex items-center gap-2">
            <BarChart3 size={18} />
            TRACEABILITY DASHBOARD
          </CardTitle>
          <Button size="sm" variant="outline" className="font-mono text-xs" onClick={fetchData} disabled={loading}>
            <RefreshCw size={12} className={`mr-1 ${loading ? "animate-spin" : ""}`} />
            REFRESH
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* KPI cards */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {[
            { icon: Activity, label: "TOTAL EVENTS", value: totalEvents, color: "text-primary" },
            { icon: AlertCircle, label: "ERRORS", value: totalErrors, color: "text-destructive" },
            { icon: Gauge, label: "AVG LATENCY", value: `${avgLatency}ms`, color: "text-primary" },
            { icon: Clock, label: "ALERTS", value: totalAlerts, color: "text-[hsl(var(--warning-amber))]" },
            { icon: AlertCircle, label: "DROPPED/INVALID", value: droppedEvents, color: "text-destructive" },
          ].map((k) => (
            <div key={k.label} className="bg-muted/50 rounded p-3 border border-border text-center">
              <k.icon size={16} className={`${k.color} mx-auto mb-1`} />
              <p className="font-mono text-[10px] text-muted-foreground">{k.label}</p>
              <p className={`font-mono text-xl font-bold ${k.color}`}>{k.value}</p>
            </div>
          ))}
        </div>

        {/* Last seen by device */}
        {devices.length > 0 && (
          <div>
            <h4 className="font-mono text-xs text-muted-foreground mb-2">LAST SEEN BY DEVICE</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {devices.map((d) => (
                <div key={d.device_id} className="flex items-center justify-between bg-card border border-border rounded p-2">
                  <div>
                    <code className="font-mono text-xs">{d.device_id}</code>
                    <p className="font-mono text-[10px] text-muted-foreground">
                      {d.totalEvents} events · {d.invalidEvents} invalid · avg {d.avgLatencyMs}ms
                    </p>
                  </div>
                  <span className="font-mono text-xs text-muted-foreground">{timeSince(d.lastSeen)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Recent events table */}
        <div className="max-h-64 overflow-y-auto border border-border rounded bg-card/50">
          <table className="w-full text-[11px] font-mono">
            <thead className="sticky top-0 bg-card border-b border-border">
              <tr>
                <th className="text-left p-1.5 text-muted-foreground">TIME</th>
                <th className="text-left p-1.5 text-muted-foreground">DEVICE</th>
                <th className="text-left p-1.5 text-muted-foreground">TYPE</th>
                <th className="text-left p-1.5 text-muted-foreground">VALID</th>
                <th className="text-left p-1.5 text-muted-foreground">ERRORS</th>
                <th className="text-left p-1.5 text-muted-foreground">LATENCY</th>
              </tr>
            </thead>
            <tbody>
              {recentEvents.map((e) => (
                <tr key={e.id} className={`border-b border-border/50 ${!e.is_valid ? "bg-destructive/5" : ""}`}>
                  <td className="p-1.5">{new Date(e.created_at).toLocaleTimeString()}</td>
                  <td className="p-1.5"><code>{e.device_id.slice(0, 16)}</code></td>
                  <td className="p-1.5">{e.event_type}</td>
                  <td className="p-1.5">{e.is_valid ? "✓" : "✗"}</td>
                  <td className="p-1.5">
                    {e.validation_errors?.length > 0 ? (
                      <Badge variant="destructive" className="text-[9px]">{e.validation_errors.length}</Badge>
                    ) : "—"}
                  </td>
                  <td className="p-1.5">{e.processing_latency_ms}ms</td>
                </tr>
              ))}
              {recentEvents.length === 0 && (
                <tr><td colSpan={6} className="p-4 text-center text-muted-foreground">No telemetry events recorded yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
};
