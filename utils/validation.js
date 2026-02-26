const USERNAME_RE = /^[a-zA-Z0-9 _.-]{2,20}$/;

export function sanitizeSingleLine(input, maxLength = 120) {
  return String(input || "")
    .replace(/[\u0000-\u001F\u007F]/g, "")
    .trim()
    .slice(0, maxLength);
}

export function sanitizeMultiline(input, maxLength = 8000) {
  return String(input || "")
    .replace(/\r\n/g, "\n")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .trim()
    .slice(0, maxLength);
}

export function isValidUsername(username) {
  return USERNAME_RE.test(username);
}

export function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || "").trim());
}

export function isValidHttpUrl(url) {
  if (!url) return false;
  try {
    const parsed = new URL(url);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

export function safeUrlOrEmpty(url) {
  const trimmed = String(url || "").trim();
  return isValidHttpUrl(trimmed) ? trimmed : "";
}
