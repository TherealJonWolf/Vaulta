import { createClient, SupabaseClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY;

let supabase: SupabaseClient | null = null;

if (!url || !key) {
  console.error(
    '❌ Missing Supabase Keys',
    { urlFound: !!url, keyFound: !!key }
  );
} else {
  supabase = createClient(url, key, {
    auth: {
      storage: typeof window !== 'undefined' ? window.localStorage : undefined,
      persistSession: typeof window !== 'undefined',
      autoRefreshToken: true,
    },
  });
}

export { supabase };
