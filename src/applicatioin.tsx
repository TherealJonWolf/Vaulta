import React, { useEffect, useState } from "react";
import { createClient, SupabaseClient } from "@supabase/supabase-js";

// Load environment variables (Vite uses VITE_ prefix)
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

let supabase: SupabaseClient | null = null;

// Try to initialize Supabase, catch missing/invalid keys
try {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error("Supabase URL or ANON KEY is missing!");
  }
  supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
} catch (err) {
  console.error("Supabase initialization error:", err);
}

const App: React.FC = () => {
  const [userCount, setUserCount] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!supabase) {
      setError("Supabase is not initialized. Check your keys!");
      return;
    }

    // Example: fetch number of users from "profiles" table
    const fetchUsers = async () => {
      try {
        const { data, error } = await supabase.from("profiles").select("*");
        if (error) throw error;
        setUserCount(data.length);
      } catch (err: any) {
        console.error("Error fetching data:", err);
        setError(err.message || "Unknown error fetching data.");
      }
    };

    fetchUsers();
  }, []);

  if (error) {
    return (
      <div style={{ padding: "2rem", color: "red" }}>
        <h1>⚠️ Supabase Error</h1>
        <p>{error}</p>
      </div>
    );
  }

  return (
    <div style={{ padding: "2rem" }}>
      <h1>Supabase Connected!</h1>
      {userCount !== null ? (
        <p>Number of users: {userCount}</p>
      ) : (
        <p>Loading user data...</p>
      )}
    </div>
  );
};

export default App;
