/**
 * utils/commentModeration.js
 *
 * Frontend comment moderation: normalisation + banned-word matching.
 * Deliberately lightweight — no AI, no network calls.
 *
 * Usage:
 *   const result = moderateComment(rawText);
 *   if (!result.allowed) { show(result.reason); }
 */

/* ── Normalisation ─────────────────────────────────────── */

/**
 * Normalise text so basic evasion tricks (L33t, repeated chars,
 * embedded punctuation) are less effective.
 */
export function normaliseText(text) {
  return String(text || "")
    .toLowerCase()
    // l33t / homoglyph substitutions
    .replace(/[@]/g, "a")
    .replace(/[3]/g, "e")
    .replace(/[1!|]/g, "i")
    .replace(/[0]/g, "o")
    .replace(/[5$]/g, "s")
    .replace(/[7]/g, "t")
    .replace(/[+]/g, "t")
    // Strip punctuation/spaces that might pad slurs
    .replace(/[\s\-_.,'";:!?*]/g, "")
    // Collapse runs of identical characters (e.g. "haaaate" → "hate")
    .replace(/(.)\1{2,}/g, "$1");
}

/* ── Banned-word list ──────────────────────────────────── */

/**
 * Expandable list of patterns blocked on submit.
 * Keep terms in normalised form (lowercase, no spaced punctuation).
 *
 * Severity levels:
 *   "hate"    — slurs, targeted hate speech (block always)
 *   "abuse"   — severe personal attacks/threats
 *   "spam"    — obvious spam signals
 */
const BANNED = [
  // Hate speech / slurs (normalised stems)
  { pattern: /\bn[i1!|]g{1,2}[e3]r/, severity: "hate" },
  { pattern: /\bn[i1!|]g{1,2}a/, severity: "hate" },
  { pattern: /\bf[a@]g{1,2}[o0]t/, severity: "hate" },
  { pattern: /\bk[i1!|]k[e3]/, severity: "hate" },
  { pattern: /\bsp[i1!|]c/, severity: "hate" },
  { pattern: /\bch[i1!|]nk/, severity: "hate" },
  { pattern: /\bw[e3]tb[a@]ck/, severity: "hate" },
  { pattern: /\bcunt/, severity: "hate" },
  { pattern: /\btr[a@]nn[yi1!|]/, severity: "hate" },
  // Severe abuse / threats
  { pattern: /\bkill\s*your\s*self/, severity: "abuse" },
  { pattern: /\bkys\b/, severity: "abuse" },
  { pattern: /\bkms\b/, severity: "abuse" },
  { pattern: /\bi\s*will\s*kill/, severity: "abuse" },
  { pattern: /\byou\s*should\s*die/, severity: "abuse" },
  // Spam
  { pattern: /\bclick\s*here\b/i, severity: "spam" },
  { pattern: /\bbuy\s*now\b/i, severity: "spam" },
  { pattern: /https?:\/\/[^\s]{20,}/i, severity: "spam" },
];

/* ── Public API ────────────────────────────────────────── */

/**
 * @typedef {{ allowed: boolean, reason: string | null, severity: string | null }} ModerationResult
 */

/**
 * Check `rawText` against the moderation rules.
 * @param {string} rawText
 * @returns {ModerationResult}
 */
export function moderateComment(rawText) {
  const normalised = normaliseText(rawText);

  for (const entry of BANNED) {
    if (entry.pattern.test(normalised)) {
      return {
        allowed: false,
        reason: friendlyReason(entry.severity),
        severity: entry.severity,
      };
    }
  }

  return { allowed: true, reason: null, severity: null };
}

function friendlyReason(severity) {
  switch (severity) {
    case "hate":
      return "Your comment contains language that isn't allowed here. Please keep the conversation kind and respectful.";
    case "abuse":
      return "That message can't be posted. Please be respectful of others.";
    case "spam":
      return "Looks like spam — external links or promotional phrases aren't allowed in comments.";
    default:
      return "Your comment couldn't be posted. Please review our community guidelines.";
  }
}
