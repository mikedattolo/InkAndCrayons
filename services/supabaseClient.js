import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.8";
import { APP_CONFIG, hasSupabaseConfig } from "../config/appConfig.js";

/**
 * Lazily created Supabase client.
 * Returns null when runtime config is absent so callers can degrade gracefully.
 */
let _client = null;
let _initialized = false;

function getSupabaseProjectRef(url) {
  if (!url) return null;

  try {
    const parsed = new URL(url);
    const host = parsed.hostname || "";
    const projectRef = host.split(".")[0];
    return projectRef || null;
  } catch {
    return null;
  }
}

function buildClient() {
  if (!hasSupabaseConfig()) return null;
  const projectRef = getSupabaseProjectRef(APP_CONFIG.SUPABASE_URL);
  const storageKey = projectRef ? `sb-${projectRef}-auth-token` : "sb-token";

  return createClient(APP_CONFIG.SUPABASE_URL, APP_CONFIG.SUPABASE_ANON_KEY, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      storage: typeof localStorage !== 'undefined' ? localStorage : undefined,
      storageKey,
    },
  });
}

/**
 * Get or create the Supabase client.
 * The client automatically loads the session from localStorage on first creation.
 */
export function getSupabaseClient() {
  if (!_client) {
    _client = buildClient();
  }
  return _client;
}

/**
 * Wait for Supabase to initialize.
 * This gives the client time to load the session from localStorage before we try to use it.
 * Safe to call multiple times - resolves immediately after first initialization.
 */
let _initPromise = null;
export async function ensureSupabaseInitialized() {
  if (_initialized) return;

  // If already initializing, wait for the same promise (avoids double getSession)
  if (_initPromise) return _initPromise;

  const client = getSupabaseClient();
  if (!client) return;

  const timeout = new Promise((resolve) => setTimeout(resolve, 5000));
  _initPromise = Promise.race([client.auth.getSession(), timeout])
    .then(() => { _initialized = true; })
    .catch((err) => { console.warn("Supabase session init failed:", err?.message); _initialized = true; })
    .finally(() => { _initPromise = null; });

  return _initPromise;
}
