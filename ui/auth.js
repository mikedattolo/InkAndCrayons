import {
  onAuthStateChanged,
  sendPasswordResetEmail,
  signIn,
  signOut,
  signUp,
} from "../auth/auth.js";
import { isValidEmail, isValidUsername, sanitizeSingleLine } from "../utils/validation.js";

export function createAuthGate({
  gateEl,
  formEl,
  emailInput,
  passwordInput,
  usernameInput,
  statusEl,
  signOutButton,
  signInButton,
  signUpButton,
  forgotPasswordButton,
}) {
  function setGateOpen(isOpen) {
    gateEl.setAttribute("aria-hidden", String(!isOpen));
    if (isOpen) {
      emailInput.focus();
    }
  }

  function setStatus(user) {
    if (user) {
      statusEl.textContent = `Signed in as ${user.username}`;
      if (signOutButton) signOutButton.hidden = false;
      return;
    }
    statusEl.textContent = "Please sign in to begin.";
    if (signOutButton) signOutButton.hidden = true;
  }

  async function handleSubmit(mode) {
    const email = sanitizeSingleLine(emailInput.value, 120).toLowerCase();
    const password = passwordInput.value.trim();
    const username = sanitizeSingleLine(usernameInput.value, 20);

    if (!email || !password || (mode === "signup" && !username)) {
      return { error: "Please complete all fields." };
    }

    if (!isValidEmail(email)) {
      return { error: "Please enter a valid email." };
    }

    if (mode === "signup" && !isValidUsername(username)) {
      return { error: "Username must be 2-20 chars and use letters, numbers, spaces, dot, dash, or underscore." };
    }

    if (mode === "signup") {
      return signUp({ email, password, username });
    }

    return signIn({ email, password });
  }

  formEl.addEventListener("submit", async (event) => {
    event.preventDefault();
    statusEl.textContent = "Creating account...";
    const result = await handleSubmit("signup");
    if (result.error) {
      statusEl.textContent = result.error;
      return;
    }
    statusEl.textContent = result.needsEmailConfirmation
      ? "Account created. Check your inbox to confirm your email."
      : "Account created.";
    setGateOpen(false);
  });

  signInButton.addEventListener("click", async () => {
    statusEl.textContent = "Signing in...";
    const result = await handleSubmit("signin");
    if (result.error) {
      statusEl.textContent = result.error;
      return;
    }
    statusEl.textContent = "Signed in.";
    setGateOpen(false);
  });

  signOutButton?.addEventListener("click", async () => {
    await signOut();
    setGateOpen(true);
  });

  forgotPasswordButton?.addEventListener("click", async () => {
    const email = sanitizeSingleLine(emailInput.value, 120).toLowerCase();
    if (!isValidEmail(email)) {
      statusEl.textContent = "Enter your email, then click Reset Password.";
      return;
    }

    const result = await sendPasswordResetEmail(email);
    statusEl.textContent = result.error
      ? result.error
      : "Password reset email sent (if the account exists).";
  });

  onAuthStateChanged((user) => {
    setStatus(user);
    // Don't auto-open the gate — allow public browsing
  });

  return {
    setGateOpen,
  };
}
