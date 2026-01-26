import { supabase } from './integrations/supabase/client';

export default function Application() {
  if (!supabase) {
    return (
      <div style={{ padding: 24, color: 'red' }}>
        <h1>Supabase not initialized</h1>
        <p>
          Check Netlify / Railway environment variables:
        </p>
        <ul>
          <li>VITE_SUPABASE_URL</li>
          <li>VITE_SUPABASE_ANON_KEY</li>
        </ul>
      </div>
    );
  }

  return (
    <div style={{ padding: 24 }}>
      <h1>App loaded successfully ✅</h1>
    </div>
  );
}
