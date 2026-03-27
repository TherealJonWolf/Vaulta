import jsPDF from "jspdf";

interface ComplianceFramework {
  name: string;
  status: string;
  description: string;
  lastAudit: string;
  controls: string[];
}

const frameworks: ComplianceFramework[] = [
  {
    name: "SOX (Sarbanes-Oxley Act)",
    status: "Compliant",
    description: "Financial reporting accuracy, internal control assessment, and immutable record retention.",
    lastAudit: "2026-03-01",
    controls: ["§302 Officer Certification", "§404 Internal Controls", "§409 Real-Time Disclosure", "§802 Record Retention"],
  },
  {
    name: "GLBA (Gramm-Leach-Bliley Act)",
    status: "Compliant",
    description: "AES-256-GCM encryption, zero-knowledge architecture, and strict access controls for nonpublic personal financial information.",
    lastAudit: "2026-01-15",
    controls: ["Financial Privacy Rule", "Safeguards Rule", "Pretexting Protection", "Opt-Out Provisions"],
  },
  {
    name: "FCRA (Fair Credit Reporting Act)",
    status: "Compliant",
    description: "Trust narratives are informational assessments, not credit reports. Accuracy and dispute resolution standards maintained.",
    lastAudit: "2026-03-01",
    controls: ["Accuracy Standards", "Disclosure Obligations", "Dispute Resolution", "Permissible Purpose"],
  },
  {
    name: "SOC 2 Type II",
    status: "Compliant",
    description: "Security controls validated over time across all five Trust Service Criteria.",
    lastAudit: "2026-02-15",
    controls: ["Security", "Availability", "Processing Integrity", "Confidentiality", "Privacy"],
  },
  {
    name: "GDPR (EU General Data Protection)",
    status: "Compliant",
    description: "Data minimization, lawful basis processing, and full data subject rights support.",
    lastAudit: "2026-01-20",
    controls: ["Right to Erasure", "Data Portability", "Consent Management", "DPO Appointed"],
  },
  {
    name: "CCPA (CA Consumer Privacy Act)",
    status: "Compliant",
    description: "Full rights for California residents including right to know, delete, and opt-out. No data sales.",
    lastAudit: "2026-01-20",
    controls: ["Right to Know", "Right to Delete", "Opt-Out Rights", "No Data Sales"],
  },
  {
    name: "NIST SP 800-53 Rev. 5",
    status: "Verified",
    description: "Controls implemented across AC, AU, IA, and SC control families per federal security standards.",
    lastAudit: "2026-03-10",
    controls: ["AC — Access Control", "AU — Audit & Accountability", "IA — Identification & Auth", "SC — System & Comms Protection"],
  },
  {
    name: "FHA (Fair Housing Act)",
    status: "Aligned",
    description: "Assessment engine avoids discrimination. No protected-class data used in scoring.",
    lastAudit: "2026-02-28",
    controls: ["Bias-Free Scoring", "No Protected Class Inputs", "Equal Treatment Protocols", "Audit Trail"],
  },
];

