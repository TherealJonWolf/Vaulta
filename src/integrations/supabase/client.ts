import { createClient } from '@supabase/supabase-js';

// 1. We grab the keys from Railway (process.env) or Netlify (import.meta.env)
const url = process.env.SUPABASE_URL || import.meta.env?.VITE_SUPABASE_URL;
const key = process.env.SUPABASE_PUBLISHABLE_KEY || import.meta.env?.VITE_SUPABASE_PUBLISHABLE_KEY;

// 2. This checks if they are missing and tells you in the logs
if (!url || !key) {
  console.error("Missing Supabase Keys! URL found:", !!url, " Key found:", !!key);
}

// 3. We create the client just ONE time with the safety check for browser storage
export const supabase = createClient(url || '', key || '', {
  auth: {
    storage: typeof window !== 'undefined' ? window.localStorage : undefined,
    persistSession: typeof window !== 'undefined',
    autoRefreshToken: true,
  }
});
