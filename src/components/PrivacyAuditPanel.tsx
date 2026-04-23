import { useEffect, useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, RefreshCw, ShieldCheck, ShieldOff, EyeOff, FileText, Activity, KeyRound } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  CONSENT_TEXT,
  SIGNAL_CATEGORIES,
  type SignalCategory,
} from "@/lib/signalConsent";

/**
 * Privacy & Encryption Audit Panel
 * --------------------------------
 * Read-only, user-scoped surface that lets a vault owner verify three
 * things end-to-end without leaving the app:
 *
 *   1. Encryption status of each document (E2E IV + key-hash present)
 *   2. Redacted fields recorded server-side on each telemetry event
 *      (written by ingest-device-telemetry when geolocation consent
 *      is missing)
 *   3. The live consent-hash version per signal category, alongside the
 *      grant state recorded in signal_consents
 *
 * Strictly additive: no schema changes, no business logic, no edge
 * function changes. Pulls from existing tables under each table's RLS.
 */

interface PrivacyAuditPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface DocumentAuditRow {
  id: string;
  file_name: string;
  created_at: string;
  encrypted_iv: string | null;
  encryption_key_hash: string | null;
  source: string | null;
}

interface TelemetryAuditRow {
  id: string;
  event_type: string;
  client_timestamp: string;
  trace_id: string;
  is_valid: boolean;
  metadata: Record<string, unknown> | null;
  validation_errors: string[] | null;
}

interface ConsentRow {
  category: SignalCategory;
  granted: boolean;
  granted_at: string | null;
  revoked_at: string | null;
  source: string;
}

// Pull the leading "vN:" version tag off the canonical consent text so
// users see exactly which wording they agreed to.
const extractVersion = (text: string): string => {
  const match = text.match(/^(v\d+):/);
  return match ? match[1] : "unversioned";
};

// Compute the SHA-256 of a string the same way the edge function does
// server-side, so users can independently verify the hash on display.
const sha256Hex = async (input: string): Promise<string> => {
  const buf = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
};

const shortHash = (hex: string): string =>
  hex.length > 16 ? `${hex.slice(0, 8)}…${hex.slice(-6)}` : hex;

const formatTime = (iso: string): string => {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
};

