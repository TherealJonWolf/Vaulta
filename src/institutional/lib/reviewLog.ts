import { supabase } from "@/integrations/supabase/client";

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
    notes: entry.notes ?? null,
    metadata: entry.metadata ?? {},
  };
  const { error } = await (supabase.from as any)("institutional_review_logs").insert(payload);
  if (error) throw error;
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