import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Smartphone, ShieldCheck, AlertCircle, Clock, MapPin } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { formatDistanceToNow } from "date-fns";

interface DeviceHealthRow {
  device_id: string;
  status: "healthy" | "stale" | "unhealthy";
  last_seen_at: string;
  total_events: number;
  total_alerts: number;
  total_dropped: number;
}

interface FriendlyAlert {
  id: string;
  rule_name: string;
  severity: string;
  created_at: string;
  device_id: string;
}

const ALERT_FRIENDLY: Record<string, { title: string; description: string }> = {
  location_teleport: {
    title: "Unusual Location Behavior Detected",
    description: "Your device appeared to move faster than physically possible. This may indicate a spoofed location or a syncing issue.",
  },
  stale_orientation: {
    title: "Device May Be Stationary or Emulated",
    description: "Sensor readings have not changed across multiple checks. This is typical of an emulator or a device left untouched.",
  },
  device_silent: {
    title: "Inactive Device During Sensitive Activity",
    description: "Your device stopped sending integrity signals while a session was active.",
  },
};

const STATUS_FRIENDLY: Record<string, { label: string; color: string; icon: typeof ShieldCheck; insight: string }> = {
  healthy: {
    label: "Healthy",
    color: "text-primary",
    icon: ShieldCheck,
    insight: "Active and behaving normally",
  },
  stale: {
    label: "Stale",
    color: "text-[hsl(var(--warning-amber))]",
    icon: Clock,
    insight: "No recent activity detected",
  },
  unhealthy: {
    label: "Inactive",
    color: "text-destructive",
    icon: AlertCircle,
    insight: "No recent activity detected",
  },
};

const ANOMALY_INSIGHT = "Unusual behavior detected recently";
const ANOMALY_WINDOW_MS = 10 * 60 * 1000; // 10 minutes

export const TrustedDevicesPanel = () => {
  const { user } = useAuth();
  const [devices, setDevices] = useState<DeviceHealthRow[]>([]);
  const [alerts, setAlerts] = useState<FriendlyAlert[]>([]);
  const [integrityScore, setIntegrityScore] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    let mounted = true;

    const load = async () => {
      const [{ data: dh }, { data: al }, { data: factor }] = await Promise.all([
        (supabase.from("device_health") as any)
          .select("device_id, status, last_seen_at, total_events, total_alerts, total_dropped")
          .eq("user_id", user.id)
          .order("last_seen_at", { ascending: false }),
        (supabase.from("device_telemetry_alerts") as any)
          .select("id, rule_name, alert_type, severity, created_at, device_id")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(10),
        (supabase.from("device_integrity_factors") as any)
          .select("integrity_score")
          .eq("user_id", user.id)
          .maybeSingle(),
      ]);

      if (!mounted) return;
      setDevices((dh as DeviceHealthRow[]) ?? []);
      setAlerts(
        (al ?? []).map((a: any) => ({
          id: a.id,
          rule_name: ALERT_FRIENDLY[a.alert_type]?.title ?? a.rule_name,
          severity: a.severity,
          created_at: a.created_at,
          device_id: a.device_id,
        })),
      );
      setIntegrityScore(factor?.integrity_score ?? null);
      setLoading(false);
    };

    load();

    // realtime updates on this user's device_health
    const channel = supabase
      .channel("device_health_user")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "device_health", filter: `user_id=eq.${user.id}` },
        () => load(),
      )
      .subscribe();

    return () => {
      mounted = false;
      supabase.removeChannel(channel);
    };
  }, [user]);

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><ShieldCheck size={18} /> Trusted Devices</CardTitle>
        </CardHeader>
        <CardContent><p className="text-sm text-muted-foreground">Checking device integrity…</p></CardContent>
      </Card>
    );
  }

  if (devices.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><ShieldCheck size={18} /> Trusted Devices</CardTitle>
          <CardDescription>
            No devices are sending integrity signals yet. Devices appear here automatically when you use Vaulta on a sensor-enabled device.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <CardTitle className="flex items-center gap-2"><ShieldCheck size={18} /> Trusted Devices</CardTitle>
            <CardDescription>
              How your devices contribute to your trust profile. Raw sensor data is never shown — only meaningful signals.
            </CardDescription>
          </div>
          {integrityScore != null && (
            <div className="text-right">
              <p className="text-xs text-muted-foreground">Device Integrity</p>
              <p className="text-2xl font-bold text-primary">+{integrityScore}<span className="text-sm text-muted-foreground">/10</span></p>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 md:grid-cols-2">
          {devices.map((d) => {
            const s = STATUS_FRIENDLY[d.status];
            const Icon = s.icon;
            const hasRecentAnomaly = alerts.some(
              (a) =>
                a.device_id === d.device_id &&
                Date.now() - new Date(a.created_at).getTime() < ANOMALY_WINDOW_MS,
            );
            const insight = hasRecentAnomaly ? ANOMALY_INSIGHT : s.insight;
            const insightColor = hasRecentAnomaly
              ? "text-destructive"
              : d.status === "healthy"
                ? "text-primary"
                : "text-muted-foreground";
            return (
              <div key={d.device_id} className="border border-border rounded-lg p-3 bg-card">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Smartphone size={16} className="text-muted-foreground" />
                    <code className="text-xs">{d.device_id.slice(0, 18)}…</code>
                  </div>
                  <Badge variant="outline" className={`gap-1 ${s.color}`}>
                    <Icon size={12} />
                    {s.label}
                  </Badge>
                </div>
                <p className={`text-xs mb-2 ${insightColor}`}>{insight}</p>
                <div className="grid grid-cols-3 gap-2 text-xs">
                  <div>
                    <p className="text-muted-foreground">Last seen</p>
                    <p className="font-medium">{formatDistanceToNow(new Date(d.last_seen_at), { addSuffix: true })}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Signals</p>
                    <p className="font-medium">{d.total_events}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Flags</p>
                    <p className={`font-medium ${d.total_alerts > 0 ? "text-destructive" : ""}`}>{d.total_alerts}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {alerts.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-semibold flex items-center gap-2"><AlertCircle size={14} /> Recent insights</h4>
            <div className="space-y-2">
              {alerts.slice(0, 5).map((a) => (
                <div key={a.id} className="border-l-2 border-[hsl(var(--warning-amber))] pl-3 py-1">
                  <p className="text-sm font-medium">{a.rule_name}</p>
                  <p className="text-xs text-muted-foreground">
                    {ALERT_FRIENDLY[Object.keys(ALERT_FRIENDLY).find((k) => ALERT_FRIENDLY[k].title === a.rule_name) ?? ""]?.description ?? ""}
                    {" · "}
                    {formatDistanceToNow(new Date(a.created_at), { addSuffix: true })}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
