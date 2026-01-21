import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.https://lgjaythendsbnjkthwsd.supabase.co;
const supabasePublishableKey = import.meta.env.sb_publishable_bg2pJDeKb6loAP-eAmq_qA_9ZZCYmUC;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error("Missing Supabase environment variables");
}

export const supabase = createClient(
  supabaseUrl,
  supabaseAnonKey
);
