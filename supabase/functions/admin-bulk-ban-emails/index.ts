import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Domains where dots in the local part are ignored and "+tag" suffixes are aliases
const DOT_INSENSITIVE_DOMAINS = new Set([
  "gmail.com",
  "googlemail.com",
]);
// Domains that ignore "+tag" suffixes (most modern providers do)
const PLUS_ALIAS_DOMAINS = new Set([
  "gmail.com",
  "googlemail.com",
  "outlook.com",
  "hotmail.com",
  "live.com",
  "icloud.com",
  "me.com",
  "mac.com",
  "yahoo.com",
  "ymail.com",
  "fastmail.com",
  "protonmail.com",
  "proton.me",
]);
// Domain canonicalization (treat as the same mailbox provider)
const DOMAIN_ALIASES: Record<string, string> = {
  "googlemail.com": "gmail.com",
};

/** Normalize an email for duplicate detection only. Preserves original casing in results. */
function normalizeForDedup(raw: string): string {
  const lowered = raw.trim().toLowerCase();
  const at = lowered.lastIndexOf("@");
  if (at < 1) return lowered;
  let local = lowered.slice(0, at);
  let domain = lowered.slice(at + 1);

  domain = DOMAIN_ALIASES[domain] ?? domain;

  if (PLUS_ALIAS_DOMAINS.has(domain)) {
    const plus = local.indexOf("+");
    if (plus >= 0) local = local.slice(0, plus);
  }
  if (DOT_INSENSITIVE_DOMAINS.has(domain)) {
    local = local.replace(/\./g, "");
  }
  return `${local}@${domain}`;
}

