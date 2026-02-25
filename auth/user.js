/**
 * auth/user.js — Local demo auth layer
 *
 * ⚠️  DEV_MODE only — Replace with Firebase / Supabase in production.
 *
 * This module uses localStorage for persistence and a simple hash
 * placeholder.  It is NOT suitable for any public-facing deployment.
 * Swap in a real AuthProvider implementation before going live.
 */

const DEV_MODE = true; // Set to false to disable localStorage auth entirely

/* ── AuthProvider stub ──────────────────────────────────── *
 * Implement this interface with Firebase, Supabase, or any backend.
 *
 * interface AuthProvider {
 *   signIn(email: string, password: string): Promise<{ user?, error? }>
 *   signUp(email: string, password: string, username: string): Promise<{ user?, error? }>
 *   signOut(): Promise<void>
 *   getCurrentUser(): User | null
 *   updateProfile(data: { username?, avatarUrl? }): Promise<{ user?, error? }>
 *   changePassword(data: { currentPassword, newPassword }): Promise<{ success?, error? }>
 * }
 * ─────────────────────────────────────────────────────────── */

const USERS_KEY = "lrl_users";
const SESSION_KEY = "lrl_session";

function readJson(key, fallback) {
  const raw = localStorage.getItem(key);
  if (!raw) return fallback;
  try {
    return JSON.parse(raw);
  } catch (error) {
    console.warn("Stored data corrupted, resetting.");
    return fallback;
  }
}

function writeJson(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

/**
 * Simple hash placeholder for demo passwords.
 * Uses SubtleCrypto-style approach (sync, non-reversible).
 * NOT cryptographically secure — replace with server-side hashing.
 */
function hashPassword(password) {
  let hash = 0;
  for (let i = 0; i < password.length; i++) {
    const ch = password.charCodeAt(i);
    hash = ((hash << 5) - hash + ch) | 0;
  }
  return "demo_" + Math.abs(hash).toString(36);
}

export function loadUsers() {
  if (!DEV_MODE) return [];
  const users = readJson(USERS_KEY, []);
  /* Seed admin account if it doesn't exist yet */
  if (!users.some(u => u.email === "admin@inkandcrayons.com")) {
    users.push({
      id: "user_admin_seed",
      email: "admin@inkandcrayons.com",
      username: "Admin",
      passwordHash: "demo_nyipc3",
      avatar: "default",
      role: "admin",
      createdAt: "2025-01-01T00:00:00.000Z",
    });
    writeJson(USERS_KEY, users);
  }
  return users;
}

export function saveUsers(users) {
  if (!DEV_MODE) return;
  writeJson(USERS_KEY, users);
}

export function getSessionUserId() {
  return readJson(SESSION_KEY, null);
}

export function setSessionUserId(userId) {
  writeJson(SESSION_KEY, userId);
}

export function clearSession() {
  localStorage.removeItem(SESSION_KEY);
}

export function getCurrentUser() {
  if (!DEV_MODE) return null;
  const users = loadUsers();
  const sessionId = getSessionUserId();
  return users.find((user) => user.id === sessionId) || null;
}

export function createUser({ email, username, password }) {
  if (!DEV_MODE) return { error: "Auth disabled — enable DEV_MODE or connect a real provider." };

  const users = loadUsers();
  const normalizedEmail = email.toLowerCase();

  if (users.some((user) => user.email === normalizedEmail)) {
    return { error: "Email already in use." };
  }

  if (users.some((user) => user.username.toLowerCase() === username.toLowerCase())) {
    return { error: "Username already taken." };
  }

  const newUser = {
    id: `user_${Date.now()}`,
    email: normalizedEmail,
    username,
    passwordHash: hashPassword(password),
    avatar: "default",
    role: "user",
    createdAt: new Date().toISOString(),
  };

  users.push(newUser);
  saveUsers(users);
  setSessionUserId(newUser.id);

  return { user: newUser };
}

export function signInUser({ email, password }) {
  if (!DEV_MODE) return { error: "Auth disabled — enable DEV_MODE or connect a real provider." };

  const users = loadUsers();
  const normalizedEmail = email.toLowerCase();
  const pw = hashPassword(password);

  const user = users.find(
    (item) => item.email === normalizedEmail && item.passwordHash === pw,
  );

  if (!user) {
    return { error: "Invalid email or password." };
  }

  setSessionUserId(user.id);
  return { user };
}

export function signOutUser() {
  clearSession();
}

/* ── Account Management ─────────────────────────────────── */

export function updateProfile({ username, avatarUrl }) {
  if (!DEV_MODE) return { error: "Auth disabled." };
  const users = loadUsers();
  const sessionId = getSessionUserId();
  const user = users.find((u) => u.id === sessionId);
  if (!user) return { error: "Not signed in." };

  if (username && username !== user.username) {
    const taken = users.some(
      (u) => u.id !== user.id && u.username.toLowerCase() === username.toLowerCase(),
    );
    if (taken) return { error: "Username already taken." };
    user.username = username;
  }

  if (avatarUrl !== undefined) {
    user.avatarUrl = avatarUrl;
  }

  saveUsers(users);
  return { user };
}

export function changePassword({ currentPassword, newPassword }) {
  if (!DEV_MODE) return { error: "Auth disabled." };
  const users = loadUsers();
  const sessionId = getSessionUserId();
  const user = users.find((u) => u.id === sessionId);
  if (!user) return { error: "Not signed in." };

  if (user.passwordHash !== hashPassword(currentPassword)) {
    return { error: "Current password is incorrect." };
  }

  user.passwordHash = hashPassword(newPassword);
  saveUsers(users);
  return { success: true };
}

/* ── Payment Methods (localStorage demo) ─────────────── */
const PAYMENTS_KEY = "lrl_payments";

export function getPaymentMethods() {
  const sessionId = getSessionUserId();
  if (!sessionId) return [];
  const all = readJson(PAYMENTS_KEY, {});
  return all[sessionId] || [];
}

export function addPaymentMethod({ name, lastFour, expiry }) {
  const sessionId = getSessionUserId();
  if (!sessionId) return { error: "Not signed in." };
  const all = readJson(PAYMENTS_KEY, {});
  const methods = all[sessionId] || [];
  methods.push({
    id: `card_${Date.now()}`,
    name,
    lastFour,
    expiry,
    addedAt: new Date().toISOString(),
  });
  all[sessionId] = methods;
  writeJson(PAYMENTS_KEY, all);
  return { success: true };
}

export function removePaymentMethod(cardId) {
  const sessionId = getSessionUserId();
  if (!sessionId) return;
  const all = readJson(PAYMENTS_KEY, {});
  all[sessionId] = (all[sessionId] || []).filter((c) => c.id !== cardId);
  writeJson(PAYMENTS_KEY, all);
}
