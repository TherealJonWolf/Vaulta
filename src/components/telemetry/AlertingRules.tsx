import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AlertTriangle, ShieldAlert, Clock, Zap, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface TelemetryAlert {
  id: string;
  device_id: string;
  alert_type: string;
  severity: string;
  rule_name: string;
  description: string;
  resolved: boolean;
  created_at: string;
}

interface DeviceHealth {
  device_id: string;
  lastSeen: string;
  eventCount: number;
  status: "healthy" | "stale" | "unhealthy";
  alerts: number;
}

const SPEED_THRESHOLD_KMH = 900; // faster than a commercial jet
const STALE_THRESHOLD_MS = 60_000;

export const AlertingRules = () => {
  const [alerts, setAlerts] = useState<TelemetryAlert[]>([]);
  const [deviceHealth, setDeviceHealth] = useState<DeviceHealth[]>([]);
  const [evaluating, setEvaluating] = useState(false);

  const fetchAlerts = useCallback(async () => {
    const { data } = await (supabase.from("device_telemetry_alerts") as any)
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100);
    if (data) setAlerts(data);
  }, []);

  const evaluateRules = useCallback(async () => {
    setEvaluating(true);

    // Fetch recent telemetry events grouped by device
    const { data: events } = await (supabase.from("device_telemetry_events") as any)
      .select("*")
      .order("created_at", { ascending: false })
      .limit(500);

    if (!events || events.length === 0) {
      setEvaluating(false);
      return;
    }

    const byDevice: Record<string, any[]> = {};
    events.forEach((e: any) => {
      if (!byDevice[e.device_id]) byDevice[e.device_id] = [];
      byDevice[e.device_id].push(e);
    });

    const newAlerts: Omit<TelemetryAlert, "id" | "created_at" | "resolved">[] = [];
    const healthMap: DeviceHealth[] = [];

    for (const [devId, devEvents] of Object.entries(byDevice)) {
      const sorted = devEvents.sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      const latest = sorted[0];
      const msSinceLast = Date.now() - new Date(latest.created_at).getTime();
      let alertCount = 0;

      // Rule 1: Impossible speed (location teleport)
      for (let i = 0; i < sorted.length - 1; i++) {
        const a = sorted[i];
        const b = sorted[i + 1];
        if (a.latitude != null && b.latitude != null) {
          const dist = haversine(a.latitude, a.longitude, b.latitude, b.longitude);
          const timeDiffH = (new Date(a.created_at).getTime() - new Date(b.created_at).getTime()) / 3_600_000;
          if (timeDiffH > 0) {
            const speedKmh = dist / timeDiffH;
            if (speedKmh > SPEED_THRESHOLD_KMH) {
              newAlerts.push({
                device_id: devId,
                user_id: a.user_id,
                alert_type: "location_teleport",
                severity: "critical",
                rule_name: "Impossible Speed",
                description: `Device moved ${dist.toFixed(0)}km in ${(timeDiffH * 60).toFixed(1)}min (${speedKmh.toFixed(0)} km/h)`,
              });
              alertCount++;
            }
          }
        }
      }

      // Rule 2: Impossible/stale orientation
      const orientEvents = sorted.filter((e: any) => e.alpha != null);
      if (orientEvents.length >= 5) {
        const allSame = orientEvents.slice(0, 5).every(
          (e: any) => e.alpha === orientEvents[0].alpha && e.beta === orientEvents[0].beta && e.gamma === orientEvents[0].gamma
        );
        if (allSame) {
          newAlerts.push({
            device_id: devId,
            user_id: latest.user_id,
            alert_type: "stale_orientation",
            severity: "medium",
            rule_name: "Stale Orientation",
            description: `Orientation unchanged across 5+ readings (α=${orientEvents[0].alpha}, β=${orientEvents[0].beta}, γ=${orientEvents[0].gamma})`,
          });
          alertCount++;
        }
      }

      // Rule 3: Device gone silent
      let status: "healthy" | "stale" | "unhealthy" = "healthy";
      if (msSinceLast > STALE_THRESHOLD_MS) {
        status = "unhealthy";
        newAlerts.push({
          device_id: devId,
          user_id: latest.user_id,
          alert_type: "device_silent",
          severity: "high",
          rule_name: "Device Silent",
          description: `No events for ${Math.round(msSinceLast / 1000)}s (threshold: 60s)`,
        });
        alertCount++;
      } else if (msSinceLast > 30_000) {
        status = "stale";
      }

      healthMap.push({
        device_id: devId,
        lastSeen: latest.created_at,
        eventCount: sorted.length,
        status,
        alerts: alertCount,
      });
    }

    // Persist new alerts
    if (newAlerts.length > 0) {
      await (supabase.from("device_telemetry_alerts") as any).insert(
        newAlerts.map((a) => ({ ...a, resolved: false }))
      );
    }

    setDeviceHealth(healthMap);
    await fetchAlerts();
    setEvaluating(false);
  }, [fetchAlerts]);

  useEffect(() => {
    fetchAlerts();
  }, [fetchAlerts]);

  const severityColor = (s: string) => {
    switch (s) {
      case "critical": return "destructive";
      case "high": return "secondary";
      default: return "outline";
    }
  };

  const statusColor = (s: string) => {
    switch (s) {
      case "healthy": return "text-primary";
      case "stale": return "text-[hsl(var(--warning-amber))]";
      case "unhealthy": return "text-destructive";
      default: return "text-muted-foreground";
    }
  };

  return (
    <Card className="cyber-border">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="font-display text-lg gradient-text flex items-center gap-2">
            <ShieldAlert size={18} />
            ALERTING RULES
          </CardTitle>
          <Button size="sm" variant="outline" className="font-mono text-xs" onClick={evaluateRules} disabled={evaluating}>
            <Zap size={12} className={`mr-1 ${evaluating ? "animate-spin" : ""}`} />
            {evaluating ? "EVALUATING..." : "RUN RULES"}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Rule definitions */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {[
            { icon: AlertTriangle, name: "Impossible Speed", desc: "Flags if location changes faster than 900 km/h", color: "text-destructive" },
            { icon: RefreshCw, name: "Stale Orientation", desc: "Flags if orientation is identical across 5+ readings", color: "text-[hsl(var(--warning-amber))]" },
            { icon: Clock, name: "Device Silent", desc: "Marks device unhealthy if no events for 60s", color: "text-[hsl(var(--neon-magenta))]" },
          ].map((rule) => (
            <div key={rule.name} className="bg-muted/50 rounded p-3 border border-border">
              <div className="flex items-center gap-2 mb-1">
                <rule.icon size={14} className={rule.color} />
                <span className="font-mono text-xs font-semibold">{rule.name}</span>
              </div>
              <p className="font-mono text-[10px] text-muted-foreground">{rule.desc}</p>
            </div>
          ))}
        </div>

        {/* Device health */}
        {deviceHealth.length > 0 && (
          <div>
            <h4 className="font-mono text-xs text-muted-foreground mb-2">DEVICE HEALTH</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {deviceHealth.map((d) => (
                <div key={d.device_id} className="flex items-center justify-between bg-card border border-border rounded p-2">
                  <div>
                    <code className="font-mono text-xs">{d.device_id}</code>
                    <p className="font-mono text-[10px] text-muted-foreground">{d.eventCount} events</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`font-mono text-xs font-bold ${statusColor(d.status)}`}>
                      {d.status.toUpperCase()}
                    </span>
                    {d.alerts > 0 && (
                      <Badge variant="destructive" className="font-mono text-[10px]">{d.alerts} alerts</Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Alert log */}
        <div className="max-h-48 overflow-y-auto border border-border rounded bg-card/50">
          <table className="w-full text-[11px] font-mono">
            <thead className="sticky top-0 bg-card border-b border-border">
              <tr>
                <th className="text-left p-1.5 text-muted-foreground">TIME</th>
                <th className="text-left p-1.5 text-muted-foreground">DEVICE</th>
                <th className="text-left p-1.5 text-muted-foreground">RULE</th>
                <th className="text-left p-1.5 text-muted-foreground">SEVERITY</th>
                <th className="text-left p-1.5 text-muted-foreground">DESCRIPTION</th>
              </tr>
            </thead>
            <tbody>
              {alerts.map((a) => (
                <tr key={a.id} className="border-b border-border/50">
                  <td className="p-1.5">{new Date(a.created_at).toLocaleTimeString()}</td>
                  <td className="p-1.5"><code>{a.device_id.slice(0, 16)}</code></td>
                  <td className="p-1.5">{a.rule_name}</td>
                  <td className="p-1.5"><Badge variant={severityColor(a.severity) as any} className="text-[9px]">{a.severity}</Badge></td>
                  <td className="p-1.5 max-w-[200px] truncate">{a.description}</td>
                </tr>
              ))}
              {alerts.length === 0 && (
                <tr><td colSpan={5} className="p-4 text-center text-muted-foreground">No alerts. Run rules to evaluate telemetry.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
};

// Haversine distance in km
function haversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
