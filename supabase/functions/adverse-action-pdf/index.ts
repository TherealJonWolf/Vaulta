import { createClient } from "npm:@supabase/supabase-js@2";
import { jsPDF } from "npm:jspdf@2.5.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Adverse Action Notice generator.
 *
 * Produces an FCRA / Fair Housing-aligned notice the institution can deliver
 * to an applicant when a decision is made not to proceed (or to proceed only
 * on conditional terms) based wholly or in part on information surfaced
 * through Vaulta. The notice is signed by the institution and references the
 * Vaulta assessment without disclosing internal scoring weights.
 *
 * NOTE: This is a template. Institutions are responsible for legal review of
 * the language for their jurisdiction and use case.
 */

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const auth = req.headers.get("Authorization");
    if (!auth) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Validate user via anon-keyed client
    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: auth } },
    });
    const { data: { user }, error: authErr } = await userClient.auth.getUser();
    if (authErr || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { submission_id, recipient_email } = await req.json();
    if (!submission_id || typeof submission_id !== "string") {
      return new Response(JSON.stringify({ error: "submission_id required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (recipient_email !== undefined) {
      if (typeof recipient_email !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipient_email)) {
        return new Response(JSON.stringify({ error: "Invalid recipient_email" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);

    // Fetch submission
    const { data: sub, error: subErr } = await admin
      .from("intake_submissions")
      .select("*")
      .eq("id", submission_id)
      .maybeSingle();
    if (subErr || !sub) {
      return new Response(JSON.stringify({ error: "Submission not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify caller is a member of the owning institution
    const { data: membership } = await admin
      .from("institutional_users")
      .select("institution_id, role")
      .eq("user_id", user.id)
      .eq("institution_id", sub.institution_id)
      .maybeSingle();
    if (!membership) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Institution branding
    const { data: settings } = await admin
      .from("institution_settings")
      .select("display_name, contact_name, contact_email, contact_phone, business_address, signature_path")
      .eq("institution_id", sub.institution_id)
      .maybeSingle();
    const { data: institution } = await admin
      .from("institutions")
      .select("name")
      .eq("id", sub.institution_id)
      .maybeSingle();

    const institutionName = settings?.display_name || institution?.name || "Reviewing Institution";

    // ── Build PDF ──
    const doc = new jsPDF({ unit: "pt", format: "letter" });
    const pageW = doc.internal.pageSize.getWidth();
    const margin = 56;
    const contentW = pageW - margin * 2;
    let y = margin;

    const setFont = (size: number, weight: "normal" | "bold" = "normal") => {
      doc.setFont("helvetica", weight);
      doc.setFontSize(size);
    };
    const text = (s: string, opts: { size?: number; weight?: "normal" | "bold"; gap?: number } = {}) => {
      setFont(opts.size ?? 10, opts.weight ?? "normal");
      const lines = doc.splitTextToSize(s, contentW);
      doc.text(lines, margin, y);
      y += lines.length * (opts.size ?? 10) * 1.35 + (opts.gap ?? 6);
    };
    const rule = () => {
      doc.setDrawColor(220);
      doc.line(margin, y, pageW - margin, y);
      y += 12;
    };

    // Header band
    doc.setFillColor(15, 23, 42);
    doc.rect(0, 0, pageW, 36, "F");
    doc.setTextColor(255);
    setFont(9, "bold");
    doc.text("ADVERSE ACTION NOTICE", margin, 23);
    setFont(8);
    doc.text("Issued via Vaulta Decision-Grade Trust Platform", pageW - margin, 23, { align: "right" });
    doc.setTextColor(15, 23, 42);
    y = 60;

    // Issuer block
    setFont(13, "bold");
    doc.text(institutionName, margin, y); y += 18;
    setFont(9);
    if (settings?.business_address) { doc.text(settings.business_address, margin, y); y += 12; }
    if (settings?.contact_email) { doc.text(settings.contact_email, margin, y); y += 12; }
    if (settings?.contact_phone) { doc.text(settings.contact_phone, margin, y); y += 12; }
    y += 6;

    // Date + reference
    setFont(9);
    doc.text(`Date issued: ${new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}`, margin, y); y += 12;
    doc.text(`Reference ID: ${sub.reference_id}`, margin, y); y += 12;
    doc.text(`Applicant: ${sub.applicant_name}`, margin, y); y += 18;

    rule();

    text("Notice of Action Taken", { size: 13, weight: "bold", gap: 10 });
    text(
      `Dear ${sub.applicant_name},`,
      { gap: 10 }
    );
    text(
      `We are writing to inform you that ${institutionName} has been unable to approve your application on standard terms at this time. This decision was based, in whole or in part, on information contained in a consumer-style trust assessment supplied to us through the Vaulta platform.`,
      { gap: 10 }
    );

    text("Summary of Reasons", { size: 11, weight: "bold", gap: 6 });
    const score = typeof sub.trust_score === "number" ? sub.trust_score : null;
    const reasonLines: string[] = [];
    if (sub.score_state === "flag") {
      reasonLines.push("• One or more documents submitted did not pass independent authenticity verification.");
      reasonLines.push("• Cross-account risk signals were identified that materially affected the assessment outcome.");
    } else if (sub.score_state === "review") {
      reasonLines.push("• The supporting evidence base did not meet the threshold required for unconditional approval.");
      reasonLines.push("• Verification or consistency signals fell within a range that requires additional assurance.");
    } else if (sub.score_state === "insufficient") {
      reasonLines.push("• The volume or category of submitted documents was insufficient to form a complete assessment.");
    } else {
      reasonLines.push("• The application did not meet our standard onboarding criteria at this time.");
    }
    if (score !== null) reasonLines.push(`• Composite trust indicator: ${score} / 100.`);
    text(reasonLines.join("\n"), { gap: 12 });

    text("Information Source", { size: 11, weight: "bold", gap: 6 });
    text(
      `Part of this decision was based on information supplied by Vaulta, a third-party trust assessment platform. Vaulta did not make the decision to take adverse action and is not able to provide you with the specific reasons for our decision. You have the right to obtain a free copy of any consumer-style report Vaulta supplied within 60 days of receiving this notice, and to dispute the accuracy or completeness of any information that report contains.`,
      { gap: 10 }
    );
    text("Vaulta · https://tryvaulta.com · support@tryvaulta.com", { size: 9, gap: 14 });

    text("Your Rights", { size: 11, weight: "bold", gap: 6 });
    text(
      "You have the right to dispute the accuracy or completeness of any information considered in this decision by contacting us directly at the address above. Where applicable, the federal Fair Credit Reporting Act and Fair Housing Act protect your right to be free from discrimination on the basis of race, color, national origin, religion, sex, familial status, or disability.",
      { gap: 10 }
    );
    text(
      "If you believe this decision was made in error, you may submit additional documentation through your original Vaulta intake link or request a new secure intake window from us.",
      { gap: 14 }
    );

    rule();

    text("Authorized Signature", { size: 11, weight: "bold", gap: 14 });
    // Embed signature image if available
    if (settings?.signature_path) {
      try {
        const sigRes = await fetch(settings.signature_path);
        if (sigRes.ok) {
          const sigBuf = await sigRes.arrayBuffer();
          const ct = sigRes.headers.get("content-type") || "";
          const fmt = ct.includes("png") ? "PNG" : ct.includes("jpeg") || ct.includes("jpg") ? "JPEG" : null;
          if (fmt) {
            const b64 = btoa(String.fromCharCode(...new Uint8Array(sigBuf)));
            doc.addImage(`data:${ct};base64,${b64}`, fmt, margin, y - 6, 160, 40, undefined, "FAST");
            y += 36;
          }
        }
      } catch {
        // Signature embed is best-effort; fall through to text-only signature line
      }
    }
    setFont(9);
    doc.line(margin, y, margin + 240, y); y += 12;
    doc.text(settings?.contact_name || "Authorized Representative", margin, y); y += 12;
    doc.text(institutionName, margin, y); y += 22;

    // Footer
    const footerY = doc.internal.pageSize.getHeight() - 28;
    doc.setDrawColor(220);
    doc.line(margin, footerY - 8, pageW - margin, footerY - 8);
    setFont(7);
    doc.setTextColor(120);
    doc.text(
      `Generated ${new Date().toISOString()} · Submission ${sub.id} · This notice is a template; institutions are responsible for legal review.`,
      margin, footerY
    );

    const buf = doc.output("arraybuffer");

    // Audit log
    await admin.from("institutional_activity_log").insert({
      institution_id: sub.institution_id,
      user_id: user.id,
      event_type: recipient_email ? "Adverse Action Notice Emailed" : "Adverse Action Notice Generated",
      reference_id: sub.reference_id,
      applicant_name: sub.applicant_name,
      detail: recipient_email
        ? `Adverse action notice emailed to ${recipient_email} for ${sub.applicant_name}`
        : `Adverse action notice generated for ${sub.applicant_name}`,
    });

    // Email delivery via Resend
    if (recipient_email) {
      const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
      if (!RESEND_API_KEY) {
        return new Response(JSON.stringify({ error: "Email service not configured" }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const b64Pdf = btoa(String.fromCharCode(...new Uint8Array(buf)));
      const subject = `Notice regarding your application — ${institutionName}`;
      const html = `<p>Dear ${sub.applicant_name},</p>
<p>Please find attached a notice regarding the recent decision on your application with <strong>${institutionName}</strong>. The notice outlines your rights and how to respond.</p>
<p>Reference ID: <strong>${sub.reference_id}</strong></p>
<p>If you have questions, please reply to this email or contact ${institutionName} directly.</p>
<p>— Sent on behalf of ${institutionName} via Vaulta</p>`;
      const fromAddr = settings?.contact_email
        ? `${institutionName} <onboarding@resend.dev>`
        : `Vaulta Notices <onboarding@resend.dev>`;
      const resendRes = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${RESEND_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: fromAddr,
          to: [recipient_email],
          reply_to: settings?.contact_email || undefined,
          subject,
          html,
          attachments: [{
            filename: `adverse-action-${sub.reference_id}.pdf`,
            content: b64Pdf,
          }],
        }),
      });
      if (!resendRes.ok) {
        const errBody = await resendRes.text();
        return new Response(JSON.stringify({ error: `Email delivery failed: ${errBody}` }), {
          status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ success: true, emailed_to: recipient_email }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(buf, {
      headers: {
        ...corsHeaders,
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="adverse-action-${sub.reference_id}.pdf"`,
      },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});