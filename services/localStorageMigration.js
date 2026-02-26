import { getCurrentAppUser } from "../auth/supabaseAuth.js";
import { getSupabaseClient } from "./supabaseClient.js";
import { sanitizeMultiline, sanitizeSingleLine } from "../utils/validation.js";

export const LEGACY_STORAGE_KEYS = [
  "lrl_users",
  "lrl_session",
  "lrl_posts",
  "lrl_comments",
  "lrl_likes",
  "lrl_deleted_posts",
  "lrl_writers",
  "lrl_chat_messages",
  "lrl_books_override",
  "lrl_shop_override",
  "lrl_announcements_override",
  "lrl_payments",
  "lrl_posts_seed_version",
];

function parseStoredValue(raw) {
  if (raw == null) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
}

function readLegacyJson(key, fallback) {
  const raw = localStorage.getItem(key);
  if (!raw) return fallback;
  try {
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function mapLegacyPosts(posts) {
  return (posts || []).map((post, index) => ({
    id: post.id || `legacy_${index}`,
    title: sanitizeSingleLine(post.title || "Untitled", 200),
    body: sanitizeMultiline(String(post.body || ""), 20000),
    category: sanitizeSingleLine(post.category || "all", 60) || "all",
    authorName: sanitizeSingleLine(post.author || "Legacy Import", 80),
    createdAt: post.createdAt || post.date || new Date().toISOString(),
    updatedAt: post.updatedAt || null,
  }));
}

function mapLegacyComments(commentMap) {
  const list = [];
  Object.entries(commentMap || {}).forEach(([postId, comments]) => {
    (comments || []).forEach((comment) => {
      list.push({
        id: comment.id || `${postId}_${Date.now()}`,
        postId,
        authorName: sanitizeSingleLine(comment.author || "Legacy User", 80),
        body: sanitizeMultiline(String(comment.body || ""), 2000),
        createdAt: comment.createdAt || new Date().toISOString(),
      });
    });
  });
  return list;
}

/**
 * IMPORTANT MIGRATION WARNING:
 * localStorage is bound to browser + exact origin (scheme + host + port).
 * Deploying to a new domain/origin will not carry localStorage automatically.
 * Run backup/export before switching domain or deleting old data.
 */
export function detectProjectLocalStorageKeys() {
  const detected = LEGACY_STORAGE_KEYS.filter((key) => localStorage.getItem(key) !== null);
  return {
    origin: window.location.origin,
    detected,
  };
}

export function exportLegacyLocalStorageData() {
  const payload = {
    version: 1,
    exportedAt: new Date().toISOString(),
    origin: window.location.origin,
    keys: {},
  };

  LEGACY_STORAGE_KEYS.forEach((key) => {
    const raw = localStorage.getItem(key);
    if (raw !== null) {
      payload.keys[key] = parseStoredValue(raw);
    }
  });

  return payload;
}

export function downloadLegacyBackup(filename = "lrl-localstorage-backup.json") {
  const data = exportLegacyLocalStorageData();
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
  return data;
}

export async function importLegacyToSupabase({ includeComments = true, includeLikes = false } = {}) {
  const supabase = getSupabaseClient();
  if (!supabase) {
    return { error: "Supabase is not configured." };
  }

  const currentUser = await getCurrentAppUser();
  if (!currentUser) {
    return { error: "Sign in first to run migration import." };
  }

  const legacyPosts = mapLegacyPosts(readLegacyJson("lrl_posts", []));
  const legacyComments = mapLegacyComments(readLegacyJson("lrl_comments", {}));

  if (!legacyPosts.length) {
    return {
      success: true,
      insertedPosts: 0,
      insertedComments: 0,
      skippedLikes: includeLikes,
      note: "No legacy posts found in localStorage.",
    };
  }

  const insertedPostIds = new Map();
  let insertedPosts = 0;
  let insertedComments = 0;

  for (const post of legacyPosts) {
    const { data, error } = await supabase
      .from("posts")
      .insert({
        author_id: currentUser.id,
        author_name: post.authorName,
        title: post.title,
        body: post.body,
        category: post.category,
        created_at: post.createdAt,
      })
      .select("id")
      .single();

    if (!error && data?.id) {
      insertedPosts += 1;
      insertedPostIds.set(post.id, data.id);
    }
  }

  if (includeComments && insertedPostIds.size) {
    for (const comment of legacyComments) {
      const mappedPostId = insertedPostIds.get(comment.postId);
      if (!mappedPostId) continue;

      const { error } = await supabase.from("comments").insert({
        post_id: mappedPostId,
        author_id: currentUser.id,
        author_name: comment.authorName,
        body: comment.body,
        created_at: comment.createdAt,
      });

      if (!error) {
        insertedComments += 1;
      }
    }
  }

  return {
    success: true,
    insertedPosts,
    insertedComments,
    skippedLikes: includeLikes,
    warning: includeLikes
      ? "Legacy like migration is skipped in client mode because user identity mapping is not reliable."
      : undefined,
  };
}

export function registerMigrationUtilities() {
  window.LRLMigration = {
    detectProjectLocalStorageKeys,
    exportLegacyLocalStorageData,
    downloadLegacyBackup,
    importLegacyToSupabase,
    legacyKeys: LEGACY_STORAGE_KEYS,
  };
}
