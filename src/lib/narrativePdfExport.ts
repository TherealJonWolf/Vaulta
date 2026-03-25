import jsPDF from "jspdf";
import { type TrustNarrative, type ScoreState, getScoreStateConfig } from "@/lib/trustNarrative";

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

function getStateColor(state: ScoreState): [number, number, number] {
  const map: Record<ScoreState, [number, number, number]> = {
    clear: COLORS.clear,
    review: COLORS.review,
    flag: COLORS.flag,
    insufficient: COLORS.insufficient,
  };
  return map[state];
}

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
  const config = getScoreStateConfig(narrative.score_state as ScoreState);
  const stateColor = getStateColor(narrative.score_state as ScoreState);

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

  // Right-aligned score state badge
  doc.setFillColor(...stateColor);
  const badgeText = config.label.toUpperCase();
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
  doc.text("ASSESSMENT RECORD", margin, y);

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

  // ── Score state color bar on left ──
  doc.setFillColor(...stateColor);
  doc.rect(margin, y, 2.5, 40, "F");

  // ── Assessment details grid ──
  const detailX = margin + 7;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(...COLORS.muted);

  const details: [string, string][] = [
    ["INSTITUTION", narrative.institution_name ?? "N/A"],
    ["ASSESSMENT ID", narrative.assessment_id.slice(0, 8).toUpperCase()],
    ["SCORE STATE", config.label],
    ["TRUST SCORE", narrative.trust_score !== null ? `${narrative.trust_score} / 100` : "N/A"],
    ["DOCUMENTS ASSESSED", String(narrative.document_count)],
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

  // ── Narrative section ──
  doc.setFillColor(245, 247, 250);
  doc.roundedRect(margin, y, contentWidth, 1, 0, 0, "F"); // subtle divider
  y += 6;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...COLORS.dark);
  doc.text("NARRATIVE", margin, y);
  y += 7;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(...COLORS.text);
  const narrativeLines = doc.splitTextToSize(narrative.narrative_text, contentWidth);
  doc.text(narrativeLines, margin, y, { lineHeightFactor: 1.6 });
  y += narrativeLines.length * 5 + 10;

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
