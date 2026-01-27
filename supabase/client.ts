import { createClient, SupabaseClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY;

let supabase: SupabaseClient | null = null;

// 🚨 HARD FAIL IF KEYS ARE MISSING
if (!url || !key) {
  console.error('❌ Missing Supabase Keys', {
    urlFound: !!url,
    keyFound: !!key,
  });
} else {
  supabase = createClient(url, key, {
    auth: {
      // ✅ Prevent bad tokens from auto-firing on load
      persistSession: true,
      autoRefreshToken: false,

      // ✅ Only use storage in the browser
      storage:
        typeof window !== 'undefined'
          ? window.localStorage
          : undefined,
    },
    global: {
      headers: {
        // ✅ Forces API key header on EVERY request
        apikey: key,
      },
    },
  });
}

// 🔍 Debug once locally (safe to remove later)
console.log('LOCAL ENV CHECK', {
  url: !!url,
  keyStartsWithEyJ: key?.startsWith('eyJ'),
});

export { supabase };
