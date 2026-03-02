import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.8";
import { APP_CONFIG, hasSupabaseConfig } from "../config/appConfig.js";

/**
 * Lazily created Supabase client.
 * Returns null when runtime config is absent so callers can degrade gracefully.
 */
let _client = null;

function buildClient() {
  if (!hasSupabaseConfig()) return null;
  return createClient(APP_CONFIG.SUPABASE_URL, APP_CONFIG.SUPABASE_ANON_KEY, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  });
}

export function getSupabaseClient() {
  if (!_client) {
    _client = buildClient();
  }
  return _client;
}
