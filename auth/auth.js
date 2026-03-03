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

const listeners = new Set();
let currentUser = null;
let unsubscribeAuthListener = null;

function notify(user) {
  currentUser = user;
  listeners.forEach((callback) => callback(user));
}

export async function initAuth() {
  if (unsubscribeAuthListener) {
    return currentUser;
  }

  // Set up a promise that resolves when auth state is first determined
  const authInitPromise = new Promise((resolve) => {
    let hasInitialized = false;

    unsubscribeAuthListener = onSupabaseAuthStateChange((user) => {
      notify(user);
      if (!hasInitialized) {
        hasInitialized = true;
        resolve(user);
      }
    });
  });

  // Also try to restore from getSession in parallel
  const restoredUser = await getCurrentAppUser();
  if (restoredUser) {
    notify(restoredUser);
  }

  // Wait for the listener to fire with the initial auth state
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