interface RowResult {
  row: number;
  email: string;
  reason: string | null;
  status: "valid" | "invalid_email" | "duplicate_in_csv" | "already_banned" | "inserted" | "error";
  message?: string;
  associated_user_id?: string | null;
  normalized_email?: string;
  duplicate_of_row?: number;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const anonClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await anonClient.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey);
    const { data: roleData } = await adminClient
      .from("user_roles").select("role").eq("user_id", user.id).eq("role", "admin").maybeSingle();
    if (!roleData) {
      return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const body = await req.json().catch(() => ({}));
    const csv: string = typeof body.csv === "string" ? body.csv : "";
    const dryRun: boolean = body.dryRun !== false; // default true
    const defaultReason: string = body.defaultReason || "Bulk import by admin";

    if (!csv.trim()) {
      return new Response(JSON.stringify({ error: "csv body is empty" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Parse CSV: split lines, detect header, support email[,reason]
    const lines = csv.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    if (lines.length > 5000) {
      return new Response(JSON.stringify({ error: "CSV exceeds 5000 row limit" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const splitRow = (line: string): string[] => {
      // Minimal CSV: handle simple quoted fields
      const out: string[] = [];
      let cur = "";
      let inQ = false;
      for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (ch === '"') { inQ = !inQ; continue; }
        if (ch === "," && !inQ) { out.push(cur); cur = ""; continue; }
        cur += ch;
      }
      out.push(cur);
      return out.map((s) => s.trim());
    };

    let startIdx = 0;
    const firstCols = splitRow(lines[0]).map((s) => s.toLowerCase());
    if (firstCols[0] === "email") startIdx = 1;

    const seenNormalized = new Map<string, number>(); // normalized -> first row number seen
    const results: RowResult[] = [];
    const validEmails: { row: number; email: string; normalized: string; reason: string }[] = [];

    for (let i = startIdx; i < lines.length; i++) {
      const cols = splitRow(lines[i]);
      const rawEmail = (cols[0] || "").trim().toLowerCase();
      const reason = (cols[1] || defaultReason).slice(0, 500);
      const rowNum = i + 1;

      if (!EMAIL_RE.test(rawEmail)) {
        results.push({ row: rowNum, email: rawEmail, reason, status: "invalid_email" });
        continue;
      }
      const normalized = normalizeForDedup(rawEmail);
      const firstSeenRow = seenNormalized.get(normalized);
      if (firstSeenRow !== undefined) {
        results.push({
          row: rowNum,
          email: rawEmail,
          reason,
          status: "duplicate_in_csv",
          normalized_email: normalized,
          duplicate_of_row: firstSeenRow,
          message: normalized !== rawEmail ? `Alias of row ${firstSeenRow} (${normalized})` : undefined,
        });
        continue;
      }
      seenNormalized.set(normalized, rowNum);
      validEmails.push({ row: rowNum, email: rawEmail, normalized, reason });
    }

    // Check which already exist in blacklist — query both raw and normalized to catch aliases
    const lookupEmails = Array.from(new Set(validEmails.flatMap((v) => [v.email, v.normalized])));
    let alreadyBanned = new Set<string>();
    if (lookupEmails.length > 0) {
      const { data: existing } = await adminClient
        .from("blacklisted_emails").select("email").in("email", lookupEmails);
      // Compare by normalized form so aliases hit
      alreadyBanned = new Set((existing ?? []).map((e: any) => normalizeForDedup(e.email)));
    }

    // Look up associated user_ids from profiles
    const profileMap = new Map<string, string>();
    if (lookupEmails.length > 0) {
      const { data: profiles } = await adminClient
        .from("profiles").select("user_id, email").in("email", lookupEmails);
      for (const p of profiles ?? []) profileMap.set(normalizeForDedup((p as any).email), (p as any).user_id);
    }

    const toInsert: { email: string; reason: string; associated_user_id: string | null; blacklisted_by: string }[] = [];
    for (const v of validEmails) {
      if (alreadyBanned.has(v.normalized)) {
        results.push({
          row: v.row,
          email: v.email,
          reason: v.reason,
          status: "already_banned",
          normalized_email: v.normalized,
        });
        continue;
      }
      const assoc = profileMap.get(v.normalized) ?? null;
      results.push({
        row: v.row,
        email: v.email,
        reason: v.reason,
        status: "valid",
        associated_user_id: assoc,
        normalized_email: v.normalized,
      });
      toInsert.push({ email: v.email, reason: v.reason, associated_user_id: assoc, blacklisted_by: user.id });
    }

    const summary = {
      total_rows: lines.length - startIdx,
      valid: toInsert.length,
      invalid_email: results.filter((r) => r.status === "invalid_email").length,
      duplicate_in_csv: results.filter((r) => r.status === "duplicate_in_csv").length,
      already_banned: results.filter((r) => r.status === "already_banned").length,
      inserted: 0,
      errors: 0,
    };

    if (dryRun) {
      return new Response(JSON.stringify({ dryRun: true, summary, results }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Real insert
    if (toInsert.length > 0) {
      const { data: inserted, error: insErr } = await adminClient
        .from("blacklisted_emails").insert(toInsert).select("email, associated_user_id");
      if (insErr) {
        return new Response(JSON.stringify({ error: insErr.message, summary, results }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const insertedSet = new Set((inserted ?? []).map((i: any) => i.email));
      for (const r of results) {
        if (r.status === "valid" && insertedSet.has(r.email)) {
          r.status = "inserted";
          summary.inserted++;
        }
      }

      // Lock associated profiles
      const userIds = toInsert.map((t) => t.associated_user_id).filter((u): u is string => !!u);
      if (userIds.length > 0) {
        await adminClient.from("profiles")
          .update({ account_locked_at: new Date().toISOString() })
          .in("user_id", userIds);
      }

      // Audit log
      await adminClient.from("security_events").insert({
        user_id: user.id,
        event_type: "bulk_email_ban_import",
        severity: "warning",
        metadata: {
          imported_by: user.id,
          inserted_count: summary.inserted,
          total_rows: summary.total_rows,
          default_reason: defaultReason,
        },
      });
    }

    return new Response(JSON.stringify({ dryRun: false, summary, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err?.message ?? String(err) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});