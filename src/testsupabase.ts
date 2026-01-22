import { supabase } from "@/integrations/supabase/client";

async function testProfile() {
  try {
    // Get the current logged-in user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError) {
      console.error("❌ Error getting user:", authError.message);
      return;
    }

    if (!user) {
      console.error("❌ No user logged in!");
      return;
    }

    console.log("ℹ️ Logged-in user:", user);

    // Fetch profile for this user
    const { data, error: profileError } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id);

    if (profileError) console.error("❌ Error fetching profile:", profileError.message);
    else console.log("✅ Profile fetched:", data);

    // Extra debug info
    console.log("📊 Supabase session info:", await supabase.auth.getSession());
  } catch (err) {
    console.error("❌ Unexpected error:", err);
  }
}

// Run the test
testProfile
