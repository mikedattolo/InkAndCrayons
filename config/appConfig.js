const runtimeConfig = globalThis.__LRL_CONFIG__ || {};

export const APP_CONFIG = {
  SUPABASE_URL: (runtimeConfig.SUPABASE_URL || "").trim(),
  SUPABASE_ANON_KEY: (runtimeConfig.SUPABASE_ANON_KEY || "").trim(),
};

export function hasSupabaseConfig() {
  return Boolean(APP_CONFIG.SUPABASE_URL && APP_CONFIG.SUPABASE_ANON_KEY);
}
