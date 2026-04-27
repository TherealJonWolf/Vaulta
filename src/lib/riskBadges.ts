/**
 * Risk badge derivation for institutional review.
 * Translates raw submission + signal data into "WHY" badges
 * a landlord/lender can scan in <2 seconds.
 */
export type RiskBadgeSeverity = "high" | "medium" | "low" | "info";

export interface RiskBadge {
  code: string;
  label: string;
  severity: RiskBadgeSeverity;
  detail: string;
}

export interface RiskBadgeInput {
  trustScore: number | null;
  scoreState: string;
  documentCount: number;
  documentTypes?: string[] | null;
  hasIncomeDoc?: boolean;
  consistencyFindings?: number;
  deviceAlerts?: number;
  geographicAnomaly?: boolean;
  documentIntegrityIssues?: number;
  ipMismatch?: boolean;
}

export const deriveRiskBadges = (input: RiskBadgeInput): RiskBadge[] => {
  const badges: RiskBadge[] = [];
  const score = input.trustScore ?? 0;

  if (input.scoreState === "insufficient" || input.documentCount === 0) {
    badges.push({
      code: "INSUFFICIENT_DATA",
      label: "Insufficient Data",
      severity: "info",
      detail: "Not enough documents submitted to form a complete signal profile.",
    });
  }

  if (input.scoreState === "review" || (score > 0 && score < 60)) {
    if (input.documentIntegrityIssues && input.documentIntegrityIssues > 0) {
      badges.push({
        code: "DOC_INTEGRITY",
        label: "Document Integrity Warning",
        severity: "high",
        detail: "One or more documents failed an integrity check (hash mismatch, tampering signal, or invalid encryption).",
      });
    }
    if (input.consistencyFindings && input.consistencyFindings > 0) {
      badges.push({
        code: "INCOME_VARIANCE",
        label: "Income Variance Detected",
        severity: "medium",
        detail: "Cross-document income figures show variance beyond the expected tolerance band.",
      });
    }
    if (input.deviceAlerts && input.deviceAlerts > 0) {
      badges.push({
        code: "DEVICE_CHANGE",
        label: "High-Frequency Device Change",
        severity: "medium",
        detail: "Unusually frequent device or session changes were observed during the submission window.",
      });
    }
    if (input.geographicAnomaly) {
      badges.push({
        code: "GEO_ANOMALY",
        label: "Geographic Anomaly",
        severity: "medium",
        detail: "Submission origin or session geography is inconsistent with the applicant's stated location.",
      });
    }
    if (input.ipMismatch) {
      badges.push({
        code: "IP_MISMATCH",
        label: "IP Address Mismatch",
        severity: "low",
        detail: "Recorded IP addresses do not match across the session — common with VPN usage but worth confirming.",
      });
    }
  }

  if (input.scoreState === "flag") {
    badges.push({
      code: "FLAGGED",
      label: "System Flag Active",
      severity: "high",
      detail: "One or more system flags require manual resolution before this profile can be considered.",
    });
  }

  return badges;
};

export const badgeStyle = (severity: RiskBadgeSeverity): string => {
  switch (severity) {
    case "high":
      return "bg-red-50 text-red-700 border-red-200";
    case "medium":
      return "bg-amber-50 text-amber-800 border-amber-200";
    case "low":
      return "bg-blue-50 text-blue-700 border-blue-200";
    default:
      return "bg-slate-50 text-slate-600 border-slate-200";
  }
};