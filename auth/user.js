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

function encodePassword(password) {
  // Local demo-only encoding. Replace with real auth provider handling.
  return btoa(unescape(encodeURIComponent(password)));
}

export function loadUsers() {
  return readJson(USERS_KEY, []);
}

export function saveUsers(users) {
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
  const users = loadUsers();
  const sessionId = getSessionUserId();
  return users.find((user) => user.id === sessionId) || null;
}

export function createUser({ email, username, password }) {
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
    passwordHash: encodePassword(password),
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
  const users = loadUsers();
  const normalizedEmail = email.toLowerCase();
  const passwordHash = encodePassword(password);

  // Built-in local admin for offline management
  if (normalizedEmail === "admin@local" && password === "admin123") {
    const admin = {
      id: "admin_local",
      email: "admin@local",
      username: "Admin",
      role: "admin",
      avatar: "default",
      createdAt: new Date().toISOString(),
    };
    setSessionUserId(admin.id);
    return { user: admin };
  }

  const user = users.find(
    (item) => item.email === normalizedEmail && item.passwordHash === passwordHash
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
  const users = loadUsers();
  const sessionId = getSessionUserId();
  const user = users.find((u) => u.id === sessionId);
  if (!user) return { error: "Not signed in." };

  if (username && username !== user.username) {
    const taken = users.some(
      (u) => u.id !== user.id && u.username.toLowerCase() === username.toLowerCase()
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
  const users = loadUsers();
  const sessionId = getSessionUserId();
  const user = users.find((u) => u.id === sessionId);
  if (!user) return { error: "Not signed in." };

  if (user.passwordHash !== encodePassword(currentPassword)) {
    return { error: "Current password is incorrect." };
  }

  user.passwordHash = encodePassword(newPassword);
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
