// Issue an immutable, hash-verifiable assessment report on behalf of an
// institution. Mirrors the snapshot pattern of generate-trust-report
// but scoped to institution members reviewing a specific submission.
//
// Auth: caller must be authenticated AND a member of the institution
// that owns the submission.
//
// Returns: { report_hash, report_id, verify_url, issued_at }.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.74.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const PDF_SERVICE_URL = Deno.env.get("PDF_SERVICE_URL") ?? "";
const PDF_SERVICE_TOKEN = Deno.env.get("PDF_SERVICE_TOKEN") ?? "";

function canonicalize(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return "[" + value.map(canonicalize).join(",") + "]";
  const keys = Object.keys(value as Record<string, unknown>).sort();
  return (
    "{" +
    keys
      .map(
        (k) =>
          JSON.stringify(k) +
          ":" +
          canonicalize((value as Record<string, unknown>)[k]),
      )
      .join(",") +
    "}"
  );
}

async function sha256Hex(input: string): Promise<string> {
  const buf = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace(/^Bearer\s+/i, "");
    if (!token) {
      return new Response(
        JSON.stringify({ error: "missing_authorization" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
    const { data: userRes, error: userErr } = await admin.auth.getUser(token);
    if (userErr || !userRes?.user) {
      return new Response(
        JSON.stringify({ error: "invalid_session" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    const user = userRes.user;

    const body = await req.json().catch(() => ({}));
    const submissionId = typeof body?.submission_id === "string" ? body.submission_id : null;
    if (!submissionId) {
      return new Response(
        JSON.stringify({ error: "missing_submission_id" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Load submission
    const { data: submission, error: subErr } = await admin
      .from("intake_submissions")
      .select("*")
      .eq("id", submissionId)
      .maybeSingle();
    if (subErr || !submission) {
      return new Response(
        JSON.stringify({ error: "submission_not_found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Verify caller is a member of the institution owning the submission
    const { data: membership } = await admin
      .from("institutional_users")
      .select("id")
      .eq("user_id", user.id)
      .eq("institution_id", submission.institution_id)
      .maybeSingle();
    if (!membership) {
      return new Response(
        JSON.stringify({ error: "not_authorized" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Pull institution display name for the verification page
    const { data: settings } = await admin
      .from("institution_settings")
      .select("display_name")
      .eq("institution_id", submission.institution_id)
      .maybeSingle();
    const { data: institution } = await admin
      .from("institutions")
      .select("name")
      .eq("id", submission.institution_id)
      .maybeSingle();
    const issuerDisplayName =
      settings?.display_name ?? institution?.name ?? "Institution";

    const issuedAt = new Date().toISOString();
    const version = "v1";

    const payload = {
      version,
      issued_at: issuedAt,
      institution_id: submission.institution_id,
      submission_id: submission.id,
      reference_id: submission.reference_id,
      applicant_name: submission.applicant_name,
      trust_score: submission.trust_score,
      score_state: submission.score_state,
      assessment_narrative: submission.assessment_narrative,
      document_types: (submission.document_types ?? []).slice().sort(),
      document_count: submission.document_count,
      assessed_at: submission.assessed_at,
      submitted_at: submission.submitted_at,
      issuer_display_name: issuerDisplayName,
      issued_by_hash: await sha256Hex("user:" + user.id),
    };

    const reportHash = await sha256Hex(canonicalize(payload));

    const { data: inserted, error: insertErr } = await admin
      .from("assessment_reports")
      .insert({
        institution_id: submission.institution_id,
        submission_id: submission.id,
        applicant_name: submission.applicant_name,
        reference_id: submission.reference_id,
        issued_by: user.id,
        issuer_display_name: issuerDisplayName,
        trust_score: submission.trust_score,
        score_state: submission.score_state,
        assessment_narrative: submission.assessment_narrative,
        evidence_summary: {
          document_count: submission.document_count,
          document_types: payload.document_types,
        },
        report_payload: payload,
        report_hash: reportHash,
        version,
        issued_at: issuedAt,
      })
      .select("id, issued_at, report_hash")
      .single();

    if (insertErr) {
      // Unique-hash conflict means the same submission state was already
      // issued — return the existing row for idempotency.
      if ((insertErr as { code?: string }).code === "23505") {
        const { data: existing } = await admin
          .from("assessment_reports")
          .select("id, issued_at, report_hash")
          .eq("report_hash", reportHash)
          .maybeSingle();
        if (existing) {
          return new Response(
            JSON.stringify({
              ok: true,
              idempotent: true,
              report_id: existing.id,
              report_hash: existing.report_hash,
              issued_at: existing.issued_at,
            }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } },
          );
        }
      }
      console.error("assessment_report insert failed", insertErr);
      return new Response(
        JSON.stringify({ error: "insert_failed", detail: insertErr.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Activity log entry (best-effort)
    await admin.from("institutional_activity_log").insert({
      institution_id: submission.institution_id,
      user_id: user.id,
      event_type: "assessment_report_issued",
      reference_id: submission.reference_id,
      applicant_name: submission.applicant_name,
      detail: `Issued verified assessment report (hash ${reportHash.slice(0, 12)}…).`,
    });

    // Heavy PDF compilation is delegated to the isolated background PDF
    // service when configured. This edge function stays a thin authenticated
    // router: it authorises, writes the immutable report row, and triggers
    // the external compiler. If PDF_SERVICE_URL is unset, callers receive
    // the JSON receipt only (existing behaviour) — no PDF is compiled here.
    if (PDF_SERVICE_URL) {
      try {
        await fetch(PDF_SERVICE_URL.replace(/\/$/, "") + "/assessment-report", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(PDF_SERVICE_TOKEN ? { "Authorization": `Bearer ${PDF_SERVICE_TOKEN}` } : {}),
          },
          body: JSON.stringify({
            report_id: inserted.id,
            report_hash: inserted.report_hash,
            payload,
          }),
        });
      } catch (e) {
        console.error("pdf-service dispatch failed", e);
      }
    }

    return new Response(
      JSON.stringify({
        ok: true,
        report_id: inserted.id,
        report_hash: inserted.report_hash,
        issued_at: inserted.issued_at,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("issue-assessment-report failure", err);
    return new Response(
      JSON.stringify({ error: "internal_error", detail: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});