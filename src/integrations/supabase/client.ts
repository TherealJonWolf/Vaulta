import { createClient } from '@supabase/supabase-js';

// Try the Railway name, then try the Vite name as a backup
const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

// This will stop the app from crashing blindly and tell you EXACTLY what is missing
if (!supabaseUrl || !supabaseKey) {
  console.error("Missing Env Vars - URL:", !!supabaseUrl, "Key:", !!supabaseKey);
}

export const supabase = createClient(supabaseUrl || '', supabaseKey || '');
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: {
    storage: typeof window !== 'undefined' ? window.localStorage : undefined,
    persistSession: typeof window !== 'undefined',
    autoRefreshToken: true,
  }
});
