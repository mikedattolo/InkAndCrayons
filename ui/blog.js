import {
  createComment,
  createPost,
  fetchCommentReactions,
  fetchComments,
  fetchLikes,
  fetchPosts,
  listWriters,
  patchPost,
  REACTION_EMOJIS,
  removePost,
  setWriterRole,
  toggleCommentReaction,
  toggleLike,
} from "../services/blogService.js";
import { notifyAdminOfNewComment } from "../services/adminNotifications.js";
import { LEGACY_STORAGE_KEYS } from "../services/localStorageMigration.js";
import { censorCommentText, moderateComment } from "../utils/commentModeration.js";
import { sanitizeMultiline, sanitizeSingleLine } from "../utils/validation.js";

const BLOCKED_PATTERNS = [
  /https?:\/\/\S+/gi,
  /\b(spam|buy\s*now|click\s*here)\b/gi,
];

const POST_MOODS_KEY = "lrl_post_moods";
const COMMENT_TTL_MS = 5 * 60 * 60 * 1000;
const POST_ACTION_EMOJIS = ["😀", "😢", "😂", "😠"];

const _postTimestamps = new Map();
const POST_COOLDOWN_MS = 15_000;

const ARCHIVE_PAGE_SIZE = 4;
let _archivePage = 0;
let _searchQuery = "";

