import { createClient } from '@supabase/supabase-js';

// This looks in EVERY possible pocket for the keys
const supabaseUrl = process.env.SUPABASE_URL || import.meta.env?.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_PUBLISHABLE_KEY || import.meta.env?.VITE_SUPABASE_PUBLISHABLE_KEY;

// If they are missing, we print a loud message so we know WHICH one is gone
if (!supabaseUrl) console.error("ERROR: SUPABASE_URL is missing!");
if (!supabaseKey) console.error("ERROR: SUPABASE_PUBLISHABLE_KEY is missing!");

export const supabase = createClient(supabaseUrl, supabaseKey);
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: {
    storage: typeof window !== 'undefined' ? window.localStorage : undefined,
    persistSession: typeof window !== 'undefined',
    autoRefreshToken: true,
  }
});
