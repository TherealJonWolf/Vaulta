import { createClient } from "@supabase/supabase-js";

// Ensure these environment variables are loaded
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

console.log("Supabase URL:", supabaseUrl);
console.log("Supabase Key length:", supabaseAnonKey?.length);

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

}

export const supabase = createClient(
  supabaseUrl,
  supabaseAnonKey
);
