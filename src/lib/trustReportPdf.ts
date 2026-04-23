// PDF generator for the Vaulta Verified Trust Report.
//
// Court-defensible artifact. The PDF is a HUMAN-readable rendering of the
// immutable JSON snapshot persisted in trust_report_snapshots. The hash
// embedded in Section 7 is computed server-side from the canonical
// snapshot JSON; this module only displays it. Third parties verify
// authenticity by submitting the hash to the public verify endpoint —
// the PDF itself is not the source of truth, the database row is.

import jsPDF from "jspdf";

export interface TrustReportSnapshot {
  version: string;
  generated_at: string;
  user_id_hash: string;
  trust_score: number;
  trust_level: string;
  confidence: number;
  explanation: string | null;
  score_calculated_at: string;
  signals_summary: Array<{
    category: string;
    count: number;
    positive_count: number;
    negative_count: number;
    neutral_count: number;
    net_impact: "positive" | "neutral" | "negative";
    net_weight: number;
    capped_contribution: number;
    avg_confidence: number;
  }>;
  consent_snapshot: Array<{
    category: string;
    granted: boolean;
    consent_version: string;
    consent_text_hash: string | null;
    granted_at: string | null;
    revoked_at: string | null;
    source: string | null;
  }>;
  audit_metadata: {
    trace_id: string;
    evaluation_window: {
      signals_lookback_days: number;
      telemetry_lookback_days: number;
    };
    projected_signal_counts: Record<string, number>;
    skipped_categories: string[];
    redacted_fields_summary: {
      redacted_event_count: number;
      redacted_field_types: string[];
    };
    encryption_status: string;
    device_count: number;
    device_ids_hashed: string[];
    jitter_epoch: number | null;
    boundary_hugging_score: number | null;
    last_random_audit_at: string | null;
  };
}

export interface TrustReportPdfInput {
  snapshot: TrustReportSnapshot;
  report_hash: string;
  snapshot_id: string;
  verify_url_base?: string; // e.g. "https://vaulta.io/verify"
}

const ACCENT: [number, number, number] = [0, 200, 200];
const TEXT_DARK: [number, number, number] = [25, 30, 40];
const TEXT_MUTED: [number, number, number] = [110, 115, 125];
const POSITIVE: [number, number, number] = [29, 158, 117];
const NEGATIVE: [number, number, number] = [226, 75, 74];
const NEUTRAL: [number, number, number] = [120, 120, 130];

