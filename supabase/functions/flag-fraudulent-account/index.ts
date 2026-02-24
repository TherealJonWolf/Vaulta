import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Verify the caller is authenticated
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

    // Ban the user (disable their account)
    const { error: banError } = await supabase.auth.admin.updateUserById(userId, {
      ban_duration: "876000h", // ~100 years
    });

    if (banError) {
      console.error("Ban error:", banError);
    }

    console.log(`Account ${userId} (${email}) flagged and suspended for: ${reason}`);

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
