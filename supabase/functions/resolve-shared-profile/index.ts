import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceClient = createClient(
      supabaseUrl,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { token } = await req.json();
    if (!token) {
      return new Response(
        JSON.stringify({ error: "Missing token" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Resolve the token
    const { data: tokenData, error: tokenError } = await serviceClient
      .from("shared_profile_tokens")
      .select("id, user_id, is_active, expires_at")
      .eq("token", token)
      .single();

    if (tokenError || !tokenData) {
      return new Response(
        JSON.stringify({ error: "Invalid or expired link" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!tokenData.is_active || new Date(tokenData.expires_at) < new Date()) {
      return new Response(
        JSON.stringify({ error: "This shared link has expired" }),
        { status: 410, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const applicantUserId = tokenData.user_id;

    // Increment view count
    await serviceClient
      .from("shared_profile_tokens")
      .update({ view_count: (tokenData as any).view_count + 1 || 1 })
      .eq("id", tokenData.id);

    // Fetch applicant profile
    const { data: profile } = await serviceClient
      .from("profiles")
      .select("email, full_name, created_at, mfa_enabled, profile_photo_url")
      .eq("user_id", applicantUserId)
      .single();

    // Fetch latest trust score
    const { data: trustScore } = await serviceClient
      .from("trust_scores")
      .select("trust_score, trust_level, confidence, explanation, positive_factors, negative_factors, recommendations, calculated_at")
      .eq("user_id", applicantUserId)
      .order("calculated_at", { ascending: false })
      .limit(1)
      .single();

    // Fetch documents with verification results (no file paths — no raw doc access)
    const { data: documents } = await serviceClient
      .from("documents")
      .select("id, file_name, document_category, is_verified, verification_result, created_at, mime_type, file_size")
      .eq("user_id", applicantUserId)
      .order("created_at", { ascending: false });

    // Fetch Veriff verification status
    const { data: veriffSessions } = await serviceClient
      .from("veriff_sessions")
      .select("status, decision, created_at")
      .eq("user_id", applicantUserId)
      .order("created_at", { ascending: false })
      .limit(1);

    // Fetch account flags
    const { data: accountFlags } = await serviceClient
      .from("account_flags")
      .select("flag_type, reason, created_at, resolved_at")
      .eq("user_id", applicantUserId)
      .order("created_at", { ascending: false });

    const result = {
      tokenId: tokenData.id,
      applicant: {
        name: profile?.full_name || "Anonymous Applicant",
        email: profile?.email ? maskEmail(profile.email) : null,
        memberSince: profile?.created_at,
        mfaEnabled: profile?.mfa_enabled || false,
      },
      trustScore: trustScore || null,
      documents: (documents || []).map((doc: any) => ({
        id: doc.id,
        fileName: doc.file_name,
        category: doc.document_category,
        isVerified: doc.is_verified,
        verificationResult: doc.verification_result,
        submittedAt: doc.created_at,
        mimeType: doc.mime_type,
        fileSize: doc.file_size,
      })),
      identityVerification: veriffSessions?.[0] || null,
      accountFlags: (accountFlags || []).filter((f: any) => !f.resolved_at),
    };

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("resolve-shared-profile error:", message);
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!domain) return "***@***";
  const maskedLocal = local.substring(0, 2) + "***";
  return `${maskedLocal}@${domain}`;
}