function levelLabel(level: string): string {
  return level
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function categoryLabel(cat: string): string {
  return cat
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function generateNarrative(snapshot: TrustReportSnapshot): string {
  const parts: string[] = [];
  const score = Math.round(snapshot.trust_score);

  const idVerified = snapshot.signals_summary.find(
    (s) => s.category === "identity_verification" && s.positive_count > 0,
  );
  const docPositive = snapshot.signals_summary.find(
    (s) => s.category === "document_consistency" && s.net_weight > 0,
  );
  const crossAccount = snapshot.signals_summary.find(
    (s) => s.category === "cross_account",
  );
  const devicePositive = snapshot.signals_summary.find(
    (s) => s.category === "device_consistency" && s.net_weight > 0,
  );

  parts.push(
    `This trust profile reflects a score of ${score} (${levelLabel(snapshot.trust_level)}) with ${(snapshot.confidence * 100).toFixed(0)}% confidence as of ${new Date(snapshot.generated_at).toUTCString()}.`,
  );

  const positives: string[] = [];
  if (idVerified) positives.push("verified identity");
  if (devicePositive) positives.push("consistent device usage patterns");
  if (docPositive) positives.push("document consistency checks passed");

  if (positives.length > 0) {
    parts.push(
      `Positive contributors include ${positives.join(", ")}.`,
    );
  }

  if (!crossAccount || crossAccount.negative_count === 0) {
    parts.push("No cross-account risk signals were detected.");
  } else {
    parts.push(
      `Cross-account analysis surfaced ${crossAccount.negative_count} signal(s); these are weighted with a hard cap and cannot raise the score.`,
    );
  }

  if (snapshot.audit_metadata.skipped_categories.length > 0) {
    parts.push(
      `The following signal categories were not evaluated due to absent user consent: ${snapshot.audit_metadata.skipped_categories
        .map(categoryLabel)
        .join(", ")}.`,
    );
  }

  return parts.join(" ");
}

function ensureRoom(
  doc: jsPDF,
  y: number,
  needed: number,
  margin: number,
): number {
  const pageH = doc.internal.pageSize.getHeight();
  if (y + needed > pageH - margin) {
    doc.addPage();
    drawSidebar(doc);
    return margin;
  }
  return y;
}

function drawSidebar(doc: jsPDF) {
  doc.setFillColor(...ACCENT);
  doc.rect(0, 0, 4, doc.internal.pageSize.getHeight(), "F");
}

function drawSectionHeader(
  doc: jsPDF,
  y: number,
  margin: number,
  pageW: number,
  number: number,
  title: string,
): number {
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...ACCENT);
  doc.text(`SECTION ${number}`, margin, y);
  doc.setFontSize(13);
  doc.setTextColor(...TEXT_DARK);
  doc.text(title.toUpperCase(), margin + 28, y);
  doc.setDrawColor(...ACCENT);
  doc.setLineWidth(0.3);
  doc.line(margin, y + 2, pageW - margin, y + 2);
  return y + 9;
}

export function generateTrustReportPdf(input: TrustReportPdfInput): jsPDF {
  const { snapshot, report_hash, snapshot_id, verify_url_base } = input;
  const verifyBase =
    verify_url_base ?? `${window.location.origin}/verify`;

  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "letter",
  });
  const margin = 18;
  const pageW = doc.internal.pageSize.getWidth();
  const usable = pageW - margin * 2;
  let y = margin;

  drawSidebar(doc);

  // ── HEADER ─────────────────────────────────────────────────────────
  doc.setFontSize(20);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...ACCENT);
  doc.text("VAULTA", margin, y + 6);
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...TEXT_MUTED);
  doc.text("VERIFIED TRUST REPORT", margin + 30, y + 6);
  y += 12;

  // Report meta strip
  doc.setDrawColor(...ACCENT);
  doc.setLineWidth(0.4);
  doc.line(margin, y, pageW - margin, y);
  y += 5;

  doc.setFontSize(8);
  doc.setTextColor(...TEXT_MUTED);
  doc.text("REPORT ID", margin, y);
  doc.text("GENERATED", margin + 70, y);
  doc.text("VERSION", margin + 140, y);
  y += 4;
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...TEXT_DARK);
  doc.text(snapshot_id.slice(0, 18) + "…", margin, y);
  doc.text(new Date(snapshot.generated_at).toUTCString(), margin + 70, y);
  doc.text(snapshot.version, margin + 140, y);
  y += 8;

  doc.setFontSize(7);
  doc.setFont("helvetica", "italic");
  doc.setTextColor(...TEXT_MUTED);
  const disclaimerLines = doc.splitTextToSize(
    "Vaulta Verified Trust Report — A point-in-time, cryptographically hashed assessment record. This document does not constitute a credit decision, lending recommendation, or guarantee of suitability. Verification of authenticity is performed via the report hash in Section 7.",
    usable,
  );
  doc.text(disclaimerLines, margin, y);
  y += disclaimerLines.length * 3.2 + 4;

  // ── SECTION 1: TRUST SCORE ────────────────────────────────────────
  y = drawSectionHeader(doc, y, margin, pageW, 1, "Trust Score");

  // Score block
  doc.setFillColor(245, 250, 250);
  doc.roundedRect(margin, y, usable, 26, 2, 2, "F");
  doc.setFontSize(36);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...ACCENT);
  doc.text(String(Math.round(snapshot.trust_score)), margin + 8, y + 18);
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...TEXT_MUTED);
  doc.text("/ 100", margin + 38, y + 18);

  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...TEXT_DARK);
  doc.text(levelLabel(snapshot.trust_level), margin + 60, y + 11);
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...TEXT_MUTED);
  doc.text(
    `Confidence: ${(snapshot.confidence * 100).toFixed(0)}%`,
    margin + 60,
    y + 17,
  );
  doc.text(
    `Score calculated: ${new Date(snapshot.score_calculated_at).toUTCString()}`,
    margin + 60,
    y + 22,
  );
  y += 30;

  if (snapshot.explanation) {
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...TEXT_DARK);
    const lines = doc.splitTextToSize(snapshot.explanation, usable);
    doc.text(lines, margin, y);
    y += lines.length * 4 + 4;
  }

  // ── SECTION 2: DECISION NARRATIVE ─────────────────────────────────
  y = ensureRoom(doc, y, 30, margin);
  y = drawSectionHeader(doc, y, margin, pageW, 2, "Decision Narrative");
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...TEXT_DARK);
  const narrativeLines = doc.splitTextToSize(
    generateNarrative(snapshot),
    usable,
  );
  y = ensureRoom(doc, y, narrativeLines.length * 4 + 4, margin);
  doc.text(narrativeLines, margin, y);
  y += narrativeLines.length * 4 + 6;

  // ── SECTION 3: SIGNAL SUMMARY ─────────────────────────────────────
  y = ensureRoom(doc, y, 40, margin);
  y = drawSectionHeader(doc, y, margin, pageW, 3, "Signal Summary");

  // Table header
  doc.setFillColor(248, 248, 250);
  doc.rect(margin, y, usable, 6, "F");
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...TEXT_MUTED);
  doc.text("CATEGORY", margin + 2, y + 4);
  doc.text("COUNT", margin + 80, y + 4);
  doc.text("IMPACT", margin + 105, y + 4);
  doc.text("CAPPED CONTRIB.", margin + 135, y + 4);
  y += 6;

  if (snapshot.signals_summary.length === 0) {
    doc.setFont("helvetica", "italic");
    doc.setTextColor(...TEXT_MUTED);
    doc.text("No signals projected during evaluation window.", margin + 2, y + 5);
    y += 8;
  } else {
    for (const s of snapshot.signals_summary) {
      y = ensureRoom(doc, y, 7, margin);
      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(...TEXT_DARK);
      doc.text(categoryLabel(s.category), margin + 2, y + 4);
      doc.text(String(s.count), margin + 80, y + 4);

      // Impact pill
      const impactColor =
        s.net_impact === "positive"
          ? POSITIVE
          : s.net_impact === "negative"
            ? NEGATIVE
            : NEUTRAL;
      doc.setFillColor(...impactColor);
      doc.roundedRect(margin + 105, y, 22, 5, 1, 1, "F");
      doc.setFontSize(7);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(255, 255, 255);
      doc.text(s.net_impact.toUpperCase(), margin + 116, y + 3.5, {
        align: "center",
      });

      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(...TEXT_DARK);
      const sign = s.capped_contribution >= 0 ? "+" : "";
      doc.text(`${sign}${s.capped_contribution.toFixed(2)}`, margin + 135, y + 4);
      y += 6;
      doc.setDrawColor(235, 235, 240);
      doc.setLineWidth(0.1);
      doc.line(margin, y, pageW - margin, y);
    }
    y += 3;
  }

  // ── SECTION 4: CONSENT RECORD ─────────────────────────────────────
  y = ensureRoom(doc, y, 40, margin);
  y = drawSectionHeader(doc, y, margin, pageW, 4, "Consent Record");

  doc.setFillColor(248, 248, 250);
  doc.rect(margin, y, usable, 6, "F");
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...TEXT_MUTED);
  doc.text("CATEGORY", margin + 2, y + 4);
  doc.text("STATUS", margin + 70, y + 4);
  doc.text("VERSION", margin + 100, y + 4);
  doc.text("CONSENT HASH (12)", margin + 130, y + 4);
  y += 6;

  for (const c of snapshot.consent_snapshot) {
    y = ensureRoom(doc, y, 7, margin);
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...TEXT_DARK);
    doc.text(categoryLabel(c.category), margin + 2, y + 4);

    doc.setFont("helvetica", "bold");
    doc.setTextColor(...(c.granted ? POSITIVE : NEGATIVE));
    doc.text(c.granted ? "GRANTED" : "REVOKED", margin + 70, y + 4);

    doc.setFont("helvetica", "normal");
    doc.setTextColor(...TEXT_DARK);
    doc.text(c.consent_version, margin + 100, y + 4);
    doc.setFont("courier", "normal");
    doc.setFontSize(8);
    doc.text(
      c.consent_text_hash ? c.consent_text_hash.slice(0, 12) + "…" : "—",
      margin + 130,
      y + 4,
    );
    y += 6;
    doc.setDrawColor(235, 235, 240);
    doc.setLineWidth(0.1);
    doc.line(margin, y, pageW - margin, y);
  }
  y += 3;

  // ── SECTION 5: PRIVACY & SECURITY ─────────────────────────────────
  y = ensureRoom(doc, y, 30, margin);
  y = drawSectionHeader(doc, y, margin, pageW, 5, "Privacy & Security");

  const enc = snapshot.audit_metadata.encryption_status;
  const encLabel =
    enc === "all_encrypted"
      ? "All documents encrypted end-to-end"
      : enc === "partial"
        ? "Partial encryption coverage"
        : enc === "none"
          ? "No encrypted documents"
          : "Not applicable (no documents)";

  const privacyRows: Array<[string, string]> = [
    ["End-to-End Encryption", encLabel],
    [
      "Redacted Telemetry Events",
      String(snapshot.audit_metadata.redacted_fields_summary.redacted_event_count),
    ],
    [
      "Redacted Field Types",
      snapshot.audit_metadata.redacted_fields_summary.redacted_field_types.length > 0
        ? snapshot.audit_metadata.redacted_fields_summary.redacted_field_types.join(", ")
        : "None",
    ],
    ["Devices Observed (hashed)", String(snapshot.audit_metadata.device_count)],
  ];

  doc.setFontSize(9);
  for (const [k, v] of privacyRows) {
    y = ensureRoom(doc, y, 5, margin);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...TEXT_MUTED);
    doc.text(k, margin, y);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...TEXT_DARK);
    const vLines = doc.splitTextToSize(v, usable - 70);
    doc.text(vLines, margin + 70, y);
    y += Math.max(5, vLines.length * 4);
  }
  y += 2;
  doc.setFont("helvetica", "italic");
  doc.setFontSize(8);
  doc.setTextColor(...TEXT_MUTED);
  const stmt = doc.splitTextToSize(
    "Vaulta does not store unencrypted user documents. Raw geolocation, device identifiers, and behavioural payloads are either hashed or redacted prior to persistence.",
    usable,
  );
  doc.text(stmt, margin, y);
  y += stmt.length * 3.5 + 4;

  // ── SECTION 6: AUDIT TRAIL ────────────────────────────────────────
  y = ensureRoom(doc, y, 35, margin);
  y = drawSectionHeader(doc, y, margin, pageW, 6, "Audit Trail");

  const auditRows: Array<[string, string]> = [
    ["Trace ID", snapshot.audit_metadata.trace_id],
    [
      "Signals Window",
      `${snapshot.audit_metadata.evaluation_window.signals_lookback_days} days`,
    ],
    [
      "Telemetry Window",
      `${snapshot.audit_metadata.evaluation_window.telemetry_lookback_days} days`,
    ],
    [
      "Skipped Categories",
      snapshot.audit_metadata.skipped_categories.length > 0
        ? snapshot.audit_metadata.skipped_categories.map(categoryLabel).join(", ")
        : "None",
    ],
    [
      "Jitter Epoch",
      snapshot.audit_metadata.jitter_epoch !== null
        ? String(snapshot.audit_metadata.jitter_epoch)
        : "—",
    ],
    [
      "Boundary Hugging Score",
      snapshot.audit_metadata.boundary_hugging_score !== null
        ? snapshot.audit_metadata.boundary_hugging_score.toFixed(3)
        : "—",
    ],
  ];
  doc.setFontSize(9);
  for (const [k, v] of auditRows) {
    y = ensureRoom(doc, y, 5, margin);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...TEXT_MUTED);
    doc.text(k, margin, y);
    doc.setFont("courier", "normal");
    doc.setTextColor(...TEXT_DARK);
    const vLines = doc.splitTextToSize(v, usable - 70);
    doc.text(vLines, margin + 70, y);
    y += Math.max(5, vLines.length * 4);
  }
  y += 2;
  doc.setFont("helvetica", "italic");
  doc.setFontSize(8);
  doc.setTextColor(...TEXT_MUTED);
  const auditNote = doc.splitTextToSize(
    "All signal contributions are normalized and capped per category to prevent runaway weighting. Cross-account signals are negative-only and cannot raise the trust score.",
    usable,
  );
  doc.text(auditNote, margin, y);
  y += auditNote.length * 3.5 + 4;

  // ── SECTION 7: VERIFICATION BLOCK ─────────────────────────────────
  y = ensureRoom(doc, y, 50, margin);
  y = drawSectionHeader(doc, y, margin, pageW, 7, "Verification Block");

  doc.setFillColor(245, 250, 250);
  doc.setDrawColor(...ACCENT);
  doc.setLineWidth(0.4);
  doc.roundedRect(margin, y, usable, 36, 2, 2, "FD");

  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...TEXT_MUTED);
  doc.text("SHA-256 REPORT HASH", margin + 4, y + 6);

  doc.setFont("courier", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...TEXT_DARK);
  // Split hash across two lines for readability
  doc.text(report_hash.slice(0, 32), margin + 4, y + 12);
  doc.text(report_hash.slice(32), margin + 4, y + 17);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(...TEXT_MUTED);
  doc.text("INDEPENDENT VERIFICATION", margin + 4, y + 24);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...TEXT_DARK);
  doc.text(`${verifyBase}/${report_hash}`, margin + 4, y + 30);

  y += 40;

  doc.setFont("helvetica", "italic");
  doc.setFontSize(7);
  doc.setTextColor(...TEXT_MUTED);
  const verifyNote = doc.splitTextToSize(
    "This hash is the SHA-256 of the canonical JSON snapshot stored immutably in Vaulta's trust report ledger. Any third party may submit this hash to the verification endpoint above to confirm authenticity. The endpoint returns only score, level, and timestamp — no personally identifying information is exposed.",
    usable,
  );
  doc.text(verifyNote, margin, y);

  // ── FOOTER on every page ─────────────────────────────────────────
  const pageCount = doc.getNumberOfPages();
  for (let p = 1; p <= pageCount; p++) {
    doc.setPage(p);
    const pageH = doc.internal.pageSize.getHeight();
    doc.setDrawColor(...ACCENT);
    doc.setLineWidth(0.2);
    doc.line(margin, pageH - 12, pageW - margin, pageH - 12);
    doc.setFontSize(7);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...TEXT_MUTED);
    doc.text(
      `Vaulta Verified Trust Report · ${snapshot.version} · hash ${report_hash.slice(0, 16)}…`,
      margin,
      pageH - 7,
    );
    doc.text(`Page ${p} of ${pageCount}`, pageW - margin, pageH - 7, {
      align: "right",
    });
  }

  return doc;
}

export function downloadTrustReportPdf(input: TrustReportPdfInput): void {
  const doc = generateTrustReportPdf(input);
  const stamp = new Date(input.snapshot.generated_at)
    .toISOString()
    .replace(/[:.]/g, "-")
    .slice(0, 19);
  doc.save(`vaulta-trust-report-${stamp}-${input.report_hash.slice(0, 8)}.pdf`);
}