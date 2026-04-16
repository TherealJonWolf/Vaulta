import { useState, useEffect, useRef, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Smartphone, MapPin, RotateCcw, Play, Square, Wifi, WifiOff } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

interface SensorReading {
  id: string;
  trace_id: string | null;
  timestamp: string;
  latitude: number | null;
  longitude: number | null;
  accuracy: number | null;
  alpha: number | null;
  beta: number | null;
  gamma: number | null;
  speed: number | null;
  isValid: boolean;
  validationErrors: string[];
  latencyMs: number;
  alertsGenerated: number;
}

const generateDeviceId = (): string => {
  const stored = localStorage.getItem("vaulta_device_id");
  if (stored) return stored;
  const id = `device_${crypto.randomUUID().slice(0, 12)}`;
  localStorage.setItem("vaulta_device_id", id);
  return id;
};

const validateReading = (reading: Partial<SensorReading>): string[] => {
  const errors: string[] = [];
  if (reading.latitude != null && (reading.latitude < -90 || reading.latitude > 90))
    errors.push("latitude_out_of_range");
  if (reading.longitude != null && (reading.longitude < -180 || reading.longitude > 180))
    errors.push("longitude_out_of_range");
  if (reading.alpha != null && (reading.alpha < 0 || reading.alpha > 360))
    errors.push("alpha_impossible");
  if (reading.beta != null && (reading.beta < -180 || reading.beta > 180))
    errors.push("beta_impossible");
  if (reading.gamma != null && (reading.gamma < -90 || reading.gamma > 90))
    errors.push("gamma_impossible");
  return errors;
};

