import {
  onAuthStateChanged,
  sendPasswordResetEmail,
  signIn,
  signOut,
  signUp,
} from "../auth/auth.js";
import { isValidEmail, isValidUsername, sanitizeSingleLine } from "../utils/validation.js";

/* ── Validation helpers ──────────────────────────────────────────────────── */

function fieldError(input) {
  if (input) input.classList.add("gate__input--error");
}

function clearFieldErrors(...inputs) {
  inputs.forEach((el) => { if (el) el.classList.remove("gate__input--error"); });
}

function validateSignIn(email, password) {
  if (!email || !password) return "Please enter your email and password.";
  if (!isValidEmail(email)) return "Please enter a valid email address.";
  return null;
}

function validateSignUp(email, password, confirm, username) {
  if (!email || !password || !confirm || !username) return "Please fill in all fields.";
  if (!isValidEmail(email)) return "Please enter a valid email address.";
  if (password.length < 8) return "Password must be at least 8 characters.";
  if (password !== confirm) return "Passwords do not match.";
  if (!isValidUsername(username)) {
    return "Username must be 2\u201320 characters (letters, numbers, dot, dash, or underscore).";
  }
  return null;
}

/* ── Main factory ────────────────────────────────────────────────────────── */

export function createAuthGate({
  gateEl,
  formEl,
  emailInput,
  passwordInput,
  usernameInput,
  statusEl,
  signOutButton,
  signInButton,     // legacy — now optional; mode is handled internally
  signUpButton,     // single submit button
  forgotPasswordButton,
}) {
  /* Internal state */
  let mode = "signin"; // "signin" | "signup" | "reset"
  let loading = false;

  /* Internal DOM refs queried from gateEl */
  const tabSignIn      = gateEl.querySelector("#gateTabSignIn");
  const tabSignUp      = gateEl.querySelector("#gateTabSignUp");
  const signUpFields   = gateEl.querySelector("#gateSignUpFields");
  const confirmPwInput = gateEl.querySelector("#gateConfirmPw");

  /* ── Helpers ─────────────────────────────────────────────────────────── */

  function setGateOpen(isOpen) {
    gateEl.setAttribute("aria-hidden", String(!isOpen));
    if (isOpen) setTimeout(() => emailInput?.focus(), 60);
  }

  function setStatus(message, type = "info") {
    if (!statusEl) return;
    statusEl.textContent = message || "";
    statusEl.className = "gate__status";
    if (message) statusEl.classList.add(`gate__status--${type}`);
  }

  function submitLabel() {
    if (mode === "signup") return "Create Account";
    if (mode === "reset") return "Send Reset Link";
    return "Sign In";
  }

  function setLoading(isLoading) {
    loading = isLoading;
    if (signUpButton) {
      signUpButton.disabled = isLoading;
      signUpButton.textContent = isLoading
        ? (mode === "signup" ? "Creating account\u2026" : mode === "reset" ? "Sending\u2026" : "Signing in\u2026")
        : submitLabel();
    }
  }

  function applyMode(nextMode) {
    mode = nextMode;

    if (tabSignIn) {
      const active = mode === "signin" || mode === "reset";
      tabSignIn.classList.toggle("gate__tab--active", active);
      tabSignIn.setAttribute("aria-selected", String(active));
    }
    if (tabSignUp) {
      tabSignUp.classList.toggle("gate__tab--active", mode === "signup");
      tabSignUp.setAttribute("aria-selected", String(mode === "signup"));
    }

    if (signUpFields) signUpFields.hidden = mode !== "signup";
    if (passwordInput) {
      passwordInput.autocomplete = mode === "signup" ? "new-password" : "current-password";
    }
    if (signUpButton) signUpButton.textContent = submitLabel();

    if (forgotPasswordButton) {
      const show = mode === "signin";
      forgotPasswordButton.style.display = show ? "" : "none";
    }

    setStatus("");
    clearFieldErrors(emailInput, passwordInput, confirmPwInput, usernameInput);
  }

  /* ── Submit handlers ─────────────────────────────────────────────────── */

  async function handleSignIn() {
    const email    = sanitizeSingleLine(emailInput?.value || "", 120).toLowerCase();
    const password = passwordInput?.value || "";

    clearFieldErrors(emailInput, passwordInput);
    const err = validateSignIn(email, password);
    if (err) {
      setStatus(err, "error");
      if (err.includes("email")) fieldError(emailInput);
      return;
    }

    setLoading(true);
    setStatus("Signing in\u2026", "info");
    const result = await signIn({ email, password });
    setLoading(false);

    if (result.error) { setStatus(friendlyAuthError(result.error), "error"); return; }
    setStatus("Signed in!", "success");
    setTimeout(() => setGateOpen(false), 500);
  }

  async function handleSignUp() {
    const email    = sanitizeSingleLine(emailInput?.value || "", 120).toLowerCase();
    const password = passwordInput?.value || "";
    const confirm  = confirmPwInput?.value || "";
    const username = sanitizeSingleLine(usernameInput?.value || "", 20);

    clearFieldErrors(emailInput, passwordInput, confirmPwInput, usernameInput);
    const err = validateSignUp(email, password, confirm, username);
    if (err) {
      setStatus(err, "error");
      if (err.includes("email"))    fieldError(emailInput);
      if (err.includes("Password") || err.includes("match")) {
        fieldError(passwordInput);
        fieldError(confirmPwInput);
      }
      if (err.includes("Username")) fieldError(usernameInput);
      return;
    }

    setLoading(true);
    setStatus("Creating your account\u2026", "info");
    const result = await signUp({ email, password, username });
    setLoading(false);

    if (result.error) { setStatus(friendlyAuthError(result.error), "error"); return; }

    if (result.needsEmailConfirmation) {
      setStatus("Account created! Check your inbox to confirm your email before signing in.", "success");
    } else {
      setStatus("Welcome! Your account is ready.", "success");
      setTimeout(() => setGateOpen(false), 800);
    }
  }

  async function handleReset() {
    const email = sanitizeSingleLine(emailInput?.value || "", 120).toLowerCase();
    if (!isValidEmail(email)) {
      setStatus("Enter your email address first.", "error");
      fieldError(emailInput);
      return;
    }

    setLoading(true);
    setStatus("Sending reset link\u2026", "info");
    const result = await sendPasswordResetEmail(email);
    setLoading(false);

    setStatus(
      result.error
        ? friendlyAuthError(result.error)
        : "If that address is in our system, you\u2019ll receive a reset link shortly.",
      result.error ? "error" : "success"
    );
    if (!result.error) setTimeout(() => applyMode("signin"), 3000);
  }

  /* ── Event listeners ─────────────────────────────────────────────────── */

  formEl.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (loading) return;
    if (mode === "signup")     await handleSignUp();
    else if (mode === "reset") await handleReset();
    else                       await handleSignIn();
  });

  tabSignIn?.addEventListener("click", () => { if (mode !== "signin") applyMode("signin"); });
  tabSignUp?.addEventListener("click", () => { if (mode !== "signup") applyMode("signup"); });

  forgotPasswordButton?.addEventListener("click", () => {
    applyMode(mode === "reset" ? "signin" : "reset");
  });

  signOutButton?.addEventListener("click", async () => {
    await signOut();
    setGateOpen(true);
  });

  onAuthStateChanged((user) => {
    if (signOutButton) signOutButton.hidden = !user;
    // Don't auto-open gate — allow public browsing
  });

  /* Initialise */
  applyMode("signin");

  return { setGateOpen };
}

/* ── Map Supabase errors to friendly copy ───────────────────────────────── */
function friendlyAuthError(raw) {
  const msg = String(raw).toLowerCase();
  if (msg.includes("invalid login") || msg.includes("invalid credentials") || msg.includes("email not confirmed")) {
    return "Incorrect email or password. Please try again.";
  }
  if (msg.includes("email already") || msg.includes("already registered") || msg.includes("user already")) {
    return "An account with that email already exists. Try signing in instead.";
  }
  if (msg.includes("weak password") || msg.includes("password should")) {
    return "Password is too weak. Use at least 8 characters with a mix of letters and numbers.";
  }
  if (msg.includes("rate limit") || msg.includes("too many")) {
    return "Too many attempts. Please wait a moment before trying again.";
  }
  if (msg.includes("network") || msg.includes("fetch")) {
    return "Network error. Check your connection and try again.";
  }
  if (msg.includes("not available") || msg.includes("not configured")) {
    return "Sign-in is not available right now. Please try again later.";
  }
  return raw.replace(/\[.*?\]/g, "").trim() || "Something went wrong. Please try again.";
}
