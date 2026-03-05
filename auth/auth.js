import {
  getCurrentAppUser,
  onSupabaseAuthStateChange,
  requestPasswordReset,
  signInWithEmail,
  signOutAuth,
  signUpWithEmail,
  updateCurrentProfile,
  updatePassword,
} from "./supabaseAuth.js";
import { ensureSupabaseInitialized } from "../services/supabaseClient.js";

const listeners = new Set();
let currentUser = null;
let unsubscribeAuthListener = null;
let authInitPromise = null;
let hasCalledInitAuth = false;

function notify(user) {
  currentUser = user;
  listeners.forEach((callback) => callback(user));
}

export async function initAuth() {
  // If we've already called initAuth and set up the listener, just wait for/return the current state
  if (hasCalledInitAuth) {
    // If there's still an initialization promise, wait for it
    if (authInitPromise) {
      await authInitPromise;
    }
    return currentUser;
  }

  hasCalledInitAuth = true;

  // Ensure Supabase has loaded the session from localStorage
  await ensureSupabaseInitialized();

  // Create the initialization promise if we haven't already
  let resolveAuth;
  let hasInitialized = false;

  if (!authInitPromise) {
    authInitPromise = new Promise((resolve) => {
      resolveAuth = resolve;

      unsubscribeAuthListener = onSupabaseAuthStateChange((user) => {
        notify(user);
        if (!hasInitialized) {
          hasInitialized = true;
          resolve(user);
        }
      });
    });
  }

  // Try to restore from getSession immediately while listener sets up
  const restoredUser = await getCurrentAppUser();
  if (restoredUser) {
    notify(restoredUser);
    // Resolve the promise immediately if Supabase listener hasn't fired yet.
    // This prevents initAuth() from hanging when onAuthStateChange is slow/delayed.
    if (!hasInitialized && resolveAuth) {
      hasInitialized = true;
      resolveAuth(restoredUser);
    }
  }

  // Wait for auth to resolve (either from listener above or restoredUser fallback)
  // Add a safety timeout so we never hang indefinitely
  const timeoutFallback = new Promise(resolve => setTimeout(() => resolve(null), 5000));
  const listenerUser = await Promise.race([authInitPromise, timeoutFallback]);

  return listenerUser || restoredUser;
}

export function onAuthStateChanged(callback) {
  listeners.add(callback);
  callback(currentUser);
  return () => listeners.delete(callback);
}

export async function signUp({ email, password, username }) {
  const result = await signUpWithEmail({ email, password, username });
  if (result.user) {
    notify(result.user);
  }
  return result;
}

export async function signIn({ email, password }) {
  const result = await signInWithEmail({ email, password });
  if (result.user) {
    notify(result.user);
  }
  return result;
}

export async function signOut() {
  await signOutAuth();
  notify(null);
}

export function getUserProfile() {
  return currentUser;
}

/**
 * TEMP migration helper: legacy demo-auth localStorage snapshot.
 * localStorage is origin-bound and won't move automatically across domains.
 */
export function getLegacyAuthStorageSnapshot() {
  const keys = ["lrl_users", "lrl_session"];
  const snapshot = {};

  keys.forEach((key) => {
    const raw = localStorage.getItem(key);
    if (raw === null) return;
    try {
      snapshot[key] = JSON.parse(raw);
    } catch {
      snapshot[key] = raw;
    }
  });

  return snapshot;
}

export async function updateUserProfile(data) {
  const result = await updateCurrentProfile(data);
  if (result.user) notify(result.user);
  return result;
}

export async function changeUserPassword(data) {
  const next = data?.newPassword;
  if (!next || next.length < 8) {
    return { error: "Password must be at least 8 characters." };
  }
  return updatePassword({ newPassword: next });
}

export async function sendPasswordResetEmail(email) {
  const redirectTo = `${window.location.origin}${window.location.pathname}`;
  return requestPasswordReset(email, redirectTo);
}

export function getPaymentMethods() {
  return [];
}

export function addPaymentMethod() {
  return { error: "Card storage is disabled for security. Use external checkout links only." };
}

export function removePaymentMethod() {
  return { error: "Card storage is disabled for security." };
}
