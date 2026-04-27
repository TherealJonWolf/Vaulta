import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function escPdf(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
}

// ── Decision-grade derivation (mirrors src/lib/decisionGrade.ts) ──
type DecisionStatus = "APPROVED" | "CONDITIONALLY APPROVED" | "NOT RECOMMENDED" | "INSUFFICIENT DATA";
type RiskLevel = "LOW" | "MODERATE" | "HIGH" | "UNDETERMINED";
type Impact = "POSITIVE" | "NEUTRAL" | "NEGATIVE";

interface SignalRow { category: string; status: string; impact: Impact }
interface DecisionGrade {
  status: DecisionStatus;
  riskLevel: RiskLevel;
  actionGuidance: string;
  signals: SignalRow[];
  interpretation: { systemBelief: string; uncertaintyCause: string; additionalDataNeeded: string };
}

function deriveDecisionGrade(args: {
  scoreState: string;
  documentCount: number;
  historyMonths: number | null;
  flagCount: number;
}): DecisionGrade {
  const { scoreState, documentCount, historyMonths, flagCount } = args;
  const months = historyMonths ?? 0;

  const status: DecisionStatus =
    scoreState === "clear" ? "APPROVED" :
    scoreState === "review" ? "CONDITIONALLY APPROVED" :
    scoreState === "flag" ? "NOT RECOMMENDED" :
    "INSUFFICIENT DATA";

  const riskLevel: RiskLevel =
    scoreState === "insufficient" ? "UNDETERMINED" :
    (scoreState === "flag" || flagCount > 0) ? "HIGH" :
    scoreState === "review" ? "MODERATE" : "LOW";

  const actionGuidance =
    status === "APPROVED" ? "Proceed with standard onboarding. No additional verification required." :
    status === "CONDITIONALLY APPROVED" ? "Proceed with standard guarantor, deposit, or co-signer terms as applicable." :
    status === "NOT RECOMMENDED" ? "Do not advance without independent verification of the flagged items." :
    "Request additional documentation through Vaulta before deciding.";

  const identity: SignalRow = documentCount === 0
    ? { category: "Identity Verification", status: "INSUFFICIENT DATA", impact: "NEUTRAL" }
    : flagCount > 0
      ? { category: "Identity Verification", status: "PARTIAL", impact: "NEGATIVE" }
      : { category: "Identity Verification", status: "PASSED", impact: "POSITIVE" };

  const authenticity: SignalRow = documentCount === 0
    ? { category: "Document Authenticity", status: "INSUFFICIENT DATA", impact: "NEUTRAL" }
    : flagCount > 0
      ? { category: "Document Authenticity", status: "UNVERIFIED", impact: "NEGATIVE" }
      : { category: "Document Authenticity", status: "VERIFIED", impact: "POSITIVE" };

  const behavioral: SignalRow = months >= 6
    ? { category: "Behavioral Consistency", status: "CONFIRMED", impact: "POSITIVE" }
    : months >= 2
      ? { category: "Behavioral Consistency", status: "PARTIAL", impact: "NEUTRAL" }
      : { category: "Behavioral Consistency", status: "INSUFFICIENT DATA", impact: "NEUTRAL" };

  const crossAccount: SignalRow =
    scoreState === "flag" ? { category: "Cross-Account Risk", status: "FLAGGED", impact: "NEGATIVE" } :
    scoreState === "review" ? { category: "Cross-Account Risk", status: "REVIEWED", impact: "NEUTRAL" } :
    scoreState === "insufficient" ? { category: "Cross-Account Risk", status: "INSUFFICIENT DATA", impact: "NEUTRAL" } :
    { category: "Cross-Account Risk", status: "NONE DETECTED", impact: "POSITIVE" };

  const interpretation =
    status === "APPROVED" ? {
      systemBelief: "The applicant presents a consistent, verifiable trust profile across all evaluated categories.",
      uncertaintyCause: "No material uncertainty was identified.",
      additionalDataNeeded: "None. The current evidence base supports a confident decision.",
    } : status === "CONDITIONALLY APPROVED" ? {
      systemBelief: "The applicant presents a verifiable profile with no fraud indicators, but the evidence base is narrower than ideal.",
      uncertaintyCause: `History depth (${months} month${months !== 1 ? "s" : ""}) limits the strength of behavioral inference.`,
      additionalDataNeeded: "Additional months of payment or income history, or one secondary verification document, would strengthen the classification.",
    } : status === "NOT RECOMMENDED" ? {
      systemBelief: "One or more submitted records contain inconsistencies that materially affect document authenticity.",
      uncertaintyCause: `${flagCount} record${flagCount !== 1 ? "s" : ""} failed multi-layer authenticity checks.`,
      additionalDataNeeded: "Independent re-issuance of the flagged documents from the originating source would change the outcome.",
    } : {
      systemBelief: "The submitted evidence base is too narrow to form a defensible classification.",
      uncertaintyCause: "Document coverage is below the minimum required for assessment.",
      additionalDataNeeded: "Additional identity, income, or residency documentation submitted through Vaulta would enable a complete assessment.",
    };

  return {
    status,
    riskLevel,
    actionGuidance,
    signals: [identity, authenticity, behavioral, crossAccount],
    interpretation,
  };
}

