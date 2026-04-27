/**
 * Decision-Grade Trust Output
 *
 * Derives structured, decision-support classifications from existing
 * narrative + assessment data. This is a presentation/derivation layer —
 * it does NOT change scoring logic or persisted data.
 *
 * Used by:
 *   - TrustNarrativeCard (UI)
 *   - narrativePdfExport (client PDF)
 *   - institutional-pdf-export edge function (server PDF) — duplicated
 *     server-side because edge functions cannot import client modules.
 */

import type { ScoreState } from "@/lib/trustNarrative";

export type DecisionStatus =
  | "APPROVED"
  | "CONDITIONALLY APPROVED"
  | "NOT RECOMMENDED"
  | "INSUFFICIENT DATA";

export type RiskLevel = "LOW" | "MODERATE" | "HIGH" | "UNDETERMINED";

export type SignalStatus =
  | "PASSED"
  | "PARTIAL"
  | "FAILED"
  | "VERIFIED"
  | "UNVERIFIED"
  | "CONFIRMED"
  | "INSUFFICIENT DATA"
  | "NONE DETECTED"
  | "FLAGGED"
  | "REVIEWED";

export type SignalImpact = "POSITIVE" | "NEUTRAL" | "NEGATIVE";

export interface SignalRow {
  category:
    | "Identity Verification"
    | "Document Authenticity"
    | "Behavioral Consistency"
    | "Cross-Account Risk";
  status: SignalStatus;
  impact: SignalImpact;
}

export interface DecisionGradeOutput {
  classification: "PROVISIONAL TRUST CLASSIFICATION";
  status: DecisionStatus;
  riskLevel: RiskLevel;
  actionGuidance: string;
  signals: SignalRow[];
  interpretation: {
    systemBelief: string;
    uncertaintyCause: string;
    additionalDataNeeded: string;
  };
  complianceStatement: string;
}

export interface DecisionGradeInput {
  scoreState: ScoreState;
  trustScore: number | null;
  documentCount: number;
  historyMonths: number | null;
  flagCount: number;
  institutionName?: string | null;
}

export const COMPLIANCE_STATEMENT =
  "This report reflects consented and verifiable signals available at the " +
  "time of evaluation and is intended to support consistent, fair, and " +
  "auditable decision-making.";

function deriveStatus(state: ScoreState, score: number | null): DecisionStatus {
  switch (state) {
    case "clear":
      return "APPROVED";
    case "review":
      return "CONDITIONALLY APPROVED";
    case "flag":
      return "NOT RECOMMENDED";
    case "insufficient":
    default:
      return "INSUFFICIENT DATA";
  }
}

function deriveRisk(state: ScoreState, flagCount: number): RiskLevel {
  if (state === "insufficient") return "UNDETERMINED";
  if (state === "flag" || flagCount > 0) return "HIGH";
  if (state === "review") return "MODERATE";
  return "LOW";
}

function deriveActionGuidance(status: DecisionStatus): string {
  switch (status) {
    case "APPROVED":
      return "Proceed with standard onboarding. No additional verification required.";
    case "CONDITIONALLY APPROVED":
      return "Proceed with standard guarantor, deposit, or co-signer terms as applicable.";
    case "NOT RECOMMENDED":
      return "Do not advance without independent verification of the flagged items.";
    case "INSUFFICIENT DATA":
      return "Request additional documentation through Vaulta before deciding.";
  }
}

