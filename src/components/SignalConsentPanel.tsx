// SignalConsentPanel — Phase 3 of the multi-signal trust enhancement.
//
// Surfaces every contextual signal category to the user with:
//   - the exact consent text the backend will hash (via signalConsent.ts)
//   - the current granted/revoked state pulled from `signal_consents`
//   - a switch to grant/revoke; revocations stop new projections immediately
//
// Integration points:
//   - signalConsent.ts owns the canonical category list + consent copy
//   - record-signal-consent edge function persists + audits the change
//   - evaluate-context-signals edge function reads the resulting rows
//     server-side; no business logic lives here
//   - ingest-device-telemetry uses these consents as a privacy gate to
//     drop or redact telemetry that the user has not opted into
import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { ShieldCheck, Lock, MapPin, Activity, Plug, Users, Fingerprint, FileCheck2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  CONSENT_TEXT,
  SIGNAL_CATEGORIES,
  fetchSignalConsents,
  recordSignalConsent,
  type SignalCategory,
  type RecordedConsent,
} from "@/lib/signalConsent";

const CATEGORY_META: Record<
  SignalCategory,
  { title: string; subtitle: string; icon: React.ComponentType<{ size?: number; className?: string }>; tone: "positive" | "negative" | "neutral" }
> = {
  device_consistency: {
    title: "Device Consistency",
    subtitle: "Recognizes the devices you usually access your vault from.",
    icon: ShieldCheck,
    tone: "positive",
  },
  geolocation_context: {
    title: "Geolocation Context",
    subtitle: "Coarse location patterns. Raw coordinates never leave Vaulta.",
    icon: MapPin,
    tone: "neutral",
  },
  behavioral_pattern: {
    title: "Behavioral Pattern",
    subtitle: "Session rhythm only. No keystrokes or content recorded.",
    icon: Activity,
    tone: "neutral",
  },
  utility_corroboration: {
    title: "Utility Corroboration",
    subtitle: "Confirms a utility/banking account exists in your name.",
    icon: Plug,
    tone: "positive",
  },
  cross_account: {
    title: "Cross-Account Anti-Fraud",
    subtitle: "Compares anonymized signals to detect coordinated fraud. Can only lower trust.",
    icon: Users,
    tone: "negative",
  },
  identity_verification: {
    title: "Identity Verification",
    subtitle: "Veriff result feeds your trust profile as a positive signal.",
    icon: Fingerprint,
    tone: "positive",
  },
  document_consistency: {
    title: "Document Consistency",
    subtitle: "Verification pipeline outputs feed your trust profile.",
    icon: FileCheck2,
    tone: "positive",
  },
};

interface SignalConsentPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SignalConsentPanel({ open, onOpenChange }: SignalConsentPanelProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [pending, setPending] = useState<SignalCategory | null>(null);
  const [consents, setConsents] = useState<Record<SignalCategory, RecordedConsent | null> | null>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    fetchSignalConsents()
      .then((rows) => {
        if (!cancelled) setConsents(rows);
      })
      .catch((err) => {
        console.error("[SignalConsentPanel] fetch failed", err);
        toast({
          variant: "destructive",
          title: "Could not load consents",
          description: err.message ?? "Please try again.",
        });
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, toast]);

  const isGranted = (cat: SignalCategory): boolean =>
    Boolean(consents?.[cat]?.granted);

  const handleToggle = async (cat: SignalCategory, next: boolean) => {
    setPending(cat);
    try {
      const updated = await recordSignalConsent(cat, next, { source: "vault_settings" });
      setConsents((prev) => (prev ? { ...prev, [cat]: updated } : prev));
      toast({
        title: next ? "Signal enabled" : "Signal revoked",
        description: next
          ? "New evaluations will include this category."
          : "No new signals will be projected for this category.",
      });
    } catch (err) {
      console.error("[SignalConsentPanel] toggle failed", err);
      toast({
        variant: "destructive",
        title: "Could not update consent",
        description: err instanceof Error ? err.message : "Please try again.",
      });
    } finally {
      setPending(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto bg-card border-border">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-display text-xl gradient-text">
            <Lock className="text-primary" size={22} />
            Trust Signal Consents
          </DialogTitle>
        </DialogHeader>

        <p className="text-sm text-muted-foreground">
          You control which contextual signals contribute to your trust profile.
          Revoking a category stops new evaluations immediately. Past records are
          retained for audit but no longer influence your score.
        </p>

        <div className="space-y-3 py-2">
          {SIGNAL_CATEGORIES.map((cat) => {
            const meta = CATEGORY_META[cat];
            const Icon = meta.icon;
            const granted = isGranted(cat);
            const toneClass =
              meta.tone === "positive"
                ? "text-emerald-500 border-emerald-500/30"
                : meta.tone === "negative"
                  ? "text-orange-500 border-orange-500/30"
                  : "text-primary border-primary/30";
            return (
              <Card key={cat} className="border-border bg-card/60">
                <CardContent className="pt-4 pb-4">
                  <div className="flex items-start gap-4">
                    <div className={`shrink-0 w-10 h-10 rounded-lg border flex items-center justify-center ${toneClass}`}>
                      <Icon size={20} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="font-display font-bold">{meta.title}</h4>
                        <Badge variant="outline" className="text-[10px] uppercase tracking-wider">
                          {meta.tone === "negative" ? "negative-only" : meta.tone}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">{meta.subtitle}</p>
                      <p className="text-[11px] text-muted-foreground/80 mt-2 italic">
                        {CONSENT_TEXT[cat]}
                      </p>
                    </div>
                    <div className="shrink-0">
                      <Switch
                        checked={granted}
                        disabled={loading || pending === cat}
                        onCheckedChange={(checked) => handleToggle(cat, checked)}
                        aria-label={`${meta.title} consent`}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <p className="text-[11px] text-muted-foreground/70">
          Each toggle records an auditable consent event. Vaulta hashes the
          consent text server-side so we can prove which version you agreed to.
        </p>
      </DialogContent>
    </Dialog>
  );
}

export default SignalConsentPanel;