export function exportComplianceCertificatePdf(institutionName?: string) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "letter" });
  const margin = 20;
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const usable = pageW - margin * 2;
  const now = new Date();
  const timestamp = now.toISOString().replace("T", " ").substring(0, 19) + " UTC";
  let y = margin;

  const addNewPage = () => {
    doc.addPage();
    y = margin;
    // Sidebar
    doc.setFillColor(0, 200, 200);
    doc.rect(0, 0, 4, pageH, "F");
    doc.rect(pageW - 4, 0, 4, pageH, "F");
  };

  const checkPage = (needed: number) => {
    if (y + needed > pageH - 25) {
      addNewPage();
    }
  };

  // === Sidebar accents ===
  doc.setFillColor(0, 200, 200);
  doc.rect(0, 0, 4, pageH, "F");
  doc.rect(pageW - 4, 0, 4, pageH, "F");

  // === Certificate border ===
  doc.setDrawColor(0, 200, 200);
  doc.setLineWidth(0.8);
  doc.rect(10, 10, pageW - 20, pageH - 20);
  doc.setLineWidth(0.3);
  doc.rect(12, 12, pageW - 24, pageH - 24);

  // === Header ===
  y = 30;
  doc.setFontSize(28);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(0, 200, 200);
  doc.text("VAULTA™", pageW / 2, y, { align: "center" });
  y += 8;

  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(120, 120, 120);
  doc.text("ZERO-KNOWLEDGE DOCUMENT VERIFICATION PLATFORM", pageW / 2, y, { align: "center" });
  y += 12;

  // Divider
  doc.setDrawColor(0, 200, 200);
  doc.setLineWidth(0.5);
  doc.line(margin + 20, y, pageW - margin - 20, y);
  y += 12;

  // === Title ===
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(40, 40, 40);
  doc.text("COMPLIANCE CERTIFICATE", pageW / 2, y, { align: "center" });
  y += 8;

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100, 100, 100);
  doc.text("Regulatory Framework Attestation", pageW / 2, y, { align: "center" });
  y += 14;

  // === Certificate ID & metadata ===
  const certId = `VAULTA-CERT-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

  doc.setFillColor(245, 247, 250);
  doc.roundedRect(margin, y, usable, 28, 2, 2, "F");
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(60, 60, 60);
  doc.text("Certificate ID:", margin + 4, y + 7);
  doc.text("Date of Issue:", margin + 4, y + 14);
  doc.text("Valid Through:", margin + 4, y + 21);
  if (institutionName) {
    doc.text("Issued To:", pageW / 2, y + 7);
  }

  doc.setFont("helvetica", "normal");
  doc.setTextColor(80, 80, 80);
  doc.text(certId, margin + 34, y + 7);
  doc.text(now.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }), margin + 34, y + 14);
  const validThrough = new Date(now);
  validThrough.setFullYear(validThrough.getFullYear() + 1);
  doc.text(validThrough.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }), margin + 34, y + 21);
  if (institutionName) {
    doc.text(institutionName, pageW / 2 + 22, y + 7);
  }
  y += 34;

  // === Attestation statement ===
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(60, 60, 60);
  const attestation = "This certificate attests that the Vaulta platform maintains compliance with the regulatory frameworks listed below. All assessments, trust narratives, and document verification processes conducted through Vaulta adhere to these standards. This certificate is generated for informational and audit purposes.";
  const lines = doc.splitTextToSize(attestation, usable);
  doc.text(lines, margin, y);
  y += lines.length * 4.5 + 6;

  // === Framework table ===
  // Header
  doc.setFillColor(0, 200, 200);
  doc.rect(margin, y, usable, 8, "F");
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(255, 255, 255);
  doc.text("FRAMEWORK", margin + 3, y + 5.5);
  doc.text("STATUS", margin + usable * 0.55, y + 5.5);
  doc.text("LAST AUDIT", margin + usable * 0.72, y + 5.5);
  y += 8;

  frameworks.forEach((fw, idx) => {
    const rowH = 8;
    checkPage(rowH + 2);

    // Alternate row bg
    if (idx % 2 === 0) {
      doc.setFillColor(248, 250, 252);
      doc.rect(margin, y, usable, rowH, "F");
    }

    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(40, 40, 40);
    doc.text(fw.name, margin + 3, y + 5.5);

    // Status badge
    if (fw.status === "Compliant" || fw.status === "Verified") {
      doc.setFillColor(29, 158, 117);
    } else {
      doc.setFillColor(0, 200, 200);
    }
    const statusText = fw.status.toUpperCase();
    const statusW = doc.getTextWidth(statusText) + 6;
    doc.roundedRect(margin + usable * 0.55, y + 1.5, statusW, 5, 1, 1, "F");
    doc.setFontSize(6.5);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(255, 255, 255);
    doc.text(statusText, margin + usable * 0.55 + 3, y + 5);

    // Last audit
    doc.setFontSize(7.5);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(100, 100, 100);
    doc.text(new Date(fw.lastAudit).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }), margin + usable * 0.72, y + 5.5);

    y += rowH;
  });

  y += 6;

  // === Framework details ===
  checkPage(20);
  doc.setDrawColor(0, 200, 200);
  doc.setLineWidth(0.3);
  doc.line(margin, y, pageW - margin, y);
  y += 8;

  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(40, 40, 40);
  doc.text("FRAMEWORK DETAILS & KEY CONTROLS", margin, y);
  y += 8;

  frameworks.forEach((fw) => {
    checkPage(30);

    // Framework name
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(0, 160, 160);
    doc.text(fw.name, margin, y);
    y += 5;

    // Description
    doc.setFontSize(7.5);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(80, 80, 80);
    const descLines = doc.splitTextToSize(fw.description, usable - 5);
    doc.text(descLines, margin + 2, y);
    y += descLines.length * 3.5 + 2;

    // Controls
    doc.setFontSize(7);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(100, 100, 100);
    doc.text("Controls: ", margin + 2, y);
    doc.setFont("helvetica", "normal");
    doc.text(fw.controls.join("  •  "), margin + 2 + doc.getTextWidth("Controls: "), y);
    y += 7;
  });

  // === Security footer ===
  checkPage(30);
  y += 4;
  doc.setDrawColor(0, 200, 200);
  doc.setLineWidth(0.3);
  doc.line(margin, y, pageW - margin, y);
  y += 8;

  doc.setFillColor(245, 247, 250);
  doc.roundedRect(margin, y, usable, 18, 2, 2, "F");
  doc.setFontSize(7);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(60, 60, 60);
  doc.text("TECHNICAL SAFEGUARDS", margin + 4, y + 6);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100, 100, 100);
  doc.text("AES-256-GCM Encryption  •  Zero-Knowledge Architecture  •  E2E Encrypted  •  ISO 27001 Aligned  •  TLS 1.3", margin + 4, y + 12);
  y += 24;

  // === Immutable timestamp & disclaimer ===
  checkPage(20);
  doc.setFontSize(6.5);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(140, 140, 140);
  doc.text(`Generated: ${timestamp}`, margin, y);
  y += 4;
  doc.text("This certificate is auto-generated by the Vaulta platform and is valid for one year from date of issue.", margin, y);
  y += 3.5;
  doc.text("It does not constitute legal advice or a guarantee of regulatory standing. Contact hello@tryvaulta.com for inquiries.", margin, y);
  y += 3.5;
  doc.text(`Certificate ID: ${certId}`, margin, y);

  // Save
  doc.save(`Vaulta_Compliance_Certificate_${now.toISOString().split("T")[0]}.pdf`);
}
