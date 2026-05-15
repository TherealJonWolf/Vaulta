import { supabase } from "@/integrations/supabase/client";

/**
 * Trust Provenance: append-only event recording.
 *
 * Every entry in `trust_events` is immutable once inserted (server-side
 * trigger computes a SHA-256 `immutable_hash` and a second trigger blocks
 * updates to the protected columns). Reviewers can only update the
 * `review_status` / `reviewer_notes` fields.
 *
 * This helper is purely additive — it does not replace the existing trust
 * score or trust_report_snapshots system. It records *why* the score moved
 * so the Trust Timeline UI can show provenance.
 */

export type TrustEventSeverity = "info" | "low" | "moderate" | "high" | "critical";
export type TrustReviewStatus = "unreviewed" | "acknowledged" | "overridden" | "confirmed";

export interface TrustEventInput {
  user_id: string;
  event_type: string;          // e.g. "document.verified", "consistency.finding", "veriff.passed"
  source_system: string;       // e.g. "verify-document", "data-consistency-engine", "veriff-webhook", "user"
  trust_delta?: number;        // signed magnitude — positive raises evidence, negative lowers
  severity?: TrustEventSeverity;
  confidence?: number;         // 0-100
  explanation: string;         // plain-language rationale, never raw model output
  evidence_refs?: Array<Record<string, unknown>>;
  metadata?: Record<string, unknown>;
}

export interface TrustEvent extends TrustEventInput {
  id: string;
  trust_delta: number;
  severity: TrustEventSeverity;
  confidence: number;
  evidence_refs: Array<Record<string, unknown>>;
  metadata: Record<string, unknown>;
  reviewed_by: string | null;
  review_status: TrustReviewStatus;
  reviewed_at: string | null;
  reviewer_notes: string | null;
  reversed: boolean;
  reversed_by_event_id: string | null;
  immutable_hash: string;
  created_at: string;
}

export async function recordTrustEvent(input: TrustEventInput): Promise<TrustEvent | null> {
  const payload = {
    user_id: input.user_id,
    event_type: input.event_type,
    source_system: input.source_system,
    trust_delta: input.trust_delta ?? 0,
    severity: input.severity ?? "info",
    confidence: Math.max(0, Math.min(100, Math.round(input.confidence ?? 0))),
    explanation: input.explanation,
    evidence_refs: input.evidence_refs ?? [],
    metadata: input.metadata ?? {},
  };
  const { data, error } = await (supabase.from as any)("trust_events")
    .insert(payload)
    .select()
    .maybeSingle();
  if (error) {
    console.warn("[trustEvents] failed to record", error.message);
    return null;
  }
  return data as TrustEvent;
}

export async function fetchUserTrustTimeline(userId: string, limit = 200): Promise<TrustEvent[]> {
  const { data, error } = await (supabase.from as any)("trust_events")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) {
    console.warn("[trustEvents] failed to fetch", error.message);
    return [];
  }
  return (data || []) as TrustEvent[];
}