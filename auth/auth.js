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
let hasCalleddInitAuth = false;

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
  if (!authInitPromise) {
    authInitPromise = new Promise((resolve) => {
      let hasInitialized = false;

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
  }

  // Wait for the listener to fire with the confirmed auth state
  const listenerUser = await authInitPromise;
  
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
