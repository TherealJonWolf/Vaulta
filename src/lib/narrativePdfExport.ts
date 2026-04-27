import jsPDF from "jspdf";
import { type TrustNarrative, type ScoreState } from "@/lib/trustNarrative";
import { deriveDecisionGrade, statusBadgeColor, impactColor } from "@/lib/decisionGrade";

const COLORS = {
  brand: [0, 200, 200] as [number, number, number],       // Vaulta cyan
  dark: [10, 20, 30] as [number, number, number],
  text: [30, 40, 50] as [number, number, number],
  muted: [120, 130, 140] as [number, number, number],
  white: [255, 255, 255] as [number, number, number],
  clear: [16, 185, 129] as [number, number, number],      // emerald
  review: [234, 179, 8] as [number, number, number],      // yellow
  flag: [239, 68, 68] as [number, number, number],         // red
  insufficient: [156, 163, 175] as [number, number, number], // gray
};

function formatUtcDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", {
    year: "numeric", month: "long", day: "numeric",
    timeZone: "UTC",
  }) + " at " + d.toLocaleTimeString("en-US", {
    hour: "2-digit", minute: "2-digit", timeZone: "UTC",
  }) + " UTC";
}

export function exportNarrativePdf(narrative: TrustNarrative) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "letter" });
  const pw = doc.internal.pageSize.getWidth();
  const ph = doc.internal.pageSize.getHeight();
  const margin = 20;
  const contentWidth = pw - margin * 2;
  const decision = deriveDecisionGrade({
    scoreState: narrative.score_state as ScoreState,
    trustScore: narrative.trust_score,
    documentCount: narrative.document_count,
    historyMonths: narrative.history_months,
    flagCount: narrative.flag_count,
    institutionName: narrative.institution_name,
  });
  const statusColor = statusBadgeColor(decision.status).rgb;

  // ── Background ──
  doc.setFillColor(...COLORS.white);
  doc.rect(0, 0, pw, ph, "F");

  // ── Top accent bar ──
  doc.setFillColor(...COLORS.brand);
  doc.rect(0, 0, pw, 3, "F");

  // ── Header ──
  let y = 18;

  // Vaulta wordmark
  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  doc.setTextColor(...COLORS.dark);
  doc.text("VAULTA", margin, y);

  // TM symbol — offset further right to avoid overlap
  const vaultaWidth = doc.getTextWidth("VAULTA");
  doc.setFontSize(7);
  doc.text("\u2122", margin + vaultaWidth + 1, y - 5);

  // Right-aligned decision status badge
  doc.setFillColor(...statusColor);
  const badgeText = decision.status;
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  const badgeWidth = doc.getTextWidth(badgeText) + 10;
  const badgeX = pw - margin - badgeWidth;
  doc.roundedRect(badgeX, y - 6, badgeWidth, 8, 1.5, 1.5, "F");
  doc.setTextColor(...COLORS.white);
  doc.text(badgeText, badgeX + 5, y - 1);

  // ── Subheader ──
  y += 6;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...COLORS.muted);
  doc.text("PROVISIONAL TRUST CLASSIFICATION", margin, y);

  // ── Divider ──
  y += 5;
  doc.setDrawColor(...COLORS.brand);
  doc.setLineWidth(0.5);
  doc.line(margin, y, pw - margin, y);

  // ── Disclaimer ──
  y += 7;
  doc.setFont("helvetica", "italic");
  doc.setFontSize(7.5);
  doc.setTextColor(...COLORS.muted);
  const disclaimer =
    "For institutional use only. This document reflects the output of an automated " +
    "assessment and does not constitute a lending recommendation.";
  const disclaimerLines = doc.splitTextToSize(disclaimer, contentWidth);
  doc.text(disclaimerLines, margin, y);
  y += disclaimerLines.length * 3.5 + 4;

  // ── Status color bar on left ──
  doc.setFillColor(...statusColor);
  doc.rect(margin, y, 2.5, 56, "F");

  // ── Assessment details grid ──
  const detailX = margin + 7;

  const details: [string, string][] = [
    ["INSTITUTION", narrative.institution_name ?? "N/A"],
    ["ASSESSMENT ID", narrative.assessment_id.slice(0, 8).toUpperCase()],
    ["STATUS", decision.status],
    ["RISK LEVEL", decision.riskLevel],
    ["TRUST SCORE", narrative.trust_score !== null ? `${narrative.trust_score} / 100` : "N/A"],
    ["DOCUMENTS ASSESSED", String(narrative.document_count)],
    ["HISTORY DEPTH", narrative.history_months !== null ? `${narrative.history_months} months` : "N/A"],
  ];

  details.forEach(([label, value], i) => {
    const row = y + i * 7;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(...COLORS.muted);
    doc.text(label, detailX, row);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.setTextColor(...COLORS.dark);
    doc.text(value, detailX + 42, row);
  });

  y += details.length * 7 + 8;

  // ── Action Guidance ──
  doc.setFillColor(245, 247, 250);
  doc.roundedRect(margin, y, contentWidth, 12, 1, 1, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(...COLORS.dark);
  doc.text("ACTION GUIDANCE", margin + 3, y + 4.5);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(decision.actionGuidance, margin + 3, y + 9);
  y += 18;

  // ── Signal Breakdown Table ──
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...COLORS.dark);
  doc.text("SIGNAL BREAKDOWN", margin, y);
  y += 5;

  // Table header
  const colCategory = margin;
  const colStatus = margin + 70;
  const colImpact = margin + 130;
  doc.setFillColor(240, 243, 247);
  doc.rect(margin, y, contentWidth, 6, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(...COLORS.muted);
  doc.text("CATEGORY", colCategory + 2, y + 4);
  doc.text("STATUS", colStatus, y + 4);
  doc.text("IMPACT", colImpact, y + 4);
  y += 6;

  decision.signals.forEach((s) => {
    doc.setDrawColor(225, 230, 235);
    doc.setLineWidth(0.2);
    doc.line(margin, y + 6, pw - margin, y + 6);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(...COLORS.text);
    doc.text(s.category, colCategory + 2, y + 4);
    doc.setFont("helvetica", "bold");
    doc.text(s.status, colStatus, y + 4);
    doc.setTextColor(...impactColor(s.impact));
    doc.text(s.impact, colImpact, y + 4);
    y += 6;
  });
  y += 6;

  // ── Decision Interpretation ──
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...COLORS.dark);
  doc.text("DECISION INTERPRETATION", margin, y);
  y += 6;

  const interpRow = (label: string, value: string) => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.setTextColor(...COLORS.dark);
    doc.text(label, margin, y);
    y += 4;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(...COLORS.text);
    const lines = doc.splitTextToSize(value, contentWidth);
    doc.text(lines, margin, y, { lineHeightFactor: 1.5 });
    y += lines.length * 4.5 + 3;
  };

  interpRow("System belief:", decision.interpretation.systemBelief);
  interpRow("Source of uncertainty:", decision.interpretation.uncertaintyCause);
  interpRow("Data that would change the outcome:", decision.interpretation.additionalDataNeeded);

  y += 4;

  // ── Compliance statement ──
  doc.setFillColor(248, 250, 252);
  const complianceLines = doc.splitTextToSize(decision.complianceStatement, contentWidth - 4);
  const complianceHeight = complianceLines.length * 4 + 6;
  doc.roundedRect(margin, y, contentWidth, complianceHeight, 1, 1, "F");
  doc.setFont("helvetica", "italic");
  doc.setFontSize(8);
  doc.setTextColor(...COLORS.muted);
  doc.text(complianceLines, margin + 2, y + 4);
  y += complianceHeight + 4;

  // ── Timestamp section ──
  doc.setDrawColor(220, 225, 230);
  doc.setLineWidth(0.3);
  doc.line(margin, y, pw - margin, y);
  y += 6;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...COLORS.muted);
  doc.text(`Assessed on ${formatUtcDate(narrative.assessed_at)}`, margin, y);
  y += 5;
  doc.text("This record is immutable and cannot be altered after generation.", margin, y);

  // ── Footer ──
  const footerY = ph - 12;
  doc.setDrawColor(...COLORS.brand);
  doc.setLineWidth(0.3);
  doc.line(margin, footerY - 4, pw - margin, footerY - 4);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(...COLORS.muted);
  doc.text("Generated by Vaulta Trust Platform  \u2022  tryvaulta.com  \u2022  hello@tryvaulta.com", margin, footerY);
  doc.text(
    `Page 1 of 1  \u2022  ${new Date().toISOString().split("T")[0]}`,
    pw - margin,
    footerY,
    { align: "right" }
  );

  // ── Bottom accent bar ──
  doc.setFillColor(...COLORS.brand);
  doc.rect(0, ph - 3, pw, 3, "F");

  // Save
  const filename = `vaulta-assessment-${narrative.assessment_id.slice(0, 8)}-${
    new Date(narrative.assessed_at).toISOString().split("T")[0]
  }.pdf`;
  doc.save(filename);
}