const COMPLIANCE_STATEMENT =
  "This report reflects consented and verifiable signals available at the time of evaluation and is intended to support consistent, fair, and auditable decision-making.";

function generateAssessmentPdf(data: {
  id: string;
  applicant_name: string;
  reference_id: string;
  submitted_at: string;
  assessed_at: string;
  document_count: number;
  trust_score: number;
  score_state: string;
  document_types: string[];
  history_months: number | null;
  flag_count: number;
}): Uint8Array {
  let stream = '';

  const text = (str: string, x: number, y: number, font: string, size: number) => {
    stream += `BT /${font} ${size} Tf ${x} ${y} Td (${escPdf(str)}) Tj ET\n`;
  };

  const line = (x1: number, y1: number, x2: number, y2: number, w: number, g: number) => {
    stream += `${g} G ${w} w ${x1} ${y1} m ${x2} ${y2} l S\n`;
  };

  const decision = deriveDecisionGrade({
    scoreState: data.score_state,
    documentCount: data.document_count,
    historyMonths: data.history_months,
    flagCount: data.flag_count,
  });

  // word-wrap helper
  const wrap = (str: string, maxChars: number, x: number, size: number) => {
    const words = (str || '').split(' ');
    let cur = '';
    for (const w of words) {
      const t = cur ? `${cur} ${w}` : w;
      if (t.length > maxChars) {
        text(cur, x, y, 'F1', size);
        y -= size + 3;
        cur = w;
      } else { cur = t; }
    }
    if (cur) { text(cur, x, y, 'F1', size); y -= size + 3; }
  };

  let y = 742;

  // Header
  text('VAULTA', 50, y, 'F2', 22);
  y -= 16;
  text('PROVISIONAL TRUST CLASSIFICATION', 50, y, 'F1', 10);
  y -= 12;
  text(`Certificate ID: ${data.id.substring(0, 8).toUpperCase()}`, 50, y, 'F1', 8);
  y -= 20;
  line(50, y, 562, y, 1, 0.15);
  y -= 30;

  // Fields
  const field = (label: string, value: string) => {
    text(label, 50, y, 'F2', 10);
    text(value, 200, y, 'F1', 10);
    y -= 20;
  };

  field('Applicant:', data.applicant_name);
  field('Reference ID:', data.reference_id);
  field('Submitted:', data.submitted_at);
  field('Assessed:', data.assessed_at);
  field('Documents:', String(data.document_count));
  field('Trust Score:', `${data.trust_score} / 100`);
  field('Status:', decision.status);
  field('Risk Level:', decision.riskLevel);
  y -= 10;

  // Action guidance
  line(50, y, 562, y, 0.5, 0.8);
  y -= 22;
  text('Action Guidance', 50, y, 'F2', 13);
  y -= 18;
  wrap(decision.actionGuidance, 90, 50, 10);
  y -= 8;

  // Signal Breakdown Table
  text('Signal Breakdown', 50, y, 'F2', 13);
  y -= 6;
  line(50, y, 562, y, 0.5, 0.85);
  y -= 14;
  text('CATEGORY', 50, y, 'F2', 8);
  text('STATUS', 250, y, 'F2', 8);
  text('IMPACT', 420, y, 'F2', 8);
  y -= 4;
  line(50, y, 562, y, 0.3, 0.85);
  y -= 14;
  for (const s of decision.signals) {
    text(s.category, 50, y, 'F1', 10);
    text(s.status, 250, y, 'F2', 10);
    text(s.impact, 420, y, 'F2', 10);
    y -= 16;
  }
  y -= 10;

  // Decision Interpretation
  text('Decision Interpretation', 50, y, 'F2', 13);
  y -= 18;
  text('System belief:', 50, y, 'F2', 10);
  y -= 13;
  wrap(decision.interpretation.systemBelief, 90, 50, 10);
  y -= 4;
  text('Source of uncertainty:', 50, y, 'F2', 10);
  y -= 13;
  wrap(decision.interpretation.uncertaintyCause, 90, 50, 10);
  y -= 4;
  text('Data that would change the outcome:', 50, y, 'F2', 10);
  y -= 13;
  wrap(decision.interpretation.additionalDataNeeded, 90, 50, 10);
  y -= 10;

  // Document types
  text('Document Types Received', 50, y, 'F2', 13);
  y -= 20;
  for (const t of (data.document_types || [])) {
    text(`\u2022  ${t}`, 60, y, 'F1', 10);
    y -= 16;
  }
  y -= 25;

  // Compliance + defensibility
  line(50, y, 562, y, 0.5, 0.85);
  y -= 16;
  wrap(COMPLIANCE_STATEMENT, 100, 50, 8);
  y -= 6;
  text('It contains no raw document images or applicant-submitted files.', 50, y, 'F1', 7);
  y -= 11;
  text(`Generated: ${new Date().toISOString()} UTC  |  Vaulta Institutional Platform`, 50, y, 'F1', 7);

  // Build PDF structure
  const objs = [
    '1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n',
    '2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n',
    '3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R /F2 6 0 R >> >> >>\nendobj\n',
    `4 0 obj\n<< /Length ${stream.length} >>\nstream\n${stream}endstream\nendobj\n`,
    '5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>\nendobj\n',
    '6 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>\nendobj\n',
  ];

  let pdf = '%PDF-1.4\n';
  const offsets: number[] = [];
  for (const obj of objs) { offsets.push(pdf.length); pdf += obj; }

  const xrefPos = pdf.length;
  pdf += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n`;
  for (const o of offsets) { pdf += `${o.toString().padStart(10, '0')} 00000 n \n`; }
  pdf += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xrefPos}\n%%EOF`;

  return new TextEncoder().encode(pdf);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userErr } = await supabase.auth.getUser();
    if (userErr || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { submission_id } = await req.json();
    if (!submission_id) {
      return new Response(JSON.stringify({ error: 'submission_id required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const { data: sub, error: subErr } = await admin
      .from('intake_submissions')
      .select('*')
      .eq('id', submission_id)
      .single();

    if (subErr || !sub) {
      return new Response(JSON.stringify({ error: 'Submission not found' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Verify membership
    const { data: membership } = await admin
      .from('institutional_users')
      .select('id')
      .eq('user_id', user.id)
      .eq('institution_id', sub.institution_id)
      .single();

    if (!membership) {
      return new Response(JSON.stringify({ error: 'Access denied' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const pdfBytes = generateAssessmentPdf({
      ...sub,
      submitted_at: new Date(sub.submitted_at).toUTCString(),
      assessed_at: sub.assessed_at ? new Date(sub.assessed_at).toUTCString() : 'Pending',
      history_months: sub.history_months ?? null,
      flag_count: sub.flag_count ?? 0,
    });

    return new Response(pdfBytes, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="vaulta-assessment-${sub.reference_id}.pdf"`,
      },
    });
  } catch (err) {
    console.error('PDF export error:', err);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