function deriveSignals(input: DecisionGradeInput): SignalRow[] {
  const { scoreState, documentCount, historyMonths, flagCount } = input;
  const months = historyMonths ?? 0;

  // Identity Verification — proxied from document presence + flag absence
  const identity: SignalRow = (() => {
    if (documentCount === 0)
      return { category: "Identity Verification", status: "INSUFFICIENT DATA", impact: "NEUTRAL" };
    if (flagCount > 0)
      return { category: "Identity Verification", status: "PARTIAL", impact: "NEGATIVE" };
    return { category: "Identity Verification", status: "PASSED", impact: "POSITIVE" };
  })();

  // Document Authenticity — driven by flag count
  const authenticity: SignalRow = (() => {
    if (documentCount === 0)
      return { category: "Document Authenticity", status: "INSUFFICIENT DATA", impact: "NEUTRAL" };
    if (flagCount > 0)
      return { category: "Document Authenticity", status: "UNVERIFIED", impact: "NEGATIVE" };
    return { category: "Document Authenticity", status: "VERIFIED", impact: "POSITIVE" };
  })();

  // Behavioral Consistency — driven by history depth
  const behavioral: SignalRow = (() => {
    if (months >= 6)
      return { category: "Behavioral Consistency", status: "CONFIRMED", impact: "POSITIVE" };
    if (months >= 2)
      return { category: "Behavioral Consistency", status: "PARTIAL", impact: "NEUTRAL" };
    return { category: "Behavioral Consistency", status: "INSUFFICIENT DATA", impact: "NEUTRAL" };
  })();

  // Cross-Account Risk — driven by score state
  const crossAccount: SignalRow = (() => {
    if (scoreState === "flag")
      return { category: "Cross-Account Risk", status: "FLAGGED", impact: "NEGATIVE" };
    if (scoreState === "review")
      return { category: "Cross-Account Risk", status: "REVIEWED", impact: "NEUTRAL" };
    if (scoreState === "insufficient")
      return { category: "Cross-Account Risk", status: "INSUFFICIENT DATA", impact: "NEUTRAL" };
    return { category: "Cross-Account Risk", status: "NONE DETECTED", impact: "POSITIVE" };
  })();

  return [identity, authenticity, behavioral, crossAccount];
}

function deriveInterpretation(
  input: DecisionGradeInput,
  status: DecisionStatus
): DecisionGradeOutput["interpretation"] {
  const months = input.historyMonths ?? 0;

  switch (status) {
    case "APPROVED":
      return {
        systemBelief:
          "The applicant presents a consistent, verifiable trust profile across all evaluated categories.",
        uncertaintyCause: "No material uncertainty was identified.",
        additionalDataNeeded: "None. The current evidence base supports a confident decision.",
      };
    case "CONDITIONALLY APPROVED":
      return {
        systemBelief:
          "The applicant presents a verifiable profile with no fraud indicators, but the evidence base is narrower than ideal.",
        uncertaintyCause: `History depth (${months} month${months !== 1 ? "s" : ""}) limits the strength of behavioral inference.`,
        additionalDataNeeded:
          "Additional months of payment or income history, or one secondary verification document, would strengthen the classification.",
      };
    case "NOT RECOMMENDED":
      return {
        systemBelief:
          "One or more submitted records contain inconsistencies that materially affect document authenticity.",
        uncertaintyCause: `${input.flagCount} record${input.flagCount !== 1 ? "s" : ""} failed multi-layer authenticity checks.`,
        additionalDataNeeded:
          "Independent re-issuance of the flagged documents from the originating source would change the outcome.",
      };
    case "INSUFFICIENT DATA":
    default:
      return {
        systemBelief:
          "The submitted evidence base is too narrow to form a defensible classification.",
        uncertaintyCause: "Document coverage is below the minimum required for assessment.",
        additionalDataNeeded:
          "Additional identity, income, or residency documentation submitted through Vaulta would enable a complete assessment.",
      };
  }
}

export function deriveDecisionGrade(input: DecisionGradeInput): DecisionGradeOutput {
  const status = deriveStatus(input.scoreState, input.trustScore);
  const riskLevel = deriveRisk(input.scoreState, input.flagCount);
  return {
    classification: "PROVISIONAL TRUST CLASSIFICATION",
    status,
    riskLevel,
    actionGuidance: deriveActionGuidance(status),
    signals: deriveSignals(input),
    interpretation: deriveInterpretation(input, status),
    complianceStatement: COMPLIANCE_STATEMENT,
  };
}

export function statusBadgeColor(status: DecisionStatus): {
  hsl: string;
  rgb: [number, number, number];
} {
  switch (status) {
    case "APPROVED":
      return { hsl: "142 71% 45%", rgb: [16, 185, 129] };
    case "CONDITIONALLY APPROVED":
      return { hsl: "38 92% 50%", rgb: [234, 179, 8] };
    case "NOT RECOMMENDED":
      return { hsl: "0 84% 60%", rgb: [239, 68, 68] };
    case "INSUFFICIENT DATA":
      return { hsl: "215 14% 52%", rgb: [156, 163, 175] };
  }
}

export function impactColor(impact: SignalImpact): [number, number, number] {
  switch (impact) {
    case "POSITIVE":
      return [16, 185, 129];
    case "NEGATIVE":
      return [239, 68, 68];
    case "NEUTRAL":
      return [120, 130, 140];
  }
}