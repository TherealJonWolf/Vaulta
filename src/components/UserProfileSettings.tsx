import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Loader2, Upload, Save, User, Palette } from "lucide-react";

const VAULT_ACCENT_COLORS = [
  { value: "#0ea5e9", label: "Sky" },
  { value: "#8b5cf6", label: "Violet" },
  { value: "#10b981", label: "Emerald" },
  { value: "#f59e0b", label: "Amber" },
  { value: "#ef4444", label: "Rose" },
  { value: "#6366f1", label: "Indigo" },
];

const LANGUAGES = [
  { value: "en", label: "English" },
  { value: "es", label: "Español" },
  { value: "fr", label: "Français" },
  { value: "pt", label: "Português" },
  { value: "zh", label: "中文" },
  { value: "ar", label: "العربية" },
];

interface Props {
  isOpen: boolean;
  onClose: () => void;
  userId?: string;
  onSettingsChanged?: (settings: { vaultDisplayName?: string; vaultAccentColor?: string }) => void;
}

const UserProfileSettings = ({ isOpen, onClose, userId, onSettingsChanged }: Props) => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);

  const [fullName, setFullName] = useState("");
  const [preferredName, setPreferredName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [preferredLanguage, setPreferredLanguage] = useState("en");
  const [profilePhotoUrl, setProfilePhotoUrl] = useState<string | null>(null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [vaultDisplayName, setVaultDisplayName] = useState("");
  const [vaultAccentColor, setVaultAccentColor] = useState("#0ea5e9");

  useEffect(() => {
    if (!userId || !isOpen) return;
    const fetch = async () => {
      setLoading(true);
      const { data } = await supabase
        .from("profiles")
        .select("*")
        .eq("user_id", userId)
        .maybeSingle();
      if (data) {
        setFullName((data as any).full_name || "");
        setPreferredName((data as any).preferred_name || "");
        setEmail((data as any).email || "");
        setPhone((data as any).phone || "");
        setPreferredLanguage((data as any).preferred_language || "en");
        setProfilePhotoUrl((data as any).profile_photo_url || null);
        setVaultDisplayName((data as any).vault_display_name || "");
        setVaultAccentColor((data as any).vault_accent_color || "#0ea5e9");
      }
      setLoading(false);
    };
    fetch();
  }, [userId, isOpen]);

  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) {
      toast.error("Photo must be PNG, JPG, or WebP");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Photo must be under 5MB");
      return;
    }
    setPhotoFile(file);
    setPhotoPreview(URL.createObjectURL(file));
  };

  const handleSave = async () => {
    if (!userId) return;
    setSaving(true);

    try {
      let finalPhotoUrl = profilePhotoUrl;

      if (photoFile) {
        setUploadProgress(20);
        const ext = photoFile.name.split(".").pop();
        const path = `${userId}/photo-${Date.now()}.${ext}`;

        const { error: uploadError } = await supabase.storage
          .from("profile-photos")
          .upload(path, photoFile, { upsert: true, contentType: photoFile.type });

        if (uploadError) {
          console.error("Photo upload error:", uploadError);
          throw new Error(`Photo upload failed: ${uploadError.message}`);
        }
        setUploadProgress(70);
        const { data: urlData } = supabase.storage.from("profile-photos").getPublicUrl(path);
        finalPhotoUrl = urlData.publicUrl;
        setUploadProgress(90);
      }

      const updates: Record<string, any> = {
        full_name: fullName.trim() || null,
        preferred_name: preferredName.trim() || null,
        phone: phone.trim() || null,
        preferred_language: preferredLanguage,
        profile_photo_url: finalPhotoUrl,
        vault_display_name: vaultDisplayName.trim() || null,
        vault_accent_color: vaultAccentColor,
      };

      const { error } = await supabase
        .from("profiles")
        .update(updates)
        .eq("user_id", userId);

      if (error) {
        console.error("Profile save error:", error);
        throw new Error(`Save failed: ${error.message}`);
      }

      setProfilePhotoUrl(finalPhotoUrl);
      setPhotoFile(null);
      setUploadProgress(100);
      setTimeout(() => setUploadProgress(null), 1000);
      onSettingsChanged?.({ vaultDisplayName: vaultDisplayName.trim(), vaultAccentColor });
      toast.success("Profile saved");
    } catch (err: any) {
      console.error("Save profile error:", err);
      toast.error(err.message || "Failed to save profile");
      setUploadProgress(null);
    } finally {
      setSaving(false);
    }
  };

  const displayPhotoUrl = photoPreview || profilePhotoUrl;

  return (
    <Sheet open={isOpen} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-[440px] sm:w-[500px] overflow-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <User className="h-5 w-5" /> Profile Settings
          </SheetTitle>
        </SheetHeader>

        {loading ? (
          <div className="flex items-center justify-center h-48">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-6 mt-6">
            {/* Photo */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Profile Photo</Label>
              <div className="flex items-center gap-4">
                {displayPhotoUrl ? (
                  <img src={displayPhotoUrl} alt="Profile" className="h-16 w-16 rounded-full object-cover border border-border" />
                ) : (
                  <div className="h-16 w-16 rounded-full border-2 border-dashed border-border flex items-center justify-center">
                    <User className="h-6 w-6 text-muted-foreground" />
                  </div>
                )}
                <label className="cursor-pointer inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium border border-border rounded-md hover:bg-muted transition-colors">
                  <Upload className="h-3.5 w-3.5" />
                  Upload photo
                  <input type="file" className="hidden" accept="image/png,image/jpeg,image/webp" onChange={handlePhotoSelect} />
                </label>
              </div>
              {uploadProgress !== null && <Progress value={uploadProgress} className="h-2" />}
            </div>

            {/* Full Name */}
            <div className="space-y-1">
              <Label htmlFor="fullName" className="text-xs text-muted-foreground">Full Legal Name</Label>
              <Input id="fullName" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Your full legal name" />
            </div>

            {/* Preferred Name */}
            <div className="space-y-1">
              <Label htmlFor="preferredName" className="text-xs text-muted-foreground">Preferred Name</Label>
              <Input id="preferredName" value={preferredName} onChange={(e) => setPreferredName(e.target.value)} placeholder="Display name inside the app" />
            </div>

            {/* Email (read-only) */}
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Email</Label>
              <Input value={email} disabled className="bg-muted" />
              <p className="text-xs text-muted-foreground">Contact support to change your email</p>
            </div>

            {/* Phone */}
            <div className="space-y-1">
              <Label htmlFor="phone" className="text-xs text-muted-foreground">Phone</Label>
              <Input id="phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+1 (555) 000-0000" />
            </div>

            {/* Language */}
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Preferred Language</Label>
              <Select value={preferredLanguage} onValueChange={setPreferredLanguage}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {LANGUAGES.map((l) => <SelectItem key={l.value} value={l.value}>{l.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            {/* Vault Personalization */}
            <div className="border-t border-border pt-4 space-y-4">
              <h3 className="text-sm font-semibold flex items-center gap-2">
                <Palette className="h-4 w-4" /> Vault Personalization
              </h3>

              <div className="space-y-1">
                <Label htmlFor="vaultName" className="text-xs text-muted-foreground">Vault Display Name</Label>
                <Input id="vaultName" value={vaultDisplayName} onChange={(e) => setVaultDisplayName(e.target.value)} placeholder="e.g. Jon's Vault" />
              </div>

              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Vault Accent Color</Label>
                <div className="flex gap-2">
                  {VAULT_ACCENT_COLORS.map((c) => (
                    <button key={c.value} onClick={() => setVaultAccentColor(c.value)}
                      className={`h-8 w-8 rounded-full border-2 transition-all ${vaultAccentColor === c.value ? "border-foreground scale-110" : "border-transparent"}`}
                      style={{ backgroundColor: c.value }} title={c.label} />
                  ))}
                </div>
              </div>
            </div>

            <Button onClick={handleSave} disabled={saving} className="w-full gap-2">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Save Profile
            </Button>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
};

export default UserProfileSettings;
