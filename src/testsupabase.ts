import { supabase } from "./lib/supabase";

async function testProfile() {
  // Get the current logged-in user
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    console.error("❌ No user logged in!");
    return;
  }

  // Fetch profile for this user
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id); // user.id comes from Supabase Auth

  if (error) console.error("❌ Error fetching profile:", error.message);
  else console.log("✅ Profile fetched:", data);
}

testProfile();
