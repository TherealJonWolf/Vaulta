// Client helper for the Phase 1 multi-signal trust enhancement.
//
// Centralizes:
//   - the canonical SignalCategory enum (mirrors the DB enum)
//   - the exact consent text shown to users (hashed by the edge function
//     so we can later prove which version they agreed to)
//   - a thin wrapper around the record-signal-consent edge function
//   - a one-shot seed for categories that are implicitly consented
//     elsewhere in the product (identity verification via Veriff,
//     document consistency via the upload flow)
//
// Integration point: Phase 3 will add a SignalConsentPanel that imports
// from this module. Phase 2's evaluate-context-signals function reads
// signal_consents directly server-side; it does not need this helper.

import { supabase } from "@/integrations/supabase/client";

export type SignalCategory =
  | "device_consistency"
  | "geolocation_context"
  | "behavioral_pattern"
  | "utility_corroboration"
  | "cross_account"
  | "identity_verification"
  | "document_consistency";

export const SIGNAL_CATEGORIES: SignalCategory[] = [
  "device_consistency",
  "geolocation_context",
  "behavioral_pattern",
  "utility_corroboration",
  "cross_account",
  "identity_verification",
  "document_consistency",
];

// Versioned, human-readable consent text. Bump the version suffix when
// the wording changes; the edge function hashes whatever is sent so
// historical consents remain verifiable.
export const CONSENT_TEXT: Record<SignalCategory, string> = {
  device_consistency:
    "v1: I allow Vaulta to evaluate whether the devices I use to access my vault behave consistently over time, to strengthen my trust profile.",
  geolocation_context:
    "v1: I allow Vaulta to use approximate location signals from my device to detect unusual access patterns. Raw coordinates are never shared with landlords or lenders.",
  behavioral_pattern:
    "v1: I allow Vaulta to analyze general session rhythm (such as typing cadence and navigation flow) to detect anomalies. No keystrokes or content are recorded.",
  utility_corroboration:
    "v1: I allow Vaulta to corroborate that an external utility, banking, or service account exists in my name as an additional positive trust signal.",
  cross_account:
    "v1: I allow Vaulta to compare anonymized signals across accounts to detect coordinated fraud patterns. This signal can only lower trust, never raise it.",
  identity_verification:
    "v1: I consent to identity verification via Veriff being used as a positive trust signal in my profile.",
  document_consistency:
    "v1: I consent to the documents I upload being analyzed by Vaulta's verification pipeline as a trust signal.",
};

export interface RecordedConsent {
  category: SignalCategory;
  granted: boolean;
  granted_at: string | null;
  revoked_at: string | null;
  source: string;
}

export interface RecordConsentOptions {
  source?: "vault_settings" | "onboarding" | "system_default";
}

/**
 * Record (grant or revoke) a per-category signal consent decision.
 * Routes through the edge function so the consent text hash and the
 * security_events audit row are computed server-side.
 */
export async function recordSignalConsent(
  category: SignalCategory,
  granted: boolean,
  options: RecordConsentOptions = {},
): Promise<RecordedConsent> {
  const consent_text = CONSENT_TEXT[category];
  if (!consent_text) {
    throw new Error(`Unknown signal category: ${category}`);
  }

  const { data, error } = await supabase.functions.invoke(
    "record-signal-consent",
    {
      body: {
        category,
        granted,
        consent_text,
        source: options.source ?? "vault_settings",
      },
    },
  );

  if (error) {
    throw new Error(error.message ?? "Failed to record consent");
  }
  if (!data?.ok) {
    throw new Error(data?.error ?? "Consent rejected");
  }
  return data.consent as RecordedConsent;
}

/**
 * Fetch the current consent state for the authenticated user across all
 * categories. Categories with no row default to "not granted".
 */
export async function fetchSignalConsents(): Promise<
  Record<SignalCategory, RecordedConsent | null>
> {
  const { data, error } = await supabase
    .from("signal_consents")
    .select("category, granted, granted_at, revoked_at, source");

  if (error) throw error;

  const result = Object.fromEntries(
    SIGNAL_CATEGORIES.map((c) => [c, null]),
  ) as Record<SignalCategory, RecordedConsent | null>;

  for (const row of data ?? []) {
    result[row.category as SignalCategory] = row as RecordedConsent;
  }
  return result;
}

/**
 * Seed the two categories that are implicitly consented elsewhere in
 * Vaulta (Veriff identity verification, document uploads). Idempotent:
 * the upsert in the edge function makes repeat calls safe.
 *
 * Call this once after a user completes Veriff or their first upload.
 * Phase 1 ships the helper; the integration call sites are added in a
 * later phase to keep this slice purely additive.
 */
export async function seedImplicitConsents(): Promise<void> {
  await Promise.all([
    recordSignalConsent("identity_verification", true, { source: "system_default" }),
    recordSignalConsent("document_consistency", true, { source: "system_default" }),
  ]);
}
