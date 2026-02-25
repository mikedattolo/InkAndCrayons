import { signIn, signOut, signUp, onAuthStateChanged } from "../auth/auth.js";

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

  function handleSubmit(mode) {
    const email = emailInput.value.trim();
    const password = passwordInput.value.trim();
    const username = usernameInput.value.trim();

    if (!email || !password || (mode === "signup" && !username)) {
      return { error: "Please complete all fields." };
    }

    if (mode === "signup") {
      return signUp({ email, password, username });
    }

    return signIn({ email, password });
  }

  formEl.addEventListener("submit", (event) => {
    event.preventDefault();
    const result = handleSubmit("signup");
    if (result.error) {
      statusEl.textContent = result.error;
      return;
    }
    setGateOpen(false);
  });

  signInButton.addEventListener("click", () => {
    const result = handleSubmit("signin");
    if (result.error) {
      statusEl.textContent = result.error;
      return;
    }
    setGateOpen(false);
  });

  signOutButton?.addEventListener("click", () => {
    signOut();
    setGateOpen(true);
  });

  onAuthStateChanged((user) => {
    setStatus(user);
    // Don't auto-open the gate — allow public browsing
  });

  return {
    setGateOpen,
  };
}
