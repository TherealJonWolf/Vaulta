import { supabase } from "@/integrations/supabase/client";
import type { SealedPayload } from "./institutionEncryption";
import { sealJsonForInstitution, openJsonFromInstitution } from "./institutionEncryption";

export interface ReviewLogEntry {
  institution_id: string;
  submission_id: string;
  reviewer_user_id: string;
  reviewer_name?: string | null;
  action: string;
  target_type?: string | null;
  target_id?: string | null;
  target_name?: string | null;
  badge_codes?: string[];
  notes?: string | null;
  metadata?: Record<string, unknown>;
}

export const recordReviewAction = async (entry: ReviewLogEntry) => {
  return recordReviewActionEncrypted(entry, null);
};

/**
 * Persist a review-log entry, encrypting reviewer notes + free-text metadata
 * under the institution's public key when one is provided. The server only
 * ever sees ciphertext for the sensitive fields.
 */
export const recordReviewActionEncrypted = async (
  entry: ReviewLogEntry,
  institutionPublicKey: CryptoKey | null,
) => {
  let encrypted: Partial<{ encrypted_note: string; note_wrapped_key: string; note_iv: string; encryption_version: string }> = {};
  let plaintextNotes: string | null = entry.notes ?? null;
  let plaintextMetadata: Record<string, unknown> = entry.metadata ?? {};

  if (institutionPublicKey && (entry.notes || (entry.metadata && Object.keys(entry.metadata).length > 0))) {
    const sealed: SealedPayload = await sealJsonForInstitution(
      { notes: entry.notes ?? null, metadata: entry.metadata ?? {} },
      institutionPublicKey,
    );
    encrypted = {
      encrypted_note: sealed.ciphertext_b64,
      note_wrapped_key: sealed.wrapped_key_b64,
      note_iv: sealed.iv_hex,
      encryption_version: sealed.version,
    };
    plaintextNotes = null;     // never persist plaintext alongside ciphertext
    plaintextMetadata = {};
  }

  const payload = {
    institution_id: entry.institution_id,
    submission_id: entry.submission_id,
    reviewer_user_id: entry.reviewer_user_id,
    reviewer_name: entry.reviewer_name ?? null,
    action: entry.action,
    target_type: entry.target_type ?? null,
    target_id: entry.target_id ?? null,
    target_name: entry.target_name ?? null,
    badge_codes: entry.badge_codes ?? [],
    notes: plaintextNotes,
    metadata: plaintextMetadata,
    ...encrypted,
  };
  const { error } = await (supabase.from as any)("institutional_review_logs").insert(payload);
  if (error) throw error;
};

/**
 * Decrypt sealed review-log rows in-place using the unwrapped institution key.
 * Rows without ciphertext are returned untouched.
 */
export const decryptReviewLogRows = async (
  rows: Array<Record<string, any>>,
  institutionPrivateKey: CryptoKey,
): Promise<Array<Record<string, any>>> => {
  return Promise.all(rows.map(async (row) => {
    if (!row.encrypted_note || !row.note_wrapped_key || !row.note_iv) return row;
    try {
      const opened = await openJsonFromInstitution<{ notes: string | null; metadata: Record<string, unknown> }>({
        ciphertext_b64: row.encrypted_note,
        iv_hex: row.note_iv,
        wrapped_key_b64: row.note_wrapped_key,
      }, institutionPrivateKey);
      return { ...row, notes: opened.notes, metadata: opened.metadata };
    } catch {
      return { ...row, notes: "[unable to decrypt]", metadata: {} };
    }
  }));
};

export const fetchReviewLog = async (submissionId: string) => {
  const { data, error } = await (supabase.from as any)("institutional_review_logs")
    .select("*")
    .eq("submission_id", submissionId)
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) throw error;
  return (data || []) as Array<Record<string, any>>;
};