export const PhoneSensorIngestion = () => {
  const { user } = useAuth();
  const [streaming, setStreaming] = useState(false);
  const [permissionStatus, setPermissionStatus] = useState<"pending" | "granted" | "denied">("pending");
  const [readings, setReadings] = useState<SensorReading[]>([]);
  const [eventCount, setEventCount] = useState(0);
  const [errorCount, setErrorCount] = useState(0);
  const deviceId = useRef(generateDeviceId());
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const geoRef = useRef<{ lat: number | null; lng: number | null; acc: number | null; speed: number | null }>({
    lat: null, lng: null, acc: null, speed: null,
  });
  const orientRef = useRef<{ alpha: number | null; beta: number | null; gamma: number | null }>({
    alpha: null, beta: null, gamma: null,
  });
  const watchIdRef = useRef<number | null>(null);

  const requestPermissions = useCallback(async () => {
    try {
      // Request geolocation
      navigator.geolocation.getCurrentPosition(
        () => setPermissionStatus("granted"),
        () => setPermissionStatus("denied"),
        { enableHighAccuracy: true }
      );

      // Request orientation (iOS requires explicit permission)
      if (typeof (DeviceOrientationEvent as any).requestPermission === "function") {
        const result = await (DeviceOrientationEvent as any).requestPermission();
        if (result !== "granted") setPermissionStatus("denied");
      }
      setPermissionStatus("granted");
    } catch {
      setPermissionStatus("denied");
    }
  }, []);

  const handleOrientation = useCallback((e: DeviceOrientationEvent) => {
    orientRef.current = { alpha: e.alpha, beta: e.beta, gamma: e.gamma };
  }, []);

  const postTelemetry = useCallback(async () => {
    if (!user) return;
    const clientTs = new Date();
    const geo = geoRef.current;
    const orient = orientRef.current;

    const partial: Partial<SensorReading> = {
      latitude: geo.lat,
      longitude: geo.lng,
      accuracy: geo.acc,
      alpha: orient.alpha,
      beta: orient.beta,
      gamma: orient.gamma,
      speed: geo.speed,
    };

    const validationErrors = validateReading(partial);
    const isValid = validationErrors.length === 0;
    const serverTs = new Date();
    const latencyMs = serverTs.getTime() - clientTs.getTime();

    const reading: SensorReading = {
      id: crypto.randomUUID(),
      timestamp: clientTs.toISOString(),
      latitude: geo.lat,
      longitude: geo.lng,
      accuracy: geo.acc,
      alpha: orient.alpha,
      beta: orient.beta,
      gamma: orient.gamma,
      speed: geo.speed,
      isValid,
      validationErrors,
      latencyMs,
    };

    setReadings((prev) => [reading, ...prev].slice(0, 50));
    setEventCount((c) => c + 1);
    if (!isValid) setErrorCount((c) => c + 1);

    try {
      await (supabase.from("device_telemetry_events") as any).insert({
        user_id: user.id,
        device_id: deviceId.current,
        event_type: "sensor_reading",
        latitude: geo.lat,
        longitude: geo.lng,
        accuracy: geo.acc,
        alpha: orient.alpha,
        beta: orient.beta,
        gamma: orient.gamma,
        speed: geo.speed,
        is_valid: isValid,
        validation_errors: validationErrors,
        client_timestamp: clientTs.toISOString(),
        server_timestamp: serverTs.toISOString(),
        processing_latency_ms: latencyMs,
      });
    } catch {
      setErrorCount((c) => c + 1);
    }
  }, [user]);

  const startStreaming = useCallback(() => {
    setStreaming(true);

    // Start geolocation watch
    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        geoRef.current = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          acc: pos.coords.accuracy,
          speed: pos.coords.speed,
        };
      },
      () => {},
      { enableHighAccuracy: true, maximumAge: 2000 }
    );

    // Listen to orientation
    window.addEventListener("deviceorientation", handleOrientation);

    // Post every 3-5 seconds (randomized cadence)
    const tick = () => {
      postTelemetry();
      const delay = 3000 + Math.random() * 2000;
      intervalRef.current = setTimeout(tick, delay) as any;
    };
    tick();
  }, [postTelemetry, handleOrientation]);

  const stopStreaming = useCallback(() => {
    setStreaming(false);
    if (watchIdRef.current != null) navigator.geolocation.clearWatch(watchIdRef.current);
    window.removeEventListener("deviceorientation", handleOrientation);
    if (intervalRef.current) clearTimeout(intervalRef.current as any);
  }, [handleOrientation]);

  useEffect(() => () => stopStreaming(), []);

  return (
    <Card className="cyber-border">
      <CardHeader>
        <CardTitle className="font-display text-lg gradient-text flex items-center gap-2">
          <Smartphone size={18} />
          PHONE SENSOR INGESTION
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Controls */}
        <div className="flex items-center gap-3 flex-wrap">
          <Button size="sm" variant="outline" className="font-mono text-xs" onClick={requestPermissions}>
            <MapPin size={12} className="mr-1" />
            REQUEST PERMISSIONS
          </Button>
          <Badge variant={permissionStatus === "granted" ? "default" : "destructive"} className="font-mono text-[10px]">
            {permissionStatus.toUpperCase()}
          </Badge>

          {!streaming ? (
            <Button size="sm" className="font-mono text-xs" onClick={startStreaming} disabled={permissionStatus !== "granted"}>
              <Play size={12} className="mr-1" />
              START STREAM
            </Button>
          ) : (
            <Button size="sm" variant="destructive" className="font-mono text-xs" onClick={stopStreaming}>
              <Square size={12} className="mr-1" />
              STOP STREAM
            </Button>
          )}

          <div className="ml-auto flex items-center gap-3 font-mono text-xs text-muted-foreground">
            <span>DEVICE: <code className="text-foreground">{deviceId.current}</code></span>
            <span>EVENTS: <code className="text-primary">{eventCount}</code></span>
            <span>ERRORS: <code className="text-destructive">{errorCount}</code></span>
            {streaming ? <Wifi size={14} className="text-primary animate-pulse" /> : <WifiOff size={14} />}
          </div>
        </div>

        {/* Live current values */}
        {streaming && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: "LAT", value: geoRef.current.lat?.toFixed(6) ?? "—" },
              { label: "LNG", value: geoRef.current.lng?.toFixed(6) ?? "—" },
              { label: "α (alpha)", value: orientRef.current.alpha?.toFixed(1) ?? "—" },
              { label: "β (beta)", value: orientRef.current.beta?.toFixed(1) ?? "—" },
            ].map((m) => (
              <div key={m.label} className="bg-muted/50 rounded p-2 border border-border">
                <p className="font-mono text-[10px] text-muted-foreground">{m.label}</p>
                <p className="font-mono text-sm text-foreground">{m.value}</p>
              </div>
            ))}
          </div>
        )}

        {/* Live feed */}
        <div className="max-h-64 overflow-y-auto border border-border rounded bg-card/50">
          <table className="w-full text-[11px] font-mono">
            <thead className="sticky top-0 bg-card border-b border-border">
              <tr>
                <th className="text-left p-1.5 text-muted-foreground">TIME</th>
                <th className="text-left p-1.5 text-muted-foreground">LAT</th>
                <th className="text-left p-1.5 text-muted-foreground">LNG</th>
                <th className="text-left p-1.5 text-muted-foreground">α</th>
                <th className="text-left p-1.5 text-muted-foreground">β</th>
                <th className="text-left p-1.5 text-muted-foreground">γ</th>
                <th className="text-left p-1.5 text-muted-foreground">VALID</th>
                <th className="text-left p-1.5 text-muted-foreground">LATENCY</th>
              </tr>
            </thead>
            <tbody>
              {readings.map((r) => (
                <tr key={r.id} className={`border-b border-border/50 ${!r.isValid ? "bg-destructive/5" : ""}`}>
                  <td className="p-1.5">{new Date(r.timestamp).toLocaleTimeString()}</td>
                  <td className="p-1.5">{r.latitude?.toFixed(4) ?? "—"}</td>
                  <td className="p-1.5">{r.longitude?.toFixed(4) ?? "—"}</td>
                  <td className="p-1.5">{r.alpha?.toFixed(0) ?? "—"}</td>
                  <td className="p-1.5">{r.beta?.toFixed(0) ?? "—"}</td>
                  <td className="p-1.5">{r.gamma?.toFixed(0) ?? "—"}</td>
                  <td className="p-1.5">{r.isValid ? "✓" : "✗"}</td>
                  <td className="p-1.5">{r.latencyMs}ms</td>
                </tr>
              ))}
              {readings.length === 0 && (
                <tr><td colSpan={8} className="p-4 text-center text-muted-foreground">No events yet. Start streaming to see live telemetry.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
};
