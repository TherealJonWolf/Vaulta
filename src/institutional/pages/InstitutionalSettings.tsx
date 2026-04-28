import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useInstitutionalAuth } from "../hooks/useInstitutionalAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2, Upload, Palette, Save } from "lucide-react";
import { Progress } from "@/components/ui/progress";

const ACCENT_PRESETS = [
  "#0f172a", "#1e40af", "#7c3aed", "#059669", "#dc2626",
  "#d97706", "#0891b2", "#4f46e5", "#be185d", "#334155",
];

const INSTITUTION_TYPES = [
  { value: "property_management", label: "Property Management Company" },
  { value: "mortgage_lender", label: "Mortgage Lender" },
  { value: "credit_union", label: "Credit Union" },
  { value: "bank", label: "Bank" },
  { value: "other", label: "Other" },
];

const InstitutionalSettings = () => {
  const { institutionId, institutionName } = useInstitutionalAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);

  // Fields
  const [displayName, setDisplayName] = useState("");
  const [accentColor, setAccentColor] = useState("#0f172a");
  const [welcomeMessage, setWelcomeMessage] = useState("");
  const [logoPath, setLogoPath] = useState<string | null>(null);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [signaturePath, setSignaturePath] = useState<string | null>(null);
  const [signatureFile, setSignatureFile] = useState<File | null>(null);
  const [signaturePreview, setSignaturePreview] = useState<string | null>(null);
  const [contactName, setContactName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [institutionType, setInstitutionType] = useState("other");
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [businessAddress, setBusinessAddress] = useState("");

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
      setSignaturePath(data.signature_path || null);
      setContactName(data.contact_name || "");
      setContactEmail(data.contact_email || "");
      setContactPhone(data.contact_phone || "");
      setInstitutionType(data.institution_type || "other");
      setWebsiteUrl(data.website_url || "");
      setBusinessAddress(data.business_address || "");
    } else {
      setDisplayName(institutionName || "");
    }
    setLoading(false);
  }, [institutionId, institutionName]);

  useEffect(() => { fetchSettings(); }, [fetchSettings]);

  const handleLogoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    // Reset so re-clicking works
    e.target.value = "";
    if (!file) return;
    if (!["image/png", "image/jpeg", "image/svg+xml", "image/webp"].includes(file.type)) {
      toast.error("Logo must be PNG, JPG, SVG, or WebP");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Logo must be under 5MB");
      return;
    }
    setLogoFile(file);
    setLogoPreview(URL.createObjectURL(file));
  };

  const handleSignatureSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!["image/png", "image/jpeg", "image/svg+xml", "image/webp"].includes(file.type)) {
      toast.error("Signature must be PNG, JPG, SVG, or WebP");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.error("Signature must be under 2MB");
      return;
    }
    setSignatureFile(file);
    setSignaturePreview(URL.createObjectURL(file));
  };

  const handleSave = async () => {
    if (!institutionId) return;
    setSaving(true);

    try {
      let finalLogoPath = logoPath;
      let finalSignaturePath = signaturePath;

      if (logoFile) {
        setUploadProgress(10);
        const ext = logoFile.name.split(".").pop();
        const path = `${institutionId}/logo-${Date.now()}.${ext}`;
        
        setUploadProgress(30);
        const { error: uploadError } = await supabase.storage
          .from("institution-logos")
          .upload(path, logoFile, { upsert: true, contentType: logoFile.type });
        
        if (uploadError) {
          console.error("Logo upload error:", uploadError);
          throw new Error(`Logo upload failed: ${uploadError.message}`);
        }
        
        setUploadProgress(70);
        const { data: urlData } = supabase.storage.from("institution-logos").getPublicUrl(path);
        finalLogoPath = urlData.publicUrl;
        setUploadProgress(90);
      }

      if (signatureFile) {
        const ext = signatureFile.name.split(".").pop();
        const path = `${institutionId}/signature-${Date.now()}.${ext}`;
        const { error: sigErr } = await supabase.storage
          .from("institution-logos")
          .upload(path, signatureFile, { upsert: true, contentType: signatureFile.type });
        if (sigErr) throw new Error(`Signature upload failed: ${sigErr.message}`);
        const { data: sigUrl } = supabase.storage.from("institution-logos").getPublicUrl(path);
        finalSignaturePath = sigUrl.publicUrl;
      }

      const settings = {
        institution_id: institutionId,
        display_name: displayName.trim() || null,
        accent_color: accentColor,
        welcome_message: welcomeMessage.trim() || null,
        logo_path: finalLogoPath,
        signature_path: finalSignaturePath,
        contact_name: contactName.trim() || null,
        contact_email: contactEmail.trim() || null,
        contact_phone: contactPhone.trim() || null,
        institution_type: institutionType,
        website_url: websiteUrl.trim() || null,
        business_address: businessAddress.trim() || null,
      };

      const { error } = await (supabase.from as any)("institution_settings")
        .upsert(settings, { onConflict: "institution_id" });

      if (error) {
        console.error("Settings save error:", error);
        throw new Error(`Save failed: ${error.message}`);
      }

      setLogoPath(finalLogoPath);
      setLogoFile(null);
      setSignaturePath(finalSignaturePath);
      setSignatureFile(null);
      setUploadProgress(100);
      setTimeout(() => setUploadProgress(null), 1000);
      toast.success("Settings saved successfully");
    } catch (err: any) {
      console.error("Save settings error:", err);
      toast.error(err.message || "Failed to save settings");
      setUploadProgress(null);
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

  const previewUrl = logoPreview || logoPath || null;
  const sigPreviewUrl = signaturePreview || signaturePath || null;

  return (
    <div className="p-8 max-w-2xl">
      <h1 className="text-xl font-semibold text-slate-900 mb-1">Institution Profile</h1>
      <p className="text-sm text-slate-500 mb-8">
        Manage your organization details. These appear on assessment exports and applicant-facing pages.
      </p>

      <div className="space-y-8">
        {/* Display Name */}
        <div className="space-y-2">
          <Label htmlFor="displayName" className="text-sm font-medium text-slate-700">Institution Name</Label>
          <Input id="displayName" value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Your organization name" className="max-w-md" />
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
              <p className="text-xs text-slate-400 mt-1">PNG, JPG, SVG, or WebP. Max 5MB.</p>
            </div>
          </div>
          {uploadProgress !== null && (
            <Progress value={uploadProgress} className="h-2 max-w-md" />
          )}
        </div>

        {/* Institution Type */}
        <div className="space-y-2">
          <Label className="text-sm font-medium text-slate-700">Institution Type</Label>
          <Select value={institutionType} onValueChange={setInstitutionType}>
            <SelectTrigger className="max-w-md">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {INSTITUTION_TYPES.map((t) => (
                <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Contact Info */}
        <div className="space-y-4">
          <h2 className="text-sm font-semibold text-slate-800 border-b border-slate-100 pb-2">Primary Contact</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-md">
            <div className="space-y-1">
              <Label htmlFor="contactName" className="text-xs text-slate-500">Full Name</Label>
              <Input id="contactName" value={contactName} onChange={(e) => setContactName(e.target.value)} placeholder="Jane Doe" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="contactEmail" className="text-xs text-slate-500">Email</Label>
              <Input id="contactEmail" type="email" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} placeholder="jane@company.com" />
            </div>
            <div className="space-y-1 md:col-span-2">
              <Label htmlFor="contactPhone" className="text-xs text-slate-500">Phone</Label>
              <Input id="contactPhone" type="tel" value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} placeholder="+1 (555) 000-0000" />
            </div>
          </div>
        </div>

        {/* Website & Address */}
        <div className="space-y-4">
          <h2 className="text-sm font-semibold text-slate-800 border-b border-slate-100 pb-2">Business Details</h2>
          <div className="space-y-3 max-w-md">
            <div className="space-y-1">
              <Label htmlFor="websiteUrl" className="text-xs text-slate-500">Website URL</Label>
              <Input id="websiteUrl" type="url" value={websiteUrl} onChange={(e) => setWebsiteUrl(e.target.value)} placeholder="https://yourcompany.com" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="businessAddress" className="text-xs text-slate-500">Business Address</Label>
              <Textarea id="businessAddress" value={businessAddress} onChange={(e) => setBusinessAddress(e.target.value)} placeholder="123 Main St, Suite 100&#10;City, State 12345" rows={3} />
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
              <button key={color} onClick={() => setAccentColor(color)}
                className={`h-8 w-8 rounded-full border-2 transition-all ${accentColor === color ? "border-slate-900 scale-110" : "border-transparent"}`}
                style={{ backgroundColor: color }} />
            ))}
            <Input type="color" value={accentColor} onChange={(e) => setAccentColor(e.target.value)} className="h-8 w-8 p-0 border-0 cursor-pointer" />
          </div>
        </div>

        {/* Welcome Message */}
        <div className="space-y-2">
          <Label htmlFor="welcome" className="text-sm font-medium text-slate-700">Welcome Message</Label>
          <Textarea id="welcome" value={welcomeMessage} onChange={(e) => setWelcomeMessage(e.target.value)}
            placeholder="Enter a message shown to applicants on the document submission page..." rows={4} className="max-w-md" />
          <p className="text-xs text-slate-400">Displayed to applicants when they open their submission link</p>
        </div>

        {/* Signature */}
        <div className="space-y-2">
          <Label className="text-sm font-medium text-slate-700">Authorized Signature Image</Label>
          <p className="text-xs text-slate-500">Embedded on adverse action notices and other generated PDFs. Use a transparent PNG for best results.</p>
          <div className="flex items-center gap-4 mt-2">
            {sigPreviewUrl ? (
              <div className="h-20 w-44 rounded border border-slate-200 bg-white flex items-center justify-center p-2">
                <img src={sigPreviewUrl} alt="Signature" className="max-h-full max-w-full object-contain" />
              </div>
            ) : (
              <div className="h-20 w-44 rounded border-2 border-dashed border-slate-200 flex items-center justify-center">
                <Upload className="h-5 w-5 text-slate-300" />
              </div>
            )}
            <label className="cursor-pointer inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium border border-slate-200 rounded-md hover:bg-slate-50 transition-colors">
              <Upload className="h-3.5 w-3.5" />
              Upload signature
              <input type="file" className="hidden" accept="image/png,image/jpeg,image/svg+xml,image/webp" onChange={handleSignatureSelect} />
            </label>
          </div>
        </div>

        {/* Preview */}
        <div className="border border-slate-200 rounded-lg p-4">
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-3">Preview</p>
          <div className="flex items-center gap-3 mb-3">
            {previewUrl && <img src={previewUrl} alt="Logo" className="h-8 w-8 rounded object-contain" />}
            <span className="font-semibold text-slate-900">{displayName || institutionName}</span>
          </div>
          {welcomeMessage && (
            <p className="text-sm text-slate-600 border-l-2 pl-3" style={{ borderColor: accentColor }}>{welcomeMessage}</p>
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
