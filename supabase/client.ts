import { createClient } from "@supabase/supabase-js";

// Load environment variables
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

// Check environment variables
if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error("Missing Supabase environment variables");
}

// Only log in development mode
if (import.meta.env.DEV) {
  console.log("Supabase URL:", supabaseUrl);
  console.log("Supabase Key is set:", !!supabaseAnonKey); // Don't log the key itself
}

// Create the Supabase client
export const supabase = createClient(supabaseUrl, supabaseAnonKey);
