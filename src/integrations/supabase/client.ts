// 1. Add the missing import at the very top!
import { createClient } from '@supabase/supabase-js';

// 2. Safely grab the URL and Key
const SUPABASE_URL = process.env.SUPABASE_URL || import.meta.env?.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY || import.meta.env?.VITE_SUPABASE_PUBLISHABLE_KEY;

// 3. Simple check to stop the crash
if (!SUPABASE_URL || !SUPABASE_KEY) {
  throw new Error("CRITICAL: Supabase URL or Key is missing from Environment Variables!");
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: {
    storage: typeof window !== 'undefined' ? window.localStorage : undefined,
    persistSession: typeof window !== 'undefined',
    autoRefreshToken: true,
  }
});
