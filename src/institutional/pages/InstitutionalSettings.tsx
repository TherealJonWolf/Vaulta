import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useInstitutionalAuth } from "../hooks/useInstitutionalAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2, Upload, Palette, Save } from "lucide-react";

const ACCENT_PRESETS = [
  "#0f172a", "#1e40af", "#7c3aed", "#059669", "#dc2626",
  "#d97706", "#0891b2", "#4f46e5", "#be185d", "#334155",
];

const InstitutionalSettings = () => {
  const { institutionId, institutionName } = useInstitutionalAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [accentColor, setAccentColor] = useState("#0f172a");
  const [welcomeMessage, setWelcomeMessage] = useState("");
  const [logoPath, setLogoPath] = useState<string | null>(null);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);

  const fetchSettings = useCallback(async () => {
    if (!institutionId) return;
    const { data } = await (supabase.from as any)("institution_settings")
      .select("*")
      .eq("institution_id", institutionId)
      .maybeSingle();

    if (data) {
      setDisplayName(data.display_name || "");
      setAccentColor(data.accent_color || "#0f172a");
      setWelcomeMessage(data.welcome_message || "");
      setLogoPath(data.logo_path || null);
    } else {
      setDisplayName(institutionName || "");
    }
    setLoading(false);
  }, [institutionId, institutionName]);

  useEffect(() => { fetchSettings(); }, [fetchSettings]);

  const handleLogoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!["image/png", "image/jpeg", "image/svg+xml", "image/webp"].includes(file.type)) {
      toast.error("Logo must be PNG, JPG, SVG, or WebP");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.error("Logo must be under 2MB");
      return;
    }
    setLogoFile(file);
    setLogoPreview(URL.createObjectURL(file));
  };

  const handleSave = async () => {
    if (!institutionId) return;
    setSaving(true);

    try {
      let finalLogoPath = logoPath;

      if (logoFile) {
        const ext = logoFile.name.split(".").pop();
        const path = `institution-logos/${institutionId}/logo.${ext}`;
        const { error: uploadError } = await supabase.storage
          .from("documents")
          .upload(path, logoFile, { upsert: true });
        if (uploadError) throw uploadError;
        finalLogoPath = path;
      }

      const settings = {
        institution_id: institutionId,
        display_name: displayName.trim() || null,
        accent_color: accentColor,
        welcome_message: welcomeMessage.trim() || null,
        logo_path: finalLogoPath,
      };

      const { error } = await (supabase.from as any)("institution_settings")
        .upsert(settings, { onConflict: "institution_id" });

      if (error) throw error;

      setLogoPath(finalLogoPath);
      setLogoFile(null);
      toast.success("Settings saved successfully");
    } catch (err: any) {
      console.error("Save settings error:", err);
      toast.error("Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
      </div>
    );
  }

  const previewUrl = logoPreview || (logoPath
    ? supabase.storage.from("documents").getPublicUrl(logoPath).data.publicUrl
    : null);

  return (
    <div className="p-8 max-w-2xl">
      <h1 className="text-xl font-semibold text-slate-900 mb-1">Settings</h1>
      <p className="text-sm text-slate-500 mb-8">
        Personalize your institutional vault. These settings are isolated to your organization only.
      </p>

      <div className="space-y-8">
        {/* Display Name */}
        <div className="space-y-2">
          <Label htmlFor="displayName" className="text-sm font-medium text-slate-700">
            Display Name
          </Label>
          <Input
            id="displayName"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="Your organization name"
            className="max-w-md"
          />
          <p className="text-xs text-slate-400">
            Shown to applicants on the document submission page
          </p>
        </div>

        {/* Logo */}
        <div className="space-y-2">
          <Label className="text-sm font-medium text-slate-700">Logo</Label>
          <div className="flex items-center gap-4">
            {previewUrl ? (
              <div className="h-16 w-16 rounded-lg border border-slate-200 overflow-hidden flex items-center justify-center bg-white">
                <img src={previewUrl} alt="Logo" className="h-full w-full object-contain" />
              </div>
            ) : (
              <div className="h-16 w-16 rounded-lg border-2 border-dashed border-slate-200 flex items-center justify-center">
                <Upload className="h-5 w-5 text-slate-300" />
              </div>
            )}
            <div>
              <label className="cursor-pointer inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium border border-slate-200 rounded-md hover:bg-slate-50 transition-colors">
                <Upload className="h-3.5 w-3.5" />
                Upload logo
                <input type="file" className="hidden" accept="image/png,image/jpeg,image/svg+xml,image/webp" onChange={handleLogoSelect} />
              </label>
              <p className="text-xs text-slate-400 mt-1">PNG, JPG, SVG, or WebP. Max 2MB.</p>
            </div>
          </div>
        </div>

        {/* Accent Color */}
        <div className="space-y-2">
          <Label className="text-sm font-medium text-slate-700 flex items-center gap-2">
            <Palette className="h-4 w-4" />
            Accent Color
          </Label>
          <div className="flex items-center gap-2 flex-wrap">
            {ACCENT_PRESETS.map((color) => (
              <button
                key={color}
                onClick={() => setAccentColor(color)}
                className={`h-8 w-8 rounded-full border-2 transition-all ${
                  accentColor === color ? "border-slate-900 scale-110" : "border-transparent"
                }`}
                style={{ backgroundColor: color }}
              />
            ))}
            <Input
              type="color"
              value={accentColor}
              onChange={(e) => setAccentColor(e.target.value)}
              className="h-8 w-8 p-0 border-0 cursor-pointer"
            />
          </div>
          <p className="text-xs text-slate-400">Applied to your sidebar and public submission page</p>
        </div>

        {/* Welcome Message */}
        <div className="space-y-2">
          <Label htmlFor="welcome" className="text-sm font-medium text-slate-700">
            Welcome Message
          </Label>
          <Textarea
            id="welcome"
            value={welcomeMessage}
            onChange={(e) => setWelcomeMessage(e.target.value)}
            placeholder="Enter a message shown to applicants on the document submission page..."
            rows={4}
            className="max-w-md"
          />
          <p className="text-xs text-slate-400">
            Displayed to applicants when they open their submission link
          </p>
        </div>

        {/* Preview */}
        <div className="border border-slate-200 rounded-lg p-4">
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-3">Preview</p>
          <div className="flex items-center gap-3 mb-3">
            {previewUrl && (
              <img src={previewUrl} alt="Logo" className="h-8 w-8 rounded object-contain" />
            )}
            <span className="font-semibold text-slate-900">{displayName || institutionName}</span>
          </div>
          {welcomeMessage && (
            <p className="text-sm text-slate-600 border-l-2 pl-3" style={{ borderColor: accentColor }}>
              {welcomeMessage}
            </p>
          )}
          <div className="mt-3 h-1.5 w-24 rounded-full" style={{ backgroundColor: accentColor }} />
        </div>

        <Button onClick={handleSave} disabled={saving} className="gap-2">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Save Settings
        </Button>
      </div>
    </div>
  );
};

export default InstitutionalSettings;
