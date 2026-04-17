import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SEVERITY_ORDER: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3, info: 4 };
const SEVERITY_EMOJI: Record<string, string> = { critical: "🚨", high: "⚠️", medium: "📋", low: "ℹ️", info: "ℹ️" };

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const resendKey = Deno.env.get("RESEND_API_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const body = await req.json();
    const { mode } = body; // "immediate" or "daily_digest"

    if (mode === "immediate") {
      // Send immediate alert for a specific event
      const { severity, category, title, detail, source_id } = body;
      if (!title || !severity) {
        return new Response(JSON.stringify({ error: "title and severity required" }), { status: 400, headers: corsHeaders });
      }

      // Get all admin users with alert settings
      const { data: adminSettings } = await supabase
        .from("admin_alert_settings")
        .select("*");

      if (!adminSettings || adminSettings.length === 0) {
        return new Response(JSON.stringify({ message: "No admin alert settings configured" }), { headers: corsHeaders });
      }

      const severityNum = SEVERITY_ORDER[severity] ?? 4;
      let sentCount = 0;

      for (const settings of adminSettings) {
        const minSevNum = SEVERITY_ORDER[settings.min_severity_email] ?? 1;
        if (severityNum > minSevNum) continue;
        if (!settings.categories_enabled?.includes(category)) continue;

        // Get admin email
        let alertEmail = settings.alert_email;
        if (!alertEmail) {
          const { data: profile } = await supabase
            .from("profiles")
            .select("email")
            .eq("user_id", settings.admin_user_id)
            .single();
          alertEmail = profile?.email;
        }
        if (!alertEmail) continue;

        const emoji = SEVERITY_EMOJI[severity] || "📋";
        const htmlBody = `
          <div style="font-family: monospace; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="border: 1px solid #333; border-radius: 8px; overflow: hidden;">
              <div style="background: ${severity === 'critical' ? '#dc2626' : severity === 'high' ? '#d97706' : '#1e293b'}; color: white; padding: 16px;">
                <h2 style="margin: 0; font-size: 16px;">${emoji} VAULTA SOC — ${severity.toUpperCase()} ALERT</h2>
              </div>
              <div style="padding: 20px; background: #0f172a; color: #e2e8f0;">
                <table style="width: 100%; border-collapse: collapse;">
                  <tr><td style="padding: 8px 0; color: #94a3b8; font-size: 11px;">SEVERITY</td><td style="padding: 8px 0; font-size: 13px;">${severity.toUpperCase()}</td></tr>
                  <tr><td style="padding: 8px 0; color: #94a3b8; font-size: 11px;">CATEGORY</td><td style="padding: 8px 0; font-size: 13px;">${(category || 'system').toUpperCase()}</td></tr>
                  <tr><td style="padding: 8px 0; color: #94a3b8; font-size: 11px;">TITLE</td><td style="padding: 8px 0; font-size: 13px; font-weight: bold;">${title}</td></tr>
                  ${detail ? `<tr><td style="padding: 8px 0; color: #94a3b8; font-size: 11px;">DETAIL</td><td style="padding: 8px 0; font-size: 13px;">${detail}</td></tr>` : ''}
                  <tr><td style="padding: 8px 0; color: #94a3b8; font-size: 11px;">TIME</td><td style="padding: 8px 0; font-size: 13px;">${new Date().toISOString()}</td></tr>
                </table>
                <div style="margin-top: 20px; padding-top: 16px; border-top: 1px solid #334155;">
                  <p style="color: #94a3b8; font-size: 11px; margin: 0;">Review in Security Command Center → /admin/security</p>
                </div>
              </div>
            </div>
          </div>
        `;

        // Send email via Resend (override sender via ALERT_FROM_ADDRESS until tryvaulta.com is verified)
        const FROM_ADDRESS = Deno.env.get("ALERT_FROM_ADDRESS") || "security@tryvaulta.com";
        const emailRes = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { "Authorization": `Bearer ${resendKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            from: FROM_ADDRESS,
            to: [alertEmail],
            subject: `${emoji} [${severity.toUpperCase()}] ${title}`,
            html: htmlBody,
          }),
        });
        let immErr: string | null = null;
        if (!emailRes.ok) { try { immErr = (await emailRes.text()).slice(0, 500); } catch {} console.error("[soc-alert-email] immediate send failed", emailRes.status, immErr); }

        const deliveryStatus = emailRes.ok ? "sent" : "failed";

        // Log to alert_history
        await supabase.from("alert_history").insert({
          alert_type: "immediate",
          severity,
          category: category || "system",
          title,
          detail,
          source_id,
          delivery_channel: "email",
          delivery_status: deliveryStatus,
          delivered_at: deliveryStatus === "sent" ? new Date().toISOString() : null,
          recipient_admin_id: settings.admin_user_id,
        });

        if (deliveryStatus === "sent") sentCount++;
      }

      return new Response(JSON.stringify({ sent: sentCount }), { headers: corsHeaders });

    } else if (mode === "daily_digest") {
      // Generate daily digest for all admins
      const { data: adminSettings } = await supabase
        .from("admin_alert_settings")
        .select("*")
        .eq("daily_digest_enabled", true);

      if (!adminSettings || adminSettings.length === 0) {
        return new Response(JSON.stringify({ message: "No digests configured" }), { headers: corsHeaders });
      }

      const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

      // Gather 24h stats
      const [lockedRes, signalsRes, uploadsRes, trustRes, incidentsRes] = await Promise.all([
        supabase.from("profiles").select("email, account_locked_at").not("account_locked_at", "is", null),
        supabase.from("cross_account_signals").select("id, severity").gte("last_seen_at", since),
        supabase.from("document_upload_events").select("id, event_type").gte("created_at", since).eq("event_type", "security_failure"),
        supabase.from("trust_history").select("id, trust_delta").gte("created_at", since).lt("trust_delta", -10),
        supabase.from("security_incidents").select("id, status, severity").gte("created_at", since),
      ]);

      const lockedCount = lockedRes.data?.length ?? 0;
      const highSignals = signalsRes.data?.filter((s: any) => s.severity === "high").length ?? 0;
      const securityUploads = uploadsRes.data?.length ?? 0;
      const trustDrops = trustRes.data?.length ?? 0;
      const openIncidents = incidentsRes.data?.filter((i: any) => i.status === "open").length ?? 0;
      const totalThreats = lockedCount + highSignals + securityUploads + trustDrops;

      let sentCount = 0;

      for (const settings of adminSettings) {
        let alertEmail = settings.alert_email;
        if (!alertEmail) {
          const { data: profile } = await supabase.from("profiles").select("email").eq("user_id", settings.admin_user_id).single();
          alertEmail = profile?.email;
        }
        if (!alertEmail) continue;

        const statusEmoji = totalThreats === 0 ? "✅" : totalThreats < 3 ? "⚠️" : "🚨";
        const statusLabel = totalThreats === 0 ? "ALL CLEAR" : totalThreats < 3 ? "ATTENTION NEEDED" : "ACTION REQUIRED";

        const htmlBody = `
          <div style="font-family: monospace; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="border: 1px solid #333; border-radius: 8px; overflow: hidden;">
              <div style="background: #1e293b; color: white; padding: 16px;">
                <h2 style="margin: 0; font-size: 16px;">${statusEmoji} VAULTA SOC — DAILY SECURITY DIGEST</h2>
                <p style="margin: 4px 0 0; font-size: 11px; color: #94a3b8;">${new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
              </div>
              <div style="padding: 20px; background: #0f172a; color: #e2e8f0;">
                <div style="text-align: center; padding: 16px; margin-bottom: 16px; border-radius: 8px; background: ${totalThreats === 0 ? '#065f46' : totalThreats < 3 ? '#78350f' : '#7f1d1d'};">
                  <p style="font-size: 24px; margin: 0; font-weight: bold;">${statusLabel}</p>
                  <p style="font-size: 12px; margin: 4px 0 0; opacity: 0.8;">${totalThreats} threat${totalThreats !== 1 ? 's' : ''} detected in last 24 hours</p>
                </div>
                <table style="width: 100%; border-collapse: collapse;">
                  <tr style="border-bottom: 1px solid #334155;"><td style="padding: 10px 0; color: #94a3b8; font-size: 12px;">🔒 Locked Accounts</td><td style="padding: 10px 0; font-size: 14px; text-align: right; font-weight: bold;">${lockedCount}</td></tr>
                  <tr style="border-bottom: 1px solid #334155;"><td style="padding: 10px 0; color: #94a3b8; font-size: 12px;">🚨 High-Sev Fraud Signals</td><td style="padding: 10px 0; font-size: 14px; text-align: right; font-weight: bold;">${highSignals}</td></tr>
                  <tr style="border-bottom: 1px solid #334155;"><td style="padding: 10px 0; color: #94a3b8; font-size: 12px;">⚠️ Upload Security Failures</td><td style="padding: 10px 0; font-size: 14px; text-align: right; font-weight: bold;">${securityUploads}</td></tr>
                  <tr style="border-bottom: 1px solid #334155;"><td style="padding: 10px 0; color: #94a3b8; font-size: 12px;">📉 Critical Trust Drops</td><td style="padding: 10px 0; font-size: 14px; text-align: right; font-weight: bold;">${trustDrops}</td></tr>
                  <tr><td style="padding: 10px 0; color: #94a3b8; font-size: 12px;">🛡️ Open Incidents</td><td style="padding: 10px 0; font-size: 14px; text-align: right; font-weight: bold;">${openIncidents}</td></tr>
                </table>
                <div style="margin-top: 20px; padding-top: 16px; border-top: 1px solid #334155;">
                  <p style="color: #64748b; font-size: 10px; margin: 0;">Monitoring active · Next digest in 24h · Review at /admin/security</p>
                </div>
              </div>
            </div>
          </div>
        `;

        const FROM_ADDRESS = Deno.env.get("ALERT_FROM_ADDRESS") || "Vaulta SOC <onboarding@resend.dev>";
        const emailRes = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { "Authorization": `Bearer ${resendKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            from: FROM_ADDRESS,
            to: [alertEmail],
            reply_to: "security@tryvaulta.com",
            subject: `${statusEmoji} Vaulta Daily Security Digest — ${statusLabel}`,
            html: htmlBody,
          }),
        });

        const deliveryStatus = emailRes.ok ? "sent" : "failed";
        let errorDetail: string | null = null;
        if (!emailRes.ok) {
          try { errorDetail = (await emailRes.text()).slice(0, 500); } catch { /* ignore */ }
          console.error("[soc-alert-email] digest send failed", emailRes.status, errorDetail);
        }

        await supabase.from("alert_history").insert({
          alert_type: "daily_digest",
          severity: totalThreats === 0 ? "info" : totalThreats < 3 ? "medium" : "high",
          category: "digest",
          title: `Daily Digest — ${statusLabel}`,
          detail: `${totalThreats} threats, ${openIncidents} open incidents`,
          delivery_channel: "email",
          delivery_status: deliveryStatus,
          delivered_at: deliveryStatus === "sent" ? new Date().toISOString() : null,
          recipient_admin_id: settings.admin_user_id,
          metadata: errorDetail ? { provider_error: errorDetail, http_status: emailRes.status } : {},
        });

        if (deliveryStatus === "sent") sentCount++;
      }

      return new Response(JSON.stringify({ sent: sentCount }), { headers: corsHeaders });
    }

    return new Response(JSON.stringify({ error: "Invalid mode. Use 'immediate' or 'daily_digest'" }), { status: 400, headers: corsHeaders });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: corsHeaders });
  }
});
