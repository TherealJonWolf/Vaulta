import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Settings, Save, Shield, Mail } from "lucide-react";

interface AlertSettings {
  id?: string;
  alert_email: string;
  daily_digest_enabled: boolean;
  daily_digest_hour: number;
  min_severity_email: string;
  categories_enabled: string[];
}

const CATEGORIES = [
  { id: "fraud", label: "Fraud Signals" },
  { id: "auth", label: "Authentication Events" },
  { id: "upload", label: "Upload Security" },
  { id: "trust", label: "Trust Violations" },
  { id: "system", label: "System Events" },
];

const DEFAULT_SETTINGS: AlertSettings = {
  alert_email: "",
  daily_digest_enabled: true,
  daily_digest_hour: 8,
  min_severity_email: "high",
  categories_enabled: ["fraud", "auth", "upload", "trust", "system"],
};

export const AdminAlertSettings = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [settings, setSettings] = useState<AlertSettings>(DEFAULT_SETTINGS);
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const { data } = await (supabase.from("admin_alert_settings") as any)
        .select("*")
        .eq("admin_user_id", user.id)
        .maybeSingle();
      if (data) {
        setSettings({
          id: data.id,
          alert_email: data.alert_email || "",
          daily_digest_enabled: data.daily_digest_enabled,
          daily_digest_hour: data.daily_digest_hour,
          min_severity_email: data.min_severity_email,
          categories_enabled: data.categories_enabled || DEFAULT_SETTINGS.categories_enabled,
        });
      }
      setLoaded(true);
    };
    load();
  }, [user]);

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    const payload = {
      admin_user_id: user.id,
      alert_email: settings.alert_email.trim() || null,
      daily_digest_enabled: settings.daily_digest_enabled,
      daily_digest_hour: settings.daily_digest_hour,
      min_severity_email: settings.min_severity_email,
      categories_enabled: settings.categories_enabled,
      updated_at: new Date().toISOString(),
    };

    const { error } = settings.id
      ? await (supabase.from("admin_alert_settings") as any).update(payload).eq("id", settings.id)
      : await (supabase.from("admin_alert_settings") as any).insert(payload);

    setSaving(false);
    if (error) {
      toast({ title: "Save failed", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Settings saved", description: "Alert preferences updated." });
      // Re-fetch to get the id if it was an insert
      if (!settings.id) {
        const { data } = await (supabase.from("admin_alert_settings") as any)
          .select("id")
          .eq("admin_user_id", user.id)
          .maybeSingle();
        if (data) setSettings(prev => ({ ...prev, id: data.id }));
      }
    }
  };

  const toggleCategory = (cat: string) => {
    setSettings(prev => ({
      ...prev,
      categories_enabled: prev.categories_enabled.includes(cat)
        ? prev.categories_enabled.filter(c => c !== cat)
        : [...prev.categories_enabled, cat],
    }));
  };

  if (!loaded) return null;

  return (
    <div className="space-y-6">
      <Card className="cyber-border">
        <CardHeader>
          <CardTitle className="font-display text-lg gradient-text flex items-center gap-2">
            <Settings size={18} />
            NOTIFICATION PREFERENCES
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Email configuration */}
          <div className="space-y-2">
            <label className="font-mono text-xs text-muted-foreground flex items-center gap-2">
              <Mail size={14} />
              Alert Email Address
            </label>
            <Input
              type="email"
              value={settings.alert_email}
              onChange={(e) => setSettings(prev => ({ ...prev, alert_email: e.target.value }))}
              placeholder="your-email@example.com"
              className="font-mono text-sm max-w-md"
            />
            <p className="text-[10px] font-mono text-muted-foreground">
              Leave empty to use your account email. Alerts are sent only to verified admin accounts.
            </p>
          </div>

          {/* Minimum severity */}
          <div className="space-y-2">
            <label className="font-mono text-xs text-muted-foreground">Minimum Severity for Immediate Email</label>
            <Select value={settings.min_severity_email} onValueChange={(v) => setSettings(prev => ({ ...prev, min_severity_email: v }))}>
              <SelectTrigger className="max-w-[200px] font-mono text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="critical">Critical only</SelectItem>
                <SelectItem value="high">High and above</SelectItem>
                <SelectItem value="medium">Medium and above</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-[10px] font-mono text-muted-foreground">
              Lower-severity events will still appear in the dashboard but won't trigger email.
            </p>
          </div>

          {/* Categories */}
          <div className="space-y-3">
            <label className="font-mono text-xs text-muted-foreground">Alert Categories</label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {CATEGORIES.map((cat) => (
                <label key={cat.id} className="flex items-center gap-2 p-2 rounded border border-border hover:bg-card cursor-pointer">
                  <Checkbox
                    checked={settings.categories_enabled.includes(cat.id)}
                    onCheckedChange={() => toggleCategory(cat.id)}
                  />
                  <span className="font-mono text-xs">{cat.label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Daily digest */}
          <div className="space-y-3 p-4 rounded-lg border border-border bg-card">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-mono text-xs font-semibold">Daily Status Digest</p>
                <p className="text-[10px] font-mono text-muted-foreground">
                  Receive a daily summary even when no threats are detected, confirming monitoring is active.
                </p>
              </div>
              <Switch
                checked={settings.daily_digest_enabled}
                onCheckedChange={(v) => setSettings(prev => ({ ...prev, daily_digest_enabled: v }))}
              />
            </div>
            {settings.daily_digest_enabled && (
              <div className="flex items-center gap-2">
                <label className="font-mono text-[10px] text-muted-foreground">Send at</label>
                <Select value={String(settings.daily_digest_hour)} onValueChange={(v) => setSettings(prev => ({ ...prev, daily_digest_hour: parseInt(v) }))}>
                  <SelectTrigger className="w-[100px] font-mono text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 24 }, (_, i) => (
                      <SelectItem key={i} value={String(i)}>{String(i).padStart(2, "0")}:00 UTC</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          <div className="flex items-center gap-3">
            <Button onClick={handleSave} disabled={saving} className="font-mono text-xs gap-1">
              <Save size={14} />
              {saving ? "SAVING..." : "SAVE PREFERENCES"}
            </Button>
            <div className="flex items-center gap-1.5 text-[10px] font-mono text-muted-foreground">
              <Shield size={12} />
              Contact info encrypted at rest · Admin-only access
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
