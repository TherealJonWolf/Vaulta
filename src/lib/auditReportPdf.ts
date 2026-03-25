import jsPDF from "jspdf";
import type { DocumentAuditData } from "@/components/DocumentVerificationAudit";

export function exportAuditReportPdf(audit: DocumentAuditData) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "letter" });
  const margin = 20;
  const pageW = doc.internal.pageSize.getWidth();
  const usable = pageW - margin * 2;
  let y = margin;

  // --- Branding sidebar ---
  doc.setFillColor(0, 200, 200);
  doc.rect(0, 0, 4, doc.internal.pageSize.getHeight(), "F");

  // --- Header ---
  doc.setFontSize(22);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(0, 200, 200);
  doc.text("VAULTA", margin, y + 6);
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(120, 120, 120);
  doc.text("DOCUMENT VERIFICATION AUDIT", margin + 38, y + 6);
  y += 14;

  // Divider
  doc.setDrawColor(0, 200, 200);
  doc.setLineWidth(0.5);
  doc.line(margin, y, pageW - margin, y);
  y += 8;

  // --- Disclaimer ---
  doc.setFontSize(7);
  doc.setFont("helvetica", "italic");
  doc.setTextColor(140, 140, 140);
  const disclaimer = "Vaulta Assessment Record — For institutional use only. This document reflects the output of an automated verification pipeline and does not constitute a lending recommendation.";
  const disclaimerLines = doc.splitTextToSize(disclaimer, usable);
  doc.text(disclaimerLines, margin, y);
  y += disclaimerLines.length * 3.5 + 4;

  // --- Document Details ---
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(30, 30, 30);
  doc.text("DOCUMENT DETAILS", margin, y);
  y += 6;

  const details = [
    ["Document Type", audit.documentType],
    ["File Name", audit.fileName],
    ["Submitted By", audit.submittedBy],
    ["Submission Date", audit.submissionDate],
    ["Overall Status", audit.overallVerified ? "VERIFIED" : "FLAGGED"],
  ];

  doc.setFontSize(9);
  details.forEach(([label, value]) => {
    doc.setFont("helvetica", "normal");
    doc.setTextColor(100, 100, 100);
    doc.text(label + ":", margin, y);
    doc.setFont("helvetica", "bold");
    if (value === "VERIFIED") {
      doc.setTextColor(29, 158, 117);
    } else if (value === "FLAGGED") {
      doc.setTextColor(226, 75, 74);
    } else {
      doc.setTextColor(30, 30, 30);
    }
    doc.text(value, margin + 40, y);
    y += 5;
  });

  y += 4;

  // --- Verification Checks ---
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(30, 30, 30);
  doc.text("VERIFICATION CHECKS", margin, y);
  y += 2;

  const passCount = audit.checks.filter((c) => c.passed).length;
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100, 100, 100);
  doc.text(`${passCount}/${audit.checks.length} checks passed`, margin, y + 4);
  y += 10;

  audit.checks.forEach((check) => {
    // Check if we need a new page
    if (y > doc.internal.pageSize.getHeight() - 30) {
      doc.addPage();
      doc.setFillColor(0, 200, 200);
      doc.rect(0, 0, 4, doc.internal.pageSize.getHeight(), "F");
      y = margin;
    }

    // Status badge
    const badgeW = 12;
    const badgeH = 5;
    if (check.passed) {
      doc.setFillColor(29, 158, 117);
    } else {
      doc.setFillColor(226, 75, 74);
    }
    doc.roundedRect(margin, y - 3.5, badgeW, badgeH, 1, 1, "F");
    doc.setFontSize(6);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(255, 255, 255);
    doc.text(check.passed ? "PASS" : "FAIL", margin + badgeW / 2, y, { align: "center" });

    // Check name
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(30, 30, 30);
    doc.text(check.name, margin + badgeW + 4, y);
    y += 5;

    // Explanation
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(100, 100, 100);
    const lines = doc.splitTextToSize(check.explanation, usable - badgeW - 4);
    doc.text(lines, margin + badgeW + 4, y);
    y += lines.length * 3.8 + 5;
  });

  // --- Footer ---
  y += 4;
  if (y > doc.internal.pageSize.getHeight() - 25) {
    doc.addPage();
    doc.setFillColor(0, 200, 200);
    doc.rect(0, 0, 4, doc.internal.pageSize.getHeight(), "F");
    y = margin;
  }

  doc.setDrawColor(0, 200, 200);
  doc.setLineWidth(0.3);
  doc.line(margin, y, pageW - margin, y);
  y += 6;

  doc.setFontSize(7);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(140, 140, 140);
  const timestamp = new Date().toISOString().replace("T", " at ").split(".")[0] + " UTC";
  doc.text(`Report generated: ${timestamp}`, margin, y);
  doc.text("vaulta.io", pageW - margin, y, { align: "right" });

  doc.save(`vaulta-audit-${audit.fileName.replace(/\s+/g, "_")}.pdf`);
}
