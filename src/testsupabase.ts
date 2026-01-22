const { data, error } = await supabase
  .from("profiles")
  .select("*")
  .eq("id", supabase.auth.getUser().id); // getUser() or session.user.id depending on your setup

if (error) console.error("❌ Error fetching profile:", error.message);
else console.log("✅ Profile fetched:", data);
