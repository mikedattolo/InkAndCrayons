import { getSupabaseClient } from "./supabaseClient.js";
import { sanitizeMultiline, sanitizeSingleLine } from "../utils/validation.js";

const POSTS_TABLE = "posts";
const COMMENTS_TABLE = "comments";
const LIKES_TABLE = "likes";
const PROFILES_TABLE = "profiles";

function normalizePost(row) {
  return {
    id: row.id,
    title: row.title,
    body: row.body,
    author: row.author_name || "Anonymous",
    authorId: row.author_id,
    category: row.category || "all",
    date: row.created_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at || null,
    source: "supabase",
  };
}

function normalizeComment(row) {
  return {
    id: row.id,
    postId: row.post_id,
    author: row.author_name || "Anonymous",
    authorId: row.author_id,
    body: row.body,
    createdAt: row.created_at,
  };
}

export async function fetchPosts() {
  const supabase = getSupabaseClient();
  if (!supabase) {
    return { error: "Supabase is not configured.", data: [] };
  }

  const { data, error } = await supabase
    .from(POSTS_TABLE)
    .select("id, title, body, category, author_id, author_name, created_at, updated_at")
    .order("created_at", { ascending: false });

  if (error) {
    return { error: error.message, data: [] };
  }

  return { data: (data || []).map(normalizePost) };
}

export async function createPost({ title, body, category, user }) {
  const supabase = getSupabaseClient();
  if (!supabase) return { error: "Supabase is not configured." };
  if (!user) return { error: "Sign in required." };

  const payload = {
    title: sanitizeSingleLine(title, 200),
    body: sanitizeMultiline(body, 20000),
    category: sanitizeSingleLine(category || "all", 60) || "all",
    author_id: user.id,
    author_name: sanitizeSingleLine(user.username || "Member", 80),
  };

  const { data, error } = await supabase
    .from(POSTS_TABLE)
    .insert(payload)
    .select("id, title, body, category, author_id, author_name, created_at, updated_at")
    .single();

  if (error) return { error: error.message };
  return { data: normalizePost(data) };
}

export async function patchPost(postId, updates) {
  const supabase = getSupabaseClient();
  if (!supabase) return { error: "Supabase is not configured." };

  const payload = {
    updated_at: new Date().toISOString(),
  };

  if (updates.title !== undefined) payload.title = sanitizeSingleLine(updates.title, 200);
  if (updates.body !== undefined) payload.body = sanitizeMultiline(updates.body, 20000);
  if (updates.category !== undefined) payload.category = sanitizeSingleLine(updates.category, 60) || "all";
  if (updates.author !== undefined) payload.author_name = sanitizeSingleLine(updates.author, 80) || "Anonymous";

  const { error } = await supabase
    .from(POSTS_TABLE)
    .update(payload)
    .eq("id", postId);

  if (error) return { error: error.message };
  return { success: true };
}

export async function removePost(postId) {
  const supabase = getSupabaseClient();
  if (!supabase) return { error: "Supabase is not configured." };

  const { error } = await supabase.from(POSTS_TABLE).delete().eq("id", postId);
  if (error) return { error: error.message };
  return { success: true };
}

export async function fetchComments(postIds = []) {
  const supabase = getSupabaseClient();
  if (!supabase) return { error: "Supabase is not configured.", data: [] };
  if (!postIds.length) return { data: [] };

  const { data, error } = await supabase
    .from(COMMENTS_TABLE)
    .select("id, post_id, author_id, author_name, body, created_at")
    .in("post_id", postIds)
    .order("created_at", { ascending: false });

  if (error) return { error: error.message, data: [] };
  return { data: (data || []).map(normalizeComment) };
}

export async function createComment({ postId, body, user }) {
  const supabase = getSupabaseClient();
  if (!supabase) return { error: "Supabase is not configured." };
  if (!user) return { error: "Sign in required." };

  const payload = {
    post_id: postId,
    author_id: user.id,
    author_name: sanitizeSingleLine(user.username || "Member", 80),
    body: sanitizeMultiline(body, 2000),
  };

  const { data, error } = await supabase
    .from(COMMENTS_TABLE)
    .insert(payload)
    .select("id, post_id, author_id, author_name, body, created_at")
    .single();

  if (error) return { error: error.message };
  return { data: normalizeComment(data) };
}

export async function removeComment(commentId) {
  const supabase = getSupabaseClient();
  if (!supabase) return { error: "Supabase is not configured." };
  const { error } = await supabase.from(COMMENTS_TABLE).delete().eq("id", commentId);
  if (error) return { error: error.message };
  return { success: true };
}

export async function fetchLikes(postIds = [], currentUserId = null) {
  const supabase = getSupabaseClient();
  if (!supabase || !postIds.length) return { data: {} };

  const { data, error } = await supabase
    .from(LIKES_TABLE)
    .select("post_id, user_id")
    .in("post_id", postIds);

  if (error) return { error: error.message, data: {} };

  const map = {};
  postIds.forEach((postId) => {
    map[postId] = { count: 0, users: [] };
  });

  (data || []).forEach((row) => {
    if (!map[row.post_id]) {
      map[row.post_id] = { count: 0, users: [] };
    }
    map[row.post_id].count += 1;
    map[row.post_id].users.push(row.user_id);
  });

  if (currentUserId) {
    Object.values(map).forEach((entry) => {
      entry.isLiked = entry.users.includes(currentUserId);
    });
  }

  return { data: map };
}

export async function toggleLike(postId, userId) {
  const supabase = getSupabaseClient();
  if (!supabase) return { error: "Supabase is not configured." };

  const { data: existing, error: existingError } = await supabase
    .from(LIKES_TABLE)
    .select("id")
    .eq("post_id", postId)
    .eq("user_id", userId)
    .maybeSingle();

  if (existingError) return { error: existingError.message };

  if (existing) {
    const { error } = await supabase.from(LIKES_TABLE).delete().eq("id", existing.id);
    if (error) return { error: error.message };
    return { liked: false };
  }

  const { error } = await supabase.from(LIKES_TABLE).insert({
    post_id: postId,
    user_id: userId,
  });

  if (error) return { error: error.message };
  return { liked: true };
}

export async function listWriters() {
  const supabase = getSupabaseClient();
  if (!supabase) return { data: [] };

  const { data, error } = await supabase
    .from(PROFILES_TABLE)
    .select("username")
    .eq("role", "writer")
    .order("username", { ascending: true });

  if (error) return { error: error.message, data: [] };
  return { data: (data || []).map((entry) => entry.username) };
}

export async function setWriterRole(username, enabled) {
  const supabase = getSupabaseClient();
  if (!supabase) return { error: "Supabase is not configured." };

  const cleanUsername = sanitizeSingleLine(username, 20);
  const role = enabled ? "writer" : "user";

  const { error } = await supabase
    .from(PROFILES_TABLE)
    .update({ role })
    .eq("username", cleanUsername);

  if (error) return { error: error.message };
  return { success: true };
}
