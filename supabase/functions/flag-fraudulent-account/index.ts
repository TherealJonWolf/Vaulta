import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "npm:resend@4.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ADMIN_EMAIL = "hello@tryvaulta.com";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { userId, reason, fileName } = await req.json();

    if (!userId || !reason) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get user email from auth
    const { data: userData, error: userError } = await supabase.auth.admin.getUserById(userId);
    if (userError || !userData?.user?.email) {
      console.error("Failed to get user:", userError);
      return new Response(JSON.stringify({ error: "User not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const email = userData.user.email.toLowerCase();

    // Blacklist the email
    const { error: blacklistError } = await supabase
      .from("blacklisted_emails")
      .upsert(
        {
          email,
          reason: `Fraudulent upload: ${reason}. File: ${fileName}`,
          associated_user_id: userId,
        },
        { onConflict: "email" }
      );

    if (blacklistError) {
      console.error("Blacklist error:", blacklistError);
    }

    // Ban the user
    const { error: banError } = await supabase.auth.admin.updateUserById(userId, {
      ban_duration: "876000h",
    });

    if (banError) {
      console.error("Ban error:", banError);
    }

    console.log(`Account ${userId} (${email}) flagged and suspended for: ${reason}`);

    // Send admin notification email via Resend
    try {
      const resendApiKey = Deno.env.get("RESEND_API_KEY");
      if (resendApiKey) {
        const resend = new Resend(resendApiKey);
        const timestamp = new Date().toLocaleString("en-US", { timeZone: "UTC" });

        await resend.emails.send({
          from: "Vaulta Security <security@tryvaulta.com>",
          to: [ADMIN_EMAIL],
          subject: `🚨 Fraud Alert: Account Suspended — ${email}`,
          html: `
            <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff; padding: 32px;">
              <div style="background: #dc2626; color: #ffffff; padding: 16px 24px; border-radius: 8px 8px 0 0;">
                <h1 style="margin: 0; font-size: 20px;">⚠️ Fraudulent Account Detected</h1>
              </div>
              <div style="border: 1px solid #e5e7eb; border-top: none; padding: 24px; border-radius: 0 0 8px 8px;">
                <table style="width: 100%; border-collapse: collapse;">
                  <tr>
                    <td style="padding: 8px 0; font-weight: 600; color: #374151; width: 140px;">User ID:</td>
                    <td style="padding: 8px 0; color: #6b7280; font-family: monospace; font-size: 13px;">${userId}</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; font-weight: 600; color: #374151;">Email:</td>
                    <td style="padding: 8px 0; color: #6b7280;">${email}</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; font-weight: 600; color: #374151;">Reason:</td>
                    <td style="padding: 8px 0; color: #dc2626;">${reason}</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; font-weight: 600; color: #374151;">File:</td>
                    <td style="padding: 8px 0; color: #6b7280;">${fileName || "N/A"}</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; font-weight: 600; color: #374151;">Timestamp:</td>
                    <td style="padding: 8px 0; color: #6b7280;">${timestamp} UTC</td>
                  </tr>
                </table>
                <hr style="margin: 16px 0; border: none; border-top: 1px solid #e5e7eb;" />
                <p style="margin: 0; font-size: 14px; color: #374151;">
                  <strong>Actions taken:</strong> Email blacklisted, account suspended.
                </p>
              </div>
              <p style="margin-top: 16px; font-size: 12px; color: #9ca3af; text-align: center;">
                Vaulta Security Monitoring
              </p>
            </div>
          `,
        });
        console.log("Admin fraud notification email sent successfully");
      } else {
        console.warn("RESEND_API_KEY not configured — skipping admin notification");
      }
    } catch (emailError) {
      console.error("Failed to send admin notification email:", emailError);
      // Don't fail the whole request if email fails
    }

    return new Response(
      JSON.stringify({ success: true, message: "Account flagged and suspended" }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
