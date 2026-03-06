import { APP_CONFIG } from "../config/appConfig.js";

function composeNotification({ postTitle, postId, commentAuthor, commentBody, commentCreatedAt }) {
  const timestamp = commentCreatedAt || new Date().toISOString();
  const lines = [
    "New blog comment submitted",
    "",
    `Post: ${postTitle || "Untitled"} (ID: ${postId || "n/a"})`,
    `Author: ${commentAuthor || "Anonymous"}`,
    `Time: ${timestamp}`,
    "",
    "Comment:",
    commentBody || "",
  ];

  return {
    subject: `New blog comment on ${postTitle || "an article"}`,
    text: lines.join("\n"),
  };
}

function tryMailtoFallback(email, subject, text) {
  if (!email || typeof window === "undefined") return;
  const params = new URLSearchParams({ subject, body: text });
  window.open(`mailto:${email}?${params.toString()}`, "_blank", "noopener");
}

/**
 * Sends admin notifications when a new comment is posted.
 *
 * Preferred transport: webhook (set ADMIN_NOTIFICATION_WEBHOOK_URL)
 * Optional fallback: mailto (set ADMIN_NOTIFICATION_MAILTO_FALLBACK=true)
 */
export async function notifyAdminOfNewComment(payload) {
  const adminEmail = APP_CONFIG.ADMIN_NOTIFICATION_EMAIL;
  const webhookUrl = APP_CONFIG.ADMIN_NOTIFICATION_WEBHOOK_URL;
  const { subject, text } = composeNotification(payload || {});

  if (!webhookUrl) {
    if (APP_CONFIG.ADMIN_NOTIFICATION_MAILTO_FALLBACK) {
      tryMailtoFallback(adminEmail, subject, text);
    }
    return { delivered: false, reason: "webhook_not_configured" };
  }

  try {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "new_comment",
        adminEmail,
        subject,
        text,
        ...payload,
      }),
      keepalive: true,
    });

    if (!response.ok) {
      if (APP_CONFIG.ADMIN_NOTIFICATION_MAILTO_FALLBACK) {
        tryMailtoFallback(adminEmail, subject, text);
      }
      return { delivered: false, reason: `webhook_failed_${response.status}` };
    }

    return { delivered: true };
  } catch {
    if (APP_CONFIG.ADMIN_NOTIFICATION_MAILTO_FALLBACK) {
      tryMailtoFallback(adminEmail, subject, text);
    }
    return { delivered: false, reason: "webhook_error" };
  }
}
