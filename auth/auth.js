import {
  createUser,
  getCurrentUser,
  signInUser,
  signOutUser,
} from "./user.js";

const listeners = new Set();

function notify(user) {
  listeners.forEach((callback) => callback(user));
}

export function initAuth() {
  const currentUser = getCurrentUser();
  notify(currentUser);
}

export function onAuthStateChanged(callback) {
  listeners.add(callback);
  callback(getCurrentUser());
  return () => listeners.delete(callback);
}

export function signUp({ email, password, username }) {
  const result = createUser({ email, password, username });
  if (result.user) {
    notify(result.user);
  }
  return result;
}

export function signIn({ email, password }) {
  const result = signInUser({ email, password });
  if (result.user) {
    notify(result.user);
  }
  return result;
}

export function signOut() {
  signOutUser();
  notify(null);
}

export function getUserProfile() {
  return getCurrentUser();
}
