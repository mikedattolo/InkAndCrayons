import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.8";
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "../config/supabaseConfig.js";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

export function getSupabaseClient() {
  return supabase;
}
