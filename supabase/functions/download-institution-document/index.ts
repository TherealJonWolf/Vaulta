import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const auth = req.headers.get("Authorization");
    if (!auth) return json({ error: "Unauthorized" }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: auth } },
    });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return json({ error: "Unauthorized" }, 401);

    const { document_id } = await req.json();
    if (!document_id) return json({ error: "document_id required" }, 400);

    const admin = createClient(supabaseUrl, serviceKey);

    // RBAC check: requester OR institution-admin OR platform-admin
    const { data: allowed, error: rbacErr } = await admin.rpc("can_download_institution_doc", {
      _user_id: user.id,
      _doc_id: document_id,
    });
    if (rbacErr) return json({ error: rbacErr.message }, 500);

    // Load doc details for logging
    const { data: doc } = await admin
      .from("institution_documents")
      .select("id, institution_id, consent_record_id, file_path, file_name, share_status, possession_request_id")
      .eq("id", document_id)
      .maybeSingle();
    if (!doc) return json({ error: "Document not found" }, 404);

    if (!allowed) {
      // Log denied
      await admin.from("institutional_activity_log").insert({
        institution_id: doc.institution_id,
        user_id: user.id,
        event_type: "Document Access Denied",
        detail: `Denied access to ${doc.file_name}`,
      });
      return json({ error: "Forbidden" }, 403);
    }

    if (doc.share_status === "revoked" || doc.share_status === "expired") {
      return json({ error: `Share ${doc.share_status}` }, 410);
    }

    const { data: signed, error: urlErr } = await admin.storage
      .from("institution-documents")
      .createSignedUrl(doc.file_path, 900);
    if (urlErr || !signed) return json({ error: "Signed URL failed" }, 500);

    // Audit + counters
    await admin.from("document_access_log").insert({
      institution_id: doc.institution_id,
      institution_document_id: doc.id,
      consent_record_id: doc.consent_record_id,
      accessed_by: user.id,
      access_type: "download",
      ip_address: req.headers.get("x-forwarded-for") ?? null,
      user_agent: req.headers.get("user-agent") ?? null,
    });
    await admin.from("institution_documents").update({
      download_count: (await admin.from("institution_documents").select("download_count").eq("id", doc.id).single()).data?.download_count + 1 || 1,
      last_downloaded_at: new Date().toISOString(),
      last_downloaded_by: user.id,
      share_status: "downloaded",
    }).eq("id", doc.id);
    await admin.from("institutional_activity_log").insert({
      institution_id: doc.institution_id,
      user_id: user.id,
      event_type: "Document Downloaded",
      detail: `Downloaded ${doc.file_name}`,
    });

    return json({ signed_url: signed.signedUrl, file_name: doc.file_name });
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}