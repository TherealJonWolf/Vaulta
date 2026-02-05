import { createClient } from '@supabase/supabase-js';

// Vite requires VITE_ prefixed env vars - process.env does NOT work in client bundles
const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !key) {
  console.error(
    '❌ Missing Supabase environment variables. Ensure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are set.',
    { urlFound: !!url, keyFound: !!key }
  );
}

// Create client - will throw descriptive error if env vars missing
export const supabase = createClient(
  url || 'https://placeholder.supabase.co',
  key || 'placeholder-key',
  {
    auth: {
      storage: typeof window !== 'undefined' ? window.localStorage : undefined,
      persistSession: true,
      autoRefreshToken: true,
    },
  }
);

// Helper to check if Supabase is properly configured
export const isSupabaseConfigured = () => Boolean(url && key);
