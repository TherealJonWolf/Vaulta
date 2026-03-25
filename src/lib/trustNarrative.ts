import { supabase } from "@/integrations/supabase/client";

export type ScoreState = "clear" | "review" | "flag" | "insufficient";

export interface TrustNarrative {
  id: string;
  user_id: string;
  assessment_id: string;
  institution_type: string;
  institution_name: string | null;
  score_state: ScoreState;
  trust_score: number | null;
  narrative_text: string;
  document_count: number;
  history_months: number | null;
  flag_count: number;
  assessed_at: string;
  created_at: string;
  metadata: Record<string, unknown>;
}

interface NarrativeInput {
  institutionName: string;
  trustScore: number | null;
  documentCount: number;
  historyMonths: number | null;
  flagCount: number;
  negativeFactors: string[];
}

export function deriveScoreState(
  trustScore: number | null,
  documentCount: number,
  flagCount: number
): ScoreState {
  if (documentCount === 0 || trustScore === null) return "insufficient";
  if (flagCount > 0 || trustScore < 30) return "flag";
  if (trustScore < 70) return "review";
  return "clear";
}

export function generateNarrativeText(
  state: ScoreState,
  input: NarrativeInput
): string {
  const inst = input.institutionName || "The institution";
  const months = input.historyMonths ?? 0;

  switch (state) {
    case "clear":
      return (
        `${inst} requires documented financial history before making a lending or housing decision. ` +
        `The documents submitted reflect ${months} month${months !== 1 ? "s" : ""} of consistent income and payment history. ` +
        `No indicators of tampering, reuse, or fraud were detected during assessment. ` +
        `${inst} now has an assessed basis to proceed.`
      );

    case "review":
      return (
        `${inst} requires documented financial history before making a lending or housing decision. ` +
        `The documents submitted reflect ${months} month${months !== 1 ? "s" : ""} of available history, though some records were limited in scope or duration. ` +
        `No fraud indicators were detected, but the picture is incomplete. ` +
        `${inst} has the information available to determine how to proceed.`
      );

    case "flag":
      return (
        `${inst} requires documented financial history before making a lending or housing decision. ` +
        `The documents submitted could not be fully assessed. ` +
        `Inconsistencies were detected in ${input.flagCount} of the submitted records during multi-layer assessment. ` +
        `${inst} has the findings it needs to make an informed decision about how to proceed.`
      );

    case "insufficient":
      return (
        `${inst} requires documented financial history before making a lending or housing decision. ` +
        `The documents submitted were insufficient to complete a full assessment. ` +
        `Additional records would be needed to produce a trust score. ` +
        `${inst} may request that the applicant submit further documentation through Vaulta.`
      );
  }
}

export async function createNarrative(
  userId: string,
  assessmentId: string,
  institutionName: string,
  institutionType: string,
  trustScore: number | null,
  documentCount: number,
  historyMonths: number | null,
  flagCount: number,
  negativeFactors: string[]
): Promise<TrustNarrative | null> {
  const scoreState = deriveScoreState(trustScore, documentCount, flagCount);
  const narrativeText = generateNarrativeText(scoreState, {
    institutionName,
    trustScore,
    documentCount,
    historyMonths,
    flagCount,
    negativeFactors,
  });

  const { data, error } = await (supabase.from("trust_narratives") as any)
    .insert({
      user_id: userId,
      assessment_id: assessmentId,
      institution_type: institutionType,
      institution_name: institutionName,
      score_state: scoreState,
      trust_score: trustScore,
      narrative_text: narrativeText,
      document_count: documentCount,
      history_months: historyMonths,
      flag_count: flagCount,
      metadata: {
        negative_factors: negativeFactors,
        generated_version: 1,
      },
    })
    .select()
    .single();

  if (error) {
    console.error("Failed to create narrative:", error);
    return null;
  }
  return data as TrustNarrative;
}

export async function getNarrativesForApplicant(
  applicantUserId: string
): Promise<TrustNarrative[]> {
  const { data, error } = await (supabase.from("trust_narratives") as any)
    .select("*")
    .eq("user_id", applicantUserId)
    .order("assessed_at", { ascending: false });

  if (error) {
    console.error("Failed to fetch narratives:", error);
    return [];
  }
  return (data ?? []) as TrustNarrative[];
}

export function getScoreStateConfig(state: ScoreState) {
  const configs = {
    clear: {
      label: "Clear",
      borderColor: "border-l-emerald-500",
      textColor: "text-emerald-600",
      bgColor: "bg-emerald-500",
      badgeVariant: "default" as const,
    },
    review: {
      label: "Review",
      borderColor: "border-l-yellow-500",
      textColor: "text-yellow-600",
      bgColor: "bg-yellow-500",
      badgeVariant: "secondary" as const,
    },
    flag: {
      label: "Flag",
      borderColor: "border-l-red-500",
      textColor: "text-red-600",
      bgColor: "bg-red-500",
      badgeVariant: "destructive" as const,
    },
    insufficient: {
      label: "Insufficient",
      borderColor: "border-l-gray-400",
      textColor: "text-muted-foreground",
      bgColor: "bg-gray-400",
      badgeVariant: "outline" as const,
    },
  };
  return configs[state];
}
