const runtimeConfig = globalThis.__LRL_CONFIG__ || {};

export const APP_CONFIG = {
  SUPABASE_URL: (runtimeConfig.SUPABASE_URL || "").trim(),
  SUPABASE_ANON_KEY: (runtimeConfig.SUPABASE_ANON_KEY || "").trim(),
  ADMIN_NOTIFICATION_EMAIL: (runtimeConfig.ADMIN_NOTIFICATION_EMAIL || "cmvillanella@gmail.com").trim(),
  ADMIN_NOTIFICATION_WEBHOOK_URL: (runtimeConfig.ADMIN_NOTIFICATION_WEBHOOK_URL || "").trim(),
  ADMIN_NOTIFICATION_MAILTO_FALLBACK: Boolean(runtimeConfig.ADMIN_NOTIFICATION_MAILTO_FALLBACK),
};

export function hasSupabaseConfig() {
  return Boolean(APP_CONFIG.SUPABASE_URL && APP_CONFIG.SUPABASE_ANON_KEY);
}
