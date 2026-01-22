import { createClient } from "@supabase/supabase-js";

// Load environment variables first
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

// Check they exist
if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error("Missing Supabase environment variables");
}

// Debugging logs
console.log("Supabase URL:", supabaseUrl);
console.log("Supabase Key length:", supabaseAnonKey.length);

// Create the Supabase client
export const supabase = createClient(supabaseUrl, supabaseAnonKey);