function readLegacyJson(key, fallback) {
  const raw = localStorage.getItem(key);
  if (!raw) return fallback;
  try {
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function isWithinCommentTtl(dateValue) {
  if (!dateValue) return false;
  const ts = new Date(dateValue).getTime();
  if (!Number.isFinite(ts)) return false;
  return Date.now() - ts <= COMMENT_TTL_MS;
}

function loadPostMoodsMap() {
  const raw = readLegacyJson(POST_MOODS_KEY, {});
  const cleaned = {};

  Object.entries(raw || {}).forEach(([postId, postMood]) => {
    if (!postMood || typeof postMood !== "object") return;
    const nextMood = {};

    Object.entries(postMood).forEach(([emoji, entries]) => {
      if (!POST_ACTION_EMOJIS.includes(emoji) || !entries || typeof entries !== "object") return;

      const activeEntries = {};
      Object.entries(entries).forEach(([userId, timestamp]) => {
        if (isWithinCommentTtl(timestamp)) {
          activeEntries[userId] = timestamp;
        }
      });

      if (Object.keys(activeEntries).length) {
        nextMood[emoji] = activeEntries;
      }
    });

    if (Object.keys(nextMood).length) {
      cleaned[postId] = nextMood;
    }
  });

  return cleaned;
}

function persistPostMoodsMap(moodsMap) {
  localStorage.setItem(POST_MOODS_KEY, JSON.stringify(moodsMap));
}

function loadLegacyLocalPostsFallback() {
  const legacyPosts = readLegacyJson("lrl_posts", []);
  const deletedIds = new Set(readLegacyJson("lrl_deleted_posts", []));
  return (legacyPosts || [])
    .filter((post) => !deletedIds.has(post.id))
    .map((post, index) => ({
      id: post.id || `legacy_${index}`,
      title: sanitizeSingleLine(post.title || "Untitled", 200),
      body: sanitizeMultiline(String(post.body || ""), 20000),
      author: sanitizeSingleLine(post.author || "Legacy User", 80),
      category: sanitizeSingleLine(post.category || "all", 60) || "all",
      createdAt: post.createdAt || post.date || new Date().toISOString(),
      date: post.date || post.createdAt || new Date().toISOString(),
      source: "legacy-local",
    }));
}

function loadLegacyCommentMap() {
  const map = readLegacyJson("lrl_comments", {});
  const normalized = {};
  Object.entries(map || {}).forEach(([postId, comments]) => {
    normalized[postId] = (comments || []).map((comment) => ({
      id: comment.id || `${postId}_${Date.now()}`,
      postId,
      author: sanitizeSingleLine(comment.author || "Legacy User", 80),
      body: sanitizeMultiline(String(comment.body || ""), 2000),
      createdAt: comment.createdAt || new Date().toISOString(),
    })).filter((comment) => isWithinCommentTtl(comment.createdAt));
  });
  return normalized;
}

function loadLegacyLikesMap() {
  const map = readLegacyJson("lrl_likes", {});
  const normalized = {};
  Object.entries(map || {}).forEach(([postId, likes]) => {
    normalized[postId] = {
      count: Number(likes?.count || 0),
      users: Array.isArray(likes?.users) ? likes.users : [],
    };
  });
  return normalized;
}

function sanitize(text) {
  let safe = text;
  BLOCKED_PATTERNS.forEach((pattern) => {
    safe = safe.replace(pattern, "[removed]");
  });
  return safe;
}

function canPostNow(userId) {
  const last = _postTimestamps.get(userId);
  if (last && Date.now() - last < POST_COOLDOWN_MS) return false;
  _postTimestamps.set(userId, Date.now());
  return true;
}

function timeAgo(dateStr) {
  if (!dateStr) return "";
  const diff = Date.now() - new Date(dateStr).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d`;
  const w = Math.floor(d / 7);
  if (w < 52) return `${w}w`;
  return new Date(dateStr).toLocaleDateString();
}

function formatDate(dateStr) {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function roleCanPublish(userObj) {
  return userObj?.role === "admin" || userObj?.role === "writer";
}

/** UUID v4 pattern — matches all Supabase-generated post IDs. */
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// Real DB rows use bigint IDs (positive integer strings or numbers)
const BIGINT_ID_REGEX = /^\d+$/;

/**
 * Returns true for real Supabase post IDs.
 * Accepts bigint (numeric) IDs from DB.  Rejects synthetic IDs such
 * as `seed_*`, `legacy_*`, and `local_*`.
 */
function isSupabasePostId(value) {
  if (value === null || value === undefined) return false;
  const str = String(value).trim();
  // UUID format (legacy — kept for rollback safety)
  if (UUID_REGEX.test(str)) return true;
  // Bigint numeric ID from Postgres identity column
  if (BIGINT_ID_REGEX.test(str)) return true;
  return false;
}

function roleCanManagePost(userObj, post) {
  if (!userObj || !post) return false;
  if (userObj.role === "admin") return true;
  if (userObj.role === "writer" && post.authorId && post.authorId === userObj.id) return true;
  return false;
}

function stripMarkupToText(text) {
  return String(text || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function appendInlineFormatted(container, text) {
  const source = String(text || "");
  const tokenRegex = /(https?:\/\/[^\s]+|\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g;
  let cursor = 0;

  for (const match of source.matchAll(tokenRegex)) {
    const token = match[0];
    const index = match.index || 0;

    if (index > cursor) {
      container.appendChild(document.createTextNode(source.slice(cursor, index)));
    }

    if (token.startsWith("http://") || token.startsWith("https://")) {
      const link = document.createElement("a");
      link.href = token;
      link.target = "_blank";
      link.rel = "noreferrer";
      link.textContent = token;
      container.appendChild(link);
    } else if (token.startsWith("**") && token.endsWith("**")) {
      const strong = document.createElement("strong");
      strong.textContent = token.slice(2, -2);
      container.appendChild(strong);
    } else if (token.startsWith("*") && token.endsWith("*")) {
      const em = document.createElement("em");
      em.textContent = token.slice(1, -1);
      container.appendChild(em);
    } else if (token.startsWith("`") && token.endsWith("`")) {
      const code = document.createElement("code");
      code.textContent = token.slice(1, -1);
      container.appendChild(code);
    } else {
      container.appendChild(document.createTextNode(token));
    }

    cursor = index + token.length;
  }

  if (cursor < source.length) {
    container.appendChild(document.createTextNode(source.slice(cursor)));
  }
}

function renderRichText(container, rawText) {
  container.textContent = "";
  const source = sanitizeMultiline(rawText || "", 20000);
  const paragraphs = source.split(/\n{2,}/).filter(Boolean);

  if (!paragraphs.length) {
    const p = document.createElement("p");
    p.textContent = "";
    container.appendChild(p);
    return;
  }

  paragraphs.forEach((paragraph) => {
    const p = document.createElement("p");
    const lines = paragraph.split("\n");

    lines.forEach((line, index) => {
      appendInlineFormatted(p, line);
      if (index < lines.length - 1) {
        p.appendChild(document.createElement("br"));
      }
    });

    container.appendChild(p);
  });
}

async function loadSeedPostsFallback() {
  try {
    const response = await fetch("./data/posts.json");
    if (!response.ok) return [];
    const data = await response.json();
    return (data.posts || []).map((post, index) => ({
      id: `seed_${index}`,
      title: post.title,
      body: stripMarkupToText(post.body),
      author: post.author || "Ink & Crayons Team",
      category: post.category || "all",
      createdAt: post.date || new Date().toISOString(),
      date: post.date || new Date().toISOString(),
      source: "seed",
    }));
  } catch {
    return [];
  }
}

/**
 * Load posts from all available sources and merge them:
 *   1. Supabase (live DB) — editable
 *   2. Legacy localStorage (migration mode — read-only)
 *   3. Seed JSON (data/posts.json — read-only, always included as baseline content)
 *
 * Each source stamps `post.source` so the UI can restrict edit/delete.
 */
export async function loadPosts({ adminMode = false } = {}) {
  const allPosts = [];
  const seenIds = new Set();

  // 1. Try Supabase
  const result = await fetchPosts({ adminMode });
  if (!result.error && result.data?.length) {
    result.data.forEach((p) => { seenIds.add(p.id); allPosts.push(p); });
  }

  // 2. Merge any legacy-local posts not already in Supabase
  const legacyLocal = loadLegacyLocalPostsFallback();
  legacyLocal.forEach((p) => {
    if (!seenIds.has(p.id)) { seenIds.add(p.id); allPosts.push(p); }
  });

  // 3. Always include seed posts so baseline content is never empty
  const seedPosts = await loadSeedPostsFallback();
  seedPosts.forEach((p) => {
    if (!seenIds.has(p.id)) { seenIds.add(p.id); allPosts.push(p); }
  });

  return allPosts;
}

export async function updatePost(postId, updates) {
  if (!postId || String(postId).startsWith("seed_")) return false;
  const result = await patchPost(postId, updates);
  return !result.error;
}

export async function addWriter(username) {
  return setWriterRole(username, true);
}

export async function removeWriter(username) {
  return setWriterRole(username, false);
}

export async function getWriters() {
  const result = await listWriters();
  return result.data || [];
}

export function createBlogUI({
  postsContainer,
  formEl,
  titleInput,
  bodyInput,
  statusEl,
  currentUser,
  onEditPost,
}) {
  let posts = [];
  let user = currentUser;
  let currentCategory = "all";
  let commentsMap = {};
  let likesMap = {};
  let reactionsMap = {};
  let postMoodsMap = loadPostMoodsMap();
  let pending = false;
  const MIGRATION_KEYS = LEGACY_STORAGE_KEYS;

  function setUser(nextUser) {
    user = nextUser;
  }

  async function hydratePostState() {
    postMoodsMap = loadPostMoodsMap();
    persistPostMoodsMap(postMoodsMap);

    // Legacy-local posts carry their own comments/likes in localStorage
    const hasLegacyPostsLoaded = posts.some((post) => post.source === "legacy-local");
    if (hasLegacyPostsLoaded) {
      commentsMap = loadLegacyCommentMap();
      likesMap = loadLegacyLikesMap();
      reactionsMap = {};
      return;
    }

    // Only query Supabase for genuine UUID post IDs; skip seed/legacy synthetic IDs
    const supabasePostIds = posts
      .map((post) => post.id)
      .filter((id) => isSupabasePostId(id));

    if (!supabasePostIds.length) {
      commentsMap = {};
      likesMap = {};
      reactionsMap = {};
      return;
    }

    const [commentsResult, likesResult] = await Promise.all([
      fetchComments(supabasePostIds, { adminMode: user?.role === "admin" }),
      fetchLikes(supabasePostIds, user?.id || null),
    ]);

    commentsMap = {};
    const allCommentIds = [];
    (commentsResult.data || []).forEach((comment) => {
      // Only display visible comments to regular users; admins see flagged too
      if (comment.status === "hidden") return;
      if (comment.status === "flagged" && user?.role !== "admin") return;
      if (!commentsMap[comment.postId]) commentsMap[comment.postId] = [];
      if (!isWithinCommentTtl(comment.createdAt)) return;
      commentsMap[comment.postId].push(comment);
      allCommentIds.push(comment.id);
    });

    likesMap = likesResult.data || {};

    // Fetch emoji reactions for all visible comments
    const reactionsResult = await fetchCommentReactions(allCommentIds, user?.id || null);
    reactionsMap = reactionsResult.data || {};
  }

  function filteredPosts() {
    let categoryPosts = posts;
    if (currentCategory !== "all") {
      categoryPosts = posts.filter((post) => post.category === currentCategory);
    }

    let list = categoryPosts.filter((post) => post.title !== "Welcome to Ink & Crayons Articles");

    if (_searchQuery) {
      const q = _searchQuery.toLowerCase();
      list = list.filter((p) => {
        const plain = stripMarkupToText(p.body).toLowerCase();
        return (
          String(p.title || "").toLowerCase().includes(q) ||
          plain.includes(q) ||
          String(p.author || "").toLowerCase().includes(q)
        );
      });
    }

    return list;
  }

  async function render() {
    if (pending) return;
    pending = true;
    statusEl.textContent = "Loading...";

    await hydratePostState();

    postsContainer.textContent = "";
    const composerCard = formEl.closest(".blog__composer-card");
    if (composerCard) {
      composerCard.style.display = roleCanPublish(user) ? "flex" : "none";
    }

    const filtered = filteredPosts();
    const mainPost = filtered.length ? [filtered[0]] : [];

    if (_searchQuery && filtered.length === 0) {
      const noResults = document.createElement("div");
      noResults.className = "blog__no-results";

      const p = document.createElement("p");
      p.style.textAlign = "center";
      p.style.padding = "40px 20px";
      p.style.fontFamily = "var(--font-hand)";
      p.style.fontSize = "1.3rem";
      p.style.color = "#888";
      p.textContent = `No articles match \"${_searchQuery}\"`;

      noResults.appendChild(p);
      postsContainer.appendChild(noResults);
    }

    mainPost.forEach((post) => {
      const card = document.createElement("article");
      card.className = "post";

      const sheet = document.createElement("div");
      sheet.className = "post__sheet";

      const page = document.createElement("div");
      page.className = "post__page";

      const masthead = document.createElement("div");
      masthead.className = "post__masthead";
      masthead.textContent = "Ink & Crayons Journal";

      const titleEl = document.createElement("h3");
      titleEl.className = "post__title";
      titleEl.textContent = post.title || "Untitled";

      const meta = document.createElement("div");
      meta.className = "post__meta";
      const authorEl = document.createElement("span");
      authorEl.className = "post__author";
      authorEl.textContent = post.author || "Anonymous";
      const timeEl = document.createElement("span");
      timeEl.className = "post__time";
      timeEl.textContent = timeAgo(post.createdAt || post.date);
      meta.append(authorEl);
      if (timeEl.textContent) meta.append(timeEl);

      const textEl = document.createElement("div");
      textEl.className = "post__text";
      renderRichText(textEl, post.body);

      page.append(masthead, titleEl, meta, textEl);
      sheet.appendChild(page);

      const actionPanel = document.createElement("div");
      actionPanel.className = "post__action-panel";

      const actionBar = document.createElement("div");
      actionBar.className = "post__action-bar";

      const postLikes = likesMap[post.id] || { count: 0, users: [] };
      const isLiked = Boolean(
        user && (postLikes.users.includes(user.id) || postLikes.users.includes(user.username))
      );

      const likeBtn = document.createElement("button");
      likeBtn.type = "button";
      likeBtn.className = "post__action-btn" + (isLiked ? " liked" : "");
      likeBtn.appendChild(document.createTextNode(isLiked ? "❤ " : "♡ "));
      const likeCount = document.createElement("span");
      likeCount.className = "action-count";
      likeCount.textContent = postLikes.count ? String(postLikes.count) : "";
      likeBtn.appendChild(likeCount);
      likeBtn.addEventListener("click", async () => {
        if (!user || post.source === "seed" || post.source === "legacy-local") return;
        await toggleLike(post.id, user.id);
        await render();
      });

      const postComments = commentsMap[post.id] || [];
      const commentToggle = document.createElement("button");
      commentToggle.className = "post__action-btn";
      commentToggle.type = "button";
      commentToggle.setAttribute("aria-expanded", "false");
      commentToggle.appendChild(document.createTextNode("💬 "));
      const commentCount = document.createElement("span");
      commentCount.className = "action-count";
      commentCount.textContent = postComments.length ? String(postComments.length) : "";
      commentToggle.appendChild(commentCount);

      actionBar.append(likeBtn, commentToggle);

      const postMoodState = postMoodsMap[post.id] || {};
      const postMoodWrap = document.createElement("div");
      postMoodWrap.className = "post__mood-row";

      POST_ACTION_EMOJIS.forEach((emoji) => {
        const moodEntries = postMoodState[emoji] || {};
        const moodUsers = Object.keys(moodEntries);
        const reacted = Boolean(user?.id && moodEntries[user.id]);

        const moodBtn = document.createElement("button");
        moodBtn.type = "button";
        moodBtn.className = "post__mood-btn" + (reacted ? " reacted" : "");
        moodBtn.title = user ? `React with ${emoji}` : "Sign in to react";
        moodBtn.disabled = !user;

        const emojiIcon = document.createElement("span");
        emojiIcon.className = "post__mood-emoji";
        emojiIcon.textContent = emoji;
        moodBtn.appendChild(emojiIcon);

        if (moodUsers.length) {
          const count = document.createElement("span");
          count.className = "post__mood-count";
          count.textContent = String(moodUsers.length);
          moodBtn.appendChild(count);
        }

        moodBtn.addEventListener("click", () => {
          if (!user?.id) return;
          postMoodsMap = loadPostMoodsMap();
          const currentPostMoods = postMoodsMap[post.id] || {};
          const currentEmojiUsers = { ...(currentPostMoods[emoji] || {}) };

          if (currentEmojiUsers[user.id]) {
            delete currentEmojiUsers[user.id];
          } else {
            currentEmojiUsers[user.id] = new Date().toISOString();
          }

          if (Object.keys(currentEmojiUsers).length) {
            currentPostMoods[emoji] = currentEmojiUsers;
          } else {
            delete currentPostMoods[emoji];
          }

          if (Object.keys(currentPostMoods).length) {
            postMoodsMap[post.id] = currentPostMoods;
          } else {
            delete postMoodsMap[post.id];
          }

          persistPostMoodsMap(postMoodsMap);
          render();
        });

        postMoodWrap.appendChild(moodBtn);
      });

      actionBar.appendChild(postMoodWrap);

      if (roleCanManagePost(user, post) && post.source !== "seed" && post.source !== "legacy-local") {
        const adminGroup = document.createElement("div");
        adminGroup.className = "post__admin-actions";

        const editBtn = document.createElement("button");
        editBtn.type = "button";
        editBtn.className = "post__admin-btn post__admin-btn--edit";
        editBtn.title = "Edit article";
        editBtn.textContent = "✎ Edit";
        editBtn.addEventListener("click", () => {
          if (typeof onEditPost === "function") onEditPost(post);
        });

        const deleteBtn = document.createElement("button");
        deleteBtn.type = "button";
        deleteBtn.className = "post__admin-btn post__admin-btn--delete";
        deleteBtn.title = "Delete article";
        deleteBtn.textContent = "🗑 Delete";
        deleteBtn.addEventListener("click", async () => {
          if (!confirm(`Delete \"${post.title}\"? This cannot be undone.`)) return;
          const result = await removePost(post.id);
          if (result.error) {
            statusEl.textContent = result.error;
            return;
          }
          posts = await loadPosts({ adminMode: user?.role === "admin" });
          await render();
        });

        adminGroup.append(editBtn, deleteBtn);
        actionBar.appendChild(adminGroup);
      }

      let likeLine = null;
      if (postLikes.count > 0) {
        likeLine = document.createElement("div");
        likeLine.style.padding = "0 16px 4px";
        likeLine.style.fontSize = "0.82rem";
        likeLine.style.fontWeight = "700";
        likeLine.style.color = "#333";
        likeLine.textContent = `${postLikes.count} like${postLikes.count !== 1 ? "s" : ""}`;
      }

      let viewAllBtn = null;
      if (postComments.length > 0) {
        viewAllBtn = document.createElement("button");
        viewAllBtn.type = "button";
        viewAllBtn.style.background = "none";
        viewAllBtn.style.border = "none";
        viewAllBtn.style.padding = "0 16px 6px";
        viewAllBtn.style.fontSize = "0.82rem";
        viewAllBtn.style.color = "#999";
        viewAllBtn.style.cursor = "pointer";
        viewAllBtn.textContent = `View all ${postComments.length} comment${postComments.length !== 1 ? "s" : ""}`;
      }

      const commentSection = document.createElement("div");
      commentSection.className = "post__comment-section";
      commentSection.style.display = "none";

      const commentsWrap = document.createElement("div");
      commentsWrap.className = "post__comments";

      postComments.forEach((comment) => {
        const commentEl = document.createElement("div");
        commentEl.className = "post__comment";
        if (comment.status === "flagged") {
          commentEl.classList.add("post__comment--flagged");
        }

        /* Header: username + timestamp */
        const commentHeader = document.createElement("div");
        commentHeader.className = "post__comment-header";

        const authorSpan = document.createElement("span");
        authorSpan.className = "post__comment-author";
        authorSpan.textContent = comment.author || "User";

        const timeSpan = document.createElement("span");
        timeSpan.className = "post__comment-time";
        timeSpan.textContent = timeAgo(comment.createdAt);

        commentHeader.append(authorSpan, timeSpan);

        /* Body text */
        const bodySpan = document.createElement("div");
        bodySpan.className = "post__comment-body";
        appendInlineFormatted(bodySpan, censorCommentText(comment.body));

        /* Flagged badge for admins */
        if (comment.status === "flagged" && user?.role === "admin") {
          const badge = document.createElement("span");
          badge.className = "post__comment-flag-badge";
          badge.textContent = "⚑ flagged";
          commentHeader.appendChild(badge);
        }

        /* Emoji reaction row */
        const reactionRow = document.createElement("div");
        reactionRow.className = "post__comment-reactions";

        const commentReactions = reactionsMap[comment.id] || {};

        REACTION_EMOJIS.forEach((emoji) => {
          const reactionData = commentReactions[emoji] || { count: 0, users: [] };
          const myReacted = user && reactionData.users.includes(user.id);

          const btn = document.createElement("button");
          btn.type = "button";
          btn.className = "post__reaction-btn" + (myReacted ? " reacted" : "");
          btn.title = user ? `React with ${emoji}` : "Sign in to react";
          btn.disabled = post.source !== "supabase";

          const emojiSpan = document.createElement("span");
          emojiSpan.textContent = emoji;

          btn.appendChild(emojiSpan);
          if (reactionData.count > 0) {
            const countSpan = document.createElement("span");
            countSpan.className = "post__reaction-count";
            countSpan.textContent = reactionData.count;
            btn.appendChild(countSpan);
          }

          btn.addEventListener("click", async () => {
            if (!user || post.source !== "supabase") return;
            await toggleCommentReaction(comment.id, user.id, emoji);
            await render();
          });

          reactionRow.appendChild(btn);
        });

        commentEl.append(commentHeader, bodySpan, reactionRow);
        commentsWrap.appendChild(commentEl);
      });

      function toggleComments() {
        const nextOpen = commentSection.style.display === "none";
        commentSection.style.display = nextOpen ? "block" : "none";
        commentToggle.setAttribute("aria-expanded", String(nextOpen));
        if (nextOpen) {
          setTimeout(() => commentInput.focus(), 0);
        }
      }
      commentToggle.addEventListener("click", toggleComments);
      if (viewAllBtn) viewAllBtn.addEventListener("click", toggleComments);

      const commentForm = document.createElement("form");
      commentForm.className = "post__comment-form";

      const commentInput = document.createElement("input");
      commentInput.type = "text";
      commentInput.className = "post__comment-input";
      commentInput.placeholder = user ? "Add a comment…" : "Sign in to comment";
      commentInput.disabled = !user || post.source === "seed" || post.source === "legacy-local";

      const commentSubmit = document.createElement("button");
      commentSubmit.type = "submit";
      commentSubmit.className = "post__comment-submit";
      commentSubmit.textContent = "Post";
      commentSubmit.disabled = !user || post.source === "seed" || post.source === "legacy-local";

      commentForm.addEventListener("submit", async (event) => {
        event.preventDefault();
        if (!user || post.source === "seed" || post.source === "legacy-local") return;

        const bodyText = sanitizeSingleLine(commentInput.value, 600);
        if (!bodyText) return;

        if (!canPostNow(user.id || user.username)) {
          commentInput.placeholder = "Please wait before posting again…";
          return;
        }

        /* Frontend moderation check */
        const modResult = moderateComment(bodyText);
        if (!modResult.allowed) {
          commentSubmit.disabled = false;
          const errEl = commentForm.querySelector(".comment-mod-error") || document.createElement("small");
          errEl.className = "comment-mod-error";
          errEl.style.color = "#d04";  errEl.style.display = "block";
          errEl.style.fontSize = "0.8rem"; errEl.style.marginTop = "4px";
          errEl.textContent = modResult.reason;
          if (!commentForm.contains(errEl)) commentForm.appendChild(errEl);
          return;
        }

        /* Clear any previous mod error */
        const prevErr = commentForm.querySelector(".comment-mod-error");
        if (prevErr) prevErr.remove();

        const safeBody = censorCommentText(sanitize(sanitizeMultiline(bodyText, 600)));
        commentSubmit.disabled = true;
        const result = await createComment({
          postId: post.id,
          body: safeBody,
          user,
          flagged: false,
        });
        commentSubmit.disabled = false;

        if (result.error) {
          statusEl.textContent = result.error;
          return;
        }

        // Fire-and-forget admin alert hook (webhook/email bridge)
        notifyAdminOfNewComment({
          postId: post.id,
          postTitle: post.title,
          commentAuthor: result.data?.author || user.username || "Member",
          commentBody: safeBody,
          commentCreatedAt: result.data?.createdAt || new Date().toISOString(),
        }).catch(() => {});

        commentInput.value = "";
        await render();
      });

      commentForm.append(commentInput, commentSubmit);

      commentSection.append(commentsWrap, commentForm);
      actionPanel.appendChild(actionBar);

      card.appendChild(sheet);
      postsContainer.appendChild(card);

      /* Interaction section — separate from the article card */
      const interactionWrap = document.createElement("div");
      interactionWrap.className = "post__interaction-section";
      interactionWrap.appendChild(actionPanel);
      if (likeLine) interactionWrap.appendChild(likeLine);
      if (viewAllBtn) interactionWrap.appendChild(viewAllBtn);
      interactionWrap.appendChild(commentSection);

      postsContainer.appendChild(interactionWrap);
    });

    renderArchive(filtered);
    statusEl.textContent = "";
    pending = false;
  }

  function renderArchive(allFiltered) {
    const archiveGrid = document.getElementById("archiveGrid");
    if (!archiveGrid) return;

    // Show all posts (except the currently viewed one at index 0) in a stacked grid
    const archivePosts = allFiltered.length > 1 ? allFiltered.slice(1) : [];
    const currentPost = allFiltered.length > 0 ? allFiltered[0] : null;

    archiveGrid.textContent = "";

    if (archivePosts.length === 0) {
      const empty = document.createElement("p");
      empty.className = "blog__archive-empty";
      empty.textContent = _searchQuery ? "No articles match your search." : "No more articles yet — check back soon!";
      archiveGrid.appendChild(empty);
      return;
    }

    // Sort by date, newest first
    const sorted = [...archivePosts].sort((a, b) => {
      const da = new Date(a.date || a.createdAt || 0);
      const db = new Date(b.date || b.createdAt || 0);
      return db - da;
    });

    sorted.forEach((post) => {
      const btn = document.createElement("button");
      btn.className = "blog__archive-btn";
      btn.type = "button";

      // Highlight if this is the currently viewed post
      if (currentPost && (post.id === currentPost.id || post.title === currentPost.title)) {
        btn.classList.add("blog__archive-btn--active");
      }

      const btnTitle = document.createElement("span");
      btnTitle.className = "blog__archive-btn-title";
      btnTitle.textContent = post.title;

      const btnDate = document.createElement("span");
      btnDate.className = "blog__archive-btn-date";
      btnDate.textContent = formatDate(post.date || post.createdAt);

      btn.appendChild(btnTitle);
      if (btnDate.textContent) btn.appendChild(btnDate);

      btn.addEventListener("click", async () => {
        const reordered = [post, ...posts.filter((p) => p !== post)];
        posts.splice(0, posts.length, ...reordered);
        await render();
        const mainArticle = document.querySelector(".blog__main-article");
        if (mainArticle) mainArticle.scrollTop = 0;
        window.scrollTo({ top: 0, behavior: "smooth" });
      });

      archiveGrid.appendChild(btn);
    });
  }

  function initArchiveControls() {
    const searchInput = document.getElementById("blogSearch");

    searchInput?.addEventListener("input", async () => {
      _searchQuery = sanitizeSingleLine(searchInput.value, 80);
      _archivePage = 0;
      await render();
    });

    searchInput?.addEventListener("keydown", async (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        _searchQuery = sanitizeSingleLine(searchInput.value, 80);
        _archivePage = 0;
        await render();
      }
    });
  }

  formEl.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!roleCanPublish(user)) {
      statusEl.textContent = "Only admins and writers can publish articles.";
      return;
    }

    const title = sanitizeSingleLine(titleInput.value, 200);
    const body = sanitizeMultiline(bodyInput.value, 20000);

    if (!title || !body) {
      statusEl.textContent = "Please add a title and article body.";
      return;
    }

    statusEl.textContent = "Publishing...";
    const result = await createPost({
      title: sanitize(title),
      body: sanitize(body),
      category: "all",
      user,
    });

    if (result.error) {
      statusEl.textContent = result.error;
      return;
    }

    titleInput.value = "";
    bodyInput.value = "";
    statusEl.textContent = "Article published!";

    posts = await loadPosts({ adminMode: user?.role === "admin" });
    await render();

    setTimeout(() => {
      statusEl.textContent = "";
    }, 2000);
  });

  return {
    async init() {
      posts = await loadPosts({ adminMode: user?.role === "admin" });
      await render();
      initArchiveControls();
      currentCategory = "all";
    },
    setUser,
    render,
    async reloadPosts() {
      posts = await loadPosts({ adminMode: user?.role === "admin" });
      await render();
    },
    getLatestPost() {
      const filtered = posts.filter((p) => p.title !== "Welcome to Ink & Crayons Articles");
      return filtered.length > 0 ? filtered[0] : null;
    },
    getMigrationStatus() {
      return {
        migrationKeys: MIGRATION_KEYS,
        usingLegacyFallback: posts.some((post) => post.source === "legacy-local"),
      };
    },
  };
}