export const PrivacyAuditPanel = ({ open, onOpenChange }: PrivacyAuditPanelProps) => {
  const [loading, setLoading] = useState(false);
  const [documents, setDocuments] = useState<DocumentAuditRow[]>([]);
  const [telemetry, setTelemetry] = useState<TelemetryAuditRow[]>([]);
  const [consents, setConsents] = useState<Record<SignalCategory, ConsentRow | null>>(
    Object.fromEntries(SIGNAL_CATEGORIES.map((c) => [c, null])) as Record<SignalCategory, ConsentRow | null>,
  );
  const [consentHashes, setConsentHashes] = useState<Record<SignalCategory, string>>(
    Object.fromEntries(SIGNAL_CATEGORIES.map((c) => [c, ""])) as Record<SignalCategory, string>,
  );

  const consentVersions = useMemo(() => {
    return Object.fromEntries(
      SIGNAL_CATEGORIES.map((c) => [c, extractVersion(CONSENT_TEXT[c])]),
    ) as Record<SignalCategory, string>;
  }, []);

  const loadAll = async () => {
    setLoading(true);
    try {
      const [docsRes, telRes, consRes] = await Promise.all([
        supabase
          .from("documents")
          .select("id, file_name, created_at, encrypted_iv, encryption_key_hash, source")
          .order("created_at", { ascending: false })
          .limit(50),
        supabase
          .from("device_telemetry_events")
          .select("id, event_type, client_timestamp, trace_id, is_valid, metadata, validation_errors")
          .order("client_timestamp", { ascending: false })
          .limit(50),
        supabase
          .from("signal_consents")
          .select("category, granted, granted_at, revoked_at, source"),
      ]);

      if (!docsRes.error && docsRes.data) {
        setDocuments(docsRes.data as DocumentAuditRow[]);
      }
      if (!telRes.error && telRes.data) {
        setTelemetry(telRes.data as TelemetryAuditRow[]);
      }
      if (!consRes.error && consRes.data) {
        const next = Object.fromEntries(
          SIGNAL_CATEGORIES.map((c) => [c, null]),
        ) as Record<SignalCategory, ConsentRow | null>;
        for (const row of consRes.data as ConsentRow[]) {
          next[row.category] = row;
        }
        setConsents(next);
      }

      // Compute the hash of each canonical consent text so the user can
      // visually compare the prefix with what their record stores.
      const hashEntries = await Promise.all(
        SIGNAL_CATEGORIES.map(async (c) => [c, await sha256Hex(CONSENT_TEXT[c])] as const),
      );
      setConsentHashes(Object.fromEntries(hashEntries) as Record<SignalCategory, string>);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Aggregate counters for the at-a-glance header strip.
  const encryptedDocCount = documents.filter(
    (d) => d.encrypted_iv && d.encryption_key_hash,
  ).length;
  const redactedTelemetryCount = telemetry.filter((t) => {
    const meta = (t.metadata ?? {}) as { redacted_fields?: unknown };
    return Array.isArray(meta.redacted_fields) && meta.redacted_fields.length > 0;
  }).length;
  const grantedConsentCount = SIGNAL_CATEGORIES.filter(
    (c) => consents[c]?.granted === true,
  ).length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="text-primary" size={20} />
            Privacy & Encryption Audit
          </DialogTitle>
          <DialogDescription>
            Verify end-to-end encryption status, server-side field redactions, and
            the consent-hash version on record for every category.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 py-2">
          <div className="cyber-border rounded-lg p-3">
            <div className="flex items-center gap-2 text-muted-foreground text-xs font-mono uppercase">
              <FileText size={14} /> Encrypted Documents
            </div>
            <div className="mt-1 text-2xl font-display font-bold text-primary">
              {encryptedDocCount}<span className="text-sm text-muted-foreground"> / {documents.length}</span>
            </div>
          </div>
          <div className="cyber-border rounded-lg p-3">
            <div className="flex items-center gap-2 text-muted-foreground text-xs font-mono uppercase">
              <EyeOff size={14} /> Redacted Telemetry
            </div>
            <div className="mt-1 text-2xl font-display font-bold text-accent">
              {redactedTelemetryCount}<span className="text-sm text-muted-foreground"> / {telemetry.length}</span>
            </div>
          </div>
          <div className="cyber-border rounded-lg p-3">
            <div className="flex items-center gap-2 text-muted-foreground text-xs font-mono uppercase">
              <KeyRound size={14} /> Consents Granted
            </div>
            <div className="mt-1 text-2xl font-display font-bold text-secure-green">
              {grantedConsentCount}<span className="text-sm text-muted-foreground"> / {SIGNAL_CATEGORIES.length}</span>
            </div>
          </div>
        </div>

        <div className="flex justify-end">
          <Button variant="outline" size="sm" onClick={loadAll} disabled={loading}>
            {loading ? <Loader2 className="mr-2 animate-spin" size={14} /> : <RefreshCw className="mr-2" size={14} />}
            Refresh
          </Button>
        </div>

        <Tabs defaultValue="documents" className="flex-1 overflow-hidden flex flex-col">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="documents">
              <FileText size={14} className="mr-2" /> Documents
            </TabsTrigger>
            <TabsTrigger value="telemetry">
              <Activity size={14} className="mr-2" /> Telemetry
            </TabsTrigger>
            <TabsTrigger value="consents">
              <KeyRound size={14} className="mr-2" /> Consents
            </TabsTrigger>
          </TabsList>

          <TabsContent value="documents" className="flex-1 overflow-hidden">
            <ScrollArea className="h-[50vh] rounded-md border border-border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>File</TableHead>
                    <TableHead>Source</TableHead>
                    <TableHead>E2E Status</TableHead>
                    <TableHead>IV</TableHead>
                    <TableHead>Key Hash</TableHead>
                    <TableHead>Uploaded</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {documents.length === 0 && !loading && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                        No documents in your vault yet.
                      </TableCell>
                    </TableRow>
                  )}
                  {documents.map((doc) => {
                    const encrypted = Boolean(doc.encrypted_iv && doc.encryption_key_hash);
                    return (
                      <TableRow key={doc.id}>
                        <TableCell className="font-mono text-xs max-w-[220px] truncate">{doc.file_name}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{doc.source ?? "upload"}</TableCell>
                        <TableCell>
                          {encrypted ? (
                            <Badge variant="default" className="bg-secure-green/20 text-secure-green border-secure-green/40">
                              <ShieldCheck size={12} className="mr-1" /> E2E Encrypted
                            </Badge>
                          ) : (
                            <Badge variant="destructive">
                              <ShieldOff size={12} className="mr-1" /> Plaintext
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="font-mono text-xs">
                          {doc.encrypted_iv ? shortHash(doc.encrypted_iv) : <span className="text-muted-foreground">—</span>}
                        </TableCell>
                        <TableCell className="font-mono text-xs">
                          {doc.encryption_key_hash ? shortHash(doc.encryption_key_hash) : <span className="text-muted-foreground">—</span>}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">{formatTime(doc.created_at)}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="telemetry" className="flex-1 overflow-hidden">
            <ScrollArea className="h-[50vh] rounded-md border border-border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Event</TableHead>
                    <TableHead>Trace</TableHead>
                    <TableHead>Valid</TableHead>
                    <TableHead>Redacted Fields</TableHead>
                    <TableHead>When</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {telemetry.length === 0 && !loading && (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                        No telemetry events recorded for your account.
                      </TableCell>
                    </TableRow>
                  )}
                  {telemetry.map((evt) => {
                    const meta = (evt.metadata ?? {}) as { redacted_fields?: unknown; redaction_reason?: unknown };
                    const redacted = Array.isArray(meta.redacted_fields)
                      ? (meta.redacted_fields as string[])
                      : [];
                    const reason = typeof meta.redaction_reason === "string" ? meta.redaction_reason : null;
                    return (
                      <TableRow key={evt.id}>
                        <TableCell className="font-mono text-xs">{evt.event_type}</TableCell>
                        <TableCell className="font-mono text-xs">{shortHash(evt.trace_id)}</TableCell>
                        <TableCell>
                          {evt.is_valid ? (
                            <Badge variant="outline" className="text-secure-green border-secure-green/40">valid</Badge>
                          ) : (
                            <Badge variant="destructive">invalid</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          {redacted.length > 0 ? (
                            <div className="flex flex-col gap-1">
                              <div className="flex flex-wrap gap-1">
                                {redacted.map((f) => (
                                  <Badge key={f} variant="secondary" className="text-xs">
                                    <EyeOff size={10} className="mr-1" />{f}
                                  </Badge>
                                ))}
                              </div>
                              {reason && (
                                <span className="text-[10px] text-muted-foreground font-mono">{reason}</span>
                              )}
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground">none</span>
                          )}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">{formatTime(evt.client_timestamp)}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="consents" className="flex-1 overflow-hidden">
            <ScrollArea className="h-[50vh] rounded-md border border-border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Category</TableHead>
                    <TableHead>Version</TableHead>
                    <TableHead>State</TableHead>
                    <TableHead>Consent Text Hash (SHA-256)</TableHead>
                    <TableHead>Recorded</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {SIGNAL_CATEGORIES.map((cat) => {
                    const row = consents[cat];
                    const hash = consentHashes[cat] ?? "";
                    const granted = row?.granted === true;
                    const recordedAt = row?.granted_at ?? row?.revoked_at ?? null;
                    return (
                      <TableRow key={cat}>
                        <TableCell className="font-mono text-xs">{cat}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{consentVersions[cat]}</Badge>
                        </TableCell>
                        <TableCell>
                          {row === null ? (
                            <Badge variant="secondary">no record</Badge>
                          ) : granted ? (
                            <Badge variant="default" className="bg-secure-green/20 text-secure-green border-secure-green/40">granted</Badge>
                          ) : (
                            <Badge variant="destructive">revoked</Badge>
                          )}
                        </TableCell>
                        <TableCell className="font-mono text-xs">
                          {hash ? shortHash(hash) : <Loader2 className="animate-spin" size={12} />}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {recordedAt ? formatTime(recordedAt) : <span>—</span>}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </ScrollArea>
            <p className="text-[11px] text-muted-foreground mt-2 font-mono">
              The hash above is the SHA-256 of the canonical consent text shown in the
              Trust Signal Consents panel. The same hash is computed server-side and
              stored on each <span className="text-foreground">signal_consents</span> row,
              so you can independently verify which version you agreed to.
            </p>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};

export default PrivacyAuditPanel;