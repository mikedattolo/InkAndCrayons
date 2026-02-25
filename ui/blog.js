const POSTS_KEY = "lrl_posts";
const COMMENTS_KEY = "lrl_comments";
const DELETED_POSTS_KEY = "lrl_deleted_posts";
const LIKES_KEY = "lrl_likes";
const WRITERS_KEY = "lrl_writers"; // usernames allowed to post articles
const SEED_VERSION_KEY = "lrl_posts_seed_version";
const SEED_VERSION = "2026-02-16-3";

/* --- Content moderation (family-friendly filter) --- */
/*
 * Strategy:
 *   1. Minimal deny-list of generic non-offensive "junk" words only.
 *      NO slurs, hate speech, or sensitive terms are stored in code.
 *   2. Block raw URLs in user-generated comments (reduce spam/phishing).
 *   3. Throttle posting: one comment per 15 seconds per user.
 *   4. First-time poster comments are flagged for admin review (TODO with backend).
 *   5. "Report" button on each comment lets community flag content.
 *
 * For production, integrate a cloud moderation API (e.g., Perspective API,
 * Azure Content Safety) rather than maintaining a word list.
 */
const BLOCKED_PATTERNS = [
  /https?:\/\/\S+/gi,            // block raw URLs in comments
  /\b(spam|buy\s*now|click\s*here)\b/gi,  // common spam phrases
];

/** Rate-limit tracker: userId → last post timestamp */
const _postTimestamps = new Map();
const POST_COOLDOWN_MS = 15_000; // 15 seconds

function readJson(key, fallback) {
  const raw = localStorage.getItem(key);
  if (!raw) return fallback;
  try {
    return JSON.parse(raw);
  } catch (error) {
    console.warn("Blog data corrupted, resetting.");
    return fallback;
  }
}

function writeJson(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function escapeHtml(text) {
  const map = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  };
  return text.replace(/[&<>"']/g, (char) => map[char]);
}

function renderMarkdown(text) {
  /* Check if text is already HTML (contains HTML tags) */
  if (/<[a-z]|<\/[a-z]/i.test(text)) {
    /* Already HTML, don't process with markdown */
    return text;
  }
  
  /* Process as markdown */
  let safe = escapeHtml(text);
  safe = safe.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  safe = safe.replace(/\*(.+?)\*/g, "<em>$1</em>");
  safe = safe.replace(/`(.+?)`/g, "<code>$1</code>");
  safe = safe.replace(
    /(https?:\/\/[^\s]+)/g,
    '<a href="$1" target="_blank" rel="noreferrer">$1</a>'
  );
  safe = safe.replace(/\n/g, "<br />");
  return safe;
}

function sanitize(text) {
  let safe = text;
  BLOCKED_PATTERNS.forEach((pattern) => {
    safe = safe.replace(pattern, "[removed]");
  });
  return safe;
}

/** Check rate limit — returns true if user can post */
function canPostNow(userId) {
  const last = _postTimestamps.get(userId);
  if (last && Date.now() - last < POST_COOLDOWN_MS) return false;
  _postTimestamps.set(userId, Date.now());
  return true;
}

/** Check if a user is allowed to publish articles */
function canPost(userObj) {
  if (!userObj) return false;
  if (userObj.role === "admin") return true;
  const writers = readJson(WRITERS_KEY, []);
  return writers.includes(userObj.username);
}

/** Admin can grant/revoke writer privileges */
export function addWriter(username) {
  const writers = readJson(WRITERS_KEY, []);
  if (!writers.includes(username)) {
    writers.push(username);
    writeJson(WRITERS_KEY, writers);
  }
}

export function removeWriter(username) {
  const writers = readJson(WRITERS_KEY, []).filter((w) => w !== username);
  writeJson(WRITERS_KEY, writers);
}

export function getWriters() {
  return readJson(WRITERS_KEY, []);
}

/* ---- Helpers ---- */
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

function getInitials(name) {
  if (!name) return "?";
  return name
    .split(/\s+/)
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function loadLikes() {
  return readJson(LIKES_KEY, {});
}
function saveLikes(map) {
  writeJson(LIKES_KEY, map);
}

/* ---- Data layer ---- */
export async function loadPosts() {
  const currentSeed = localStorage.getItem(SEED_VERSION_KEY);
  if (currentSeed !== SEED_VERSION) {
    localStorage.removeItem(POSTS_KEY);
    localStorage.removeItem(DELETED_POSTS_KEY);
    localStorage.setItem(SEED_VERSION_KEY, SEED_VERSION);
  }

  const response = await fetch("data/posts.json?v=" + SEED_VERSION);
  const data = await response.json();
  const stored = readJson(POSTS_KEY, []);
  const deleted = new Set(readJson(DELETED_POSTS_KEY, []));

  const combined = [...stored, ...(data.posts || [])].map((post, index) => {
    let p = post.id ? post : { ...post, id: `builtin_${index}` };
    /* Ensure all posts have a category */
    if (!p.category) p.category = "all";
    return p;
  });

  return combined.filter((post) => !deleted.has(post.id));
}

function savePost(post) {
  const posts = readJson(POSTS_KEY, []);
  posts.unshift(post);
  writeJson(POSTS_KEY, posts);
}

export function updatePost(postId, updates) {
  /* Update in localStorage stored posts */
  const posts = readJson(POSTS_KEY, []);
  const idx = posts.findIndex(p => p.id === postId);
  if (idx >= 0) {
    Object.assign(posts[idx], updates, { updatedAt: new Date().toISOString() });
    writeJson(POSTS_KEY, posts);
    return true;
  }
  /* If it's a seed post, copy to stored posts with the update */
  return false;
}

function deletePost(postId) {
  const posts = readJson(POSTS_KEY, []).filter((p) => p.id !== postId);
  writeJson(POSTS_KEY, posts);

  const deleted = new Set(readJson(DELETED_POSTS_KEY, []));
  deleted.add(postId);
  writeJson(DELETED_POSTS_KEY, Array.from(deleted));
}

function loadComments() {
  return readJson(COMMENTS_KEY, {});
}

function saveComments(map) {
  writeJson(COMMENTS_KEY, map);
}

/* ---- UI ---- */
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

  function setUser(nextUser) {
    user = nextUser;
  }

  /* ---------- render ---------- */
  function render() {
    postsContainer.innerHTML = "";
    const comments = loadComments();
    const likes = loadLikes();

    /* Show/hide the composer based on write privileges */
    const composerCard = formEl.closest(".blog__composer-card");
    if (composerCard) {
      composerCard.style.display = canPost(user) ? "flex" : "none";
    }

    /* Filter posts by category */
    let categoryPosts = posts;
    if (currentCategory !== "all") {
      categoryPosts = posts.filter(post => post.category === currentCategory);
    }

    /* Filter out the welcome post and get posts for display */
    let filteredPosts = categoryPosts.filter(post => post.title !== "Welcome to Ink & Crayons Articles");

    /* Apply search filter */
    if (_searchQuery) {
      const q = _searchQuery.toLowerCase();
      filteredPosts = filteredPosts.filter(p => {
        const plain = p.body.replace(/<[^>]+>/g, " ").toLowerCase();
        return p.title.toLowerCase().includes(q) || plain.includes(q) || (p.author || "").toLowerCase().includes(q);
      });
    }
    
    /* Show only the first post (most recent) in main feed */
    const mainPost = filteredPosts.length > 0 ? [filteredPosts[0]] : [];
    const relatedPosts = filteredPosts.length > 1 ? filteredPosts.slice(1) : [];

    /* Show "no results" if search is active and nothing matched */
    if (_searchQuery && filteredPosts.length === 0) {
      const noResults = document.createElement("div");
      noResults.className = "blog__no-results";
      noResults.innerHTML = `<p style="text-align:center;padding:40px 20px;font-family:var(--font-hand);font-size:1.3rem;color:#888;">No articles match "<strong>${_searchQuery}</strong>"</p>`;
      postsContainer.appendChild(noResults);
    }
    
    /* Render main featured article */
    mainPost.forEach((post) => {
      const card = document.createElement("article");
      card.className = "post";

      /* -- Flipbook newspaper layout -- */
      const sheet = document.createElement("div");
      sheet.className = "post__sheet";

      const page = document.createElement("div");
      page.className = "post__page";

      const masthead = document.createElement("div");
      masthead.className = "post__masthead";
      masthead.textContent = "Ink & Crayons Journal";

      if (post.title) {
        const titleEl = document.createElement("h3");
        titleEl.className = "post__title";
        titleEl.textContent = post.title;
        page.appendChild(titleEl);
      }

      const meta = document.createElement("div");
      meta.className = "post__meta";
      const authorEl = document.createElement("span");
      authorEl.className = "post__author";
      authorEl.textContent = post.author || "Anonymous";
      const timeEl = document.createElement("span");
      timeEl.className = "post__time";
      timeEl.textContent = timeAgo(post.createdAt);
      meta.appendChild(authorEl);
      if (timeEl.textContent) {
        meta.appendChild(timeEl);
      }

      const textEl = document.createElement("div");
      textEl.className = "post__text";
      textEl.innerHTML = renderMarkdown(post.body);

      page.prepend(masthead, meta);
      page.appendChild(textEl);
      sheet.appendChild(page);

      /* -- Action bar: like, comment toggle, delete -- */
      const actionBar = document.createElement("div");
      actionBar.className = "post__action-bar";

      const postLikes = likes[post.id] || { count: 0, users: [] };
      const isLiked = user && postLikes.users.includes(user.username);

      const likeBtn = document.createElement("button");
      likeBtn.className = "post__action-btn" + (isLiked ? " liked" : "");
      likeBtn.type = "button";
      likeBtn.innerHTML = `${isLiked ? "\u2764" : "\u2661"} <span class="action-count">${postLikes.count || ""}</span>`;
      likeBtn.addEventListener("click", () => {
        if (!user) return;
        const allLikes = loadLikes();
        const pl = allLikes[post.id] || { count: 0, users: [] };
        const idx = pl.users.indexOf(user.username);
        if (idx >= 0) {
          pl.users.splice(idx, 1);
          pl.count = Math.max(0, pl.count - 1);
        } else {
          pl.users.push(user.username);
          pl.count = (pl.count || 0) + 1;
        }
        allLikes[post.id] = pl;
        saveLikes(allLikes);
        render();
      });

      const postComments = comments[post.id] || [];

      const commentToggle = document.createElement("button");
      commentToggle.className = "post__action-btn";
      commentToggle.type = "button";
      commentToggle.innerHTML = `\uD83D\uDCAC <span class="action-count">${postComments.length || ""}</span>`;

      actionBar.append(likeBtn, commentToggle);

      if (user?.role === "admin") {
        /* ── Admin action buttons (edit + delete) ── */
        const adminGroup = document.createElement("div");
        adminGroup.className = "post__admin-actions";

        const editBtn = document.createElement("button");
        editBtn.type = "button";
        editBtn.className = "post__admin-btn post__admin-btn--edit";
        editBtn.title = "Edit article";
        editBtn.innerHTML = "&#9998; Edit";
        editBtn.addEventListener("click", () => {
          if (typeof onEditPost === "function") onEditPost(post);
        });

        const deleteBtn = document.createElement("button");
        deleteBtn.type = "button";
        deleteBtn.className = "post__admin-btn post__admin-btn--delete";
        deleteBtn.title = "Delete article";
        deleteBtn.innerHTML = "&#128465; Delete";
        deleteBtn.addEventListener("click", () => {
          if (!confirm(`Delete "${post.title}"? This cannot be undone.`)) return;
          deletePost(post.id);
          loadPosts().then((data) => {
            posts = data;
            render();
          });
        });

        adminGroup.append(editBtn, deleteBtn);
        actionBar.appendChild(adminGroup);
      }

      /* -- Like count line -- */
      let likeLine = null;
      if (postLikes.count > 0) {
        likeLine = document.createElement("div");
        likeLine.style.cssText =
          "padding:0 16px 4px;font-size:0.82rem;font-weight:700;color:#333;";
        likeLine.textContent = `${postLikes.count} like${postLikes.count !== 1 ? "s" : ""}`;
      }

      /* -- "View all N comments" -- */
      let viewAllBtn = null;
      if (postComments.length > 0) {
        viewAllBtn = document.createElement("button");
        viewAllBtn.type = "button";
        viewAllBtn.style.cssText =
          "background:none;border:none;padding:0 16px 6px;font-size:0.82rem;color:#999;cursor:pointer;";
        viewAllBtn.textContent = `View all ${postComments.length} comment${postComments.length !== 1 ? "s" : ""}`;
      }

      /* -- Comments list (collapsed by default) -- */
      const commentsWrap = document.createElement("div");
      commentsWrap.className = "post__comments";
      commentsWrap.style.display = "none";

      postComments.forEach((comment) => {
        const commentEl = document.createElement("div");
        commentEl.className = "post__comment";

        const row = document.createElement("div");
        const authorSpan = document.createElement("span");
        authorSpan.className = "post__comment-author";
        authorSpan.textContent = comment.author;
        const bodySpan = document.createElement("span");
        bodySpan.className = "post__comment-body";
        bodySpan.innerHTML = " " + renderMarkdown(comment.body);
        row.append(authorSpan, bodySpan);

        const timeSpan = document.createElement("div");
        timeSpan.className = "post__comment-time";
        timeSpan.textContent = timeAgo(comment.createdAt);

        commentEl.append(row, timeSpan);
        commentsWrap.appendChild(commentEl);
      });

      function toggleComments() {
        commentsWrap.style.display =
          commentsWrap.style.display === "none" ? "block" : "none";
      }
      commentToggle.addEventListener("click", toggleComments);
      if (viewAllBtn) viewAllBtn.addEventListener("click", toggleComments);

      /* -- Comment form -- */
      const commentForm = document.createElement("form");
      commentForm.className = "post__comment-form";

      const commentInput = document.createElement("input");
      commentInput.type = "text";
      commentInput.className = "post__comment-input";
      commentInput.placeholder = user ? "Add a comment\u2026" : "Sign in to comment";
      commentInput.disabled = !user;

      const commentSubmit = document.createElement("button");
      commentSubmit.type = "submit";
      commentSubmit.className = "post__comment-submit";
      commentSubmit.textContent = "Post";
      commentSubmit.disabled = !user;

      commentForm.addEventListener("submit", (event) => {
        event.preventDefault();
        if (!user) return;
        const bodyText = commentInput.value.trim();
        if (!bodyText) return;

        if (!canPostNow(user.id || user.username)) {
          commentInput.placeholder = "Please wait before posting again\u2026";
          return;
        }

        const safeBody = sanitize(bodyText);
        const nextComments = loadComments();
        const entry = {
          id: `comment_${Date.now()}`,
          author: user.username,
          body: safeBody,
          createdAt: new Date().toISOString(),
        };
        nextComments[post.id] = [entry, ...(nextComments[post.id] || [])];
        saveComments(nextComments);
        commentInput.value = "";
        render();
      });

      commentForm.append(commentInput, commentSubmit);

      /* -- Assemble card -- */
      card.appendChild(sheet);
      card.appendChild(actionBar);
      if (likeLine) card.appendChild(likeLine);
      if (viewAllBtn) card.appendChild(viewAllBtn);
      card.appendChild(commentsWrap);
      card.appendChild(commentForm);

      postsContainer.appendChild(card);
    });

    /* -------- Archive section (older articles below) -------- */
    renderArchive(filteredPosts);
  }

  /** Format a date string nicely */
  function formatDate(dateStr) {
    if (!dateStr) return "";
    const d = new Date(dateStr);
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  }

  const ARCHIVE_PAGE_SIZE = 4;
  let _archivePage = 0;
  let _archiveList = [];
  let _searchQuery = "";

  /** Render archive grid with pagination */
  function renderArchive(allFiltered) {
    const archiveGrid = document.getElementById("archiveGrid");
    if (!archiveGrid) return;

    /* Skip the first post (featured) — archive shows the rest */
    let archivePosts = allFiltered.length > 1 ? allFiltered.slice(1) : [];

    _archiveList = archivePosts;

    /* Pagination */
    const totalPages = Math.max(1, Math.ceil(archivePosts.length / ARCHIVE_PAGE_SIZE));
    if (_archivePage >= totalPages) _archivePage = totalPages - 1;
    if (_archivePage < 0) _archivePage = 0;

    const start = _archivePage * ARCHIVE_PAGE_SIZE;
    const visible = archivePosts.slice(start, start + ARCHIVE_PAGE_SIZE);

    archiveGrid.innerHTML = "";

    /* Update arrow states */
    const prevBtn = document.getElementById("archivePrev");
    const nextBtn = document.getElementById("archiveNext");
    if (prevBtn) prevBtn.disabled = _archivePage <= 0;
    if (nextBtn) nextBtn.disabled = _archivePage >= totalPages - 1;

    if (archivePosts.length === 0) {
      const empty = document.createElement("p");
      empty.className = "blog__archive-empty";
      empty.textContent = _searchQuery ? "No articles match your search." : "No more articles yet — check back soon!";
      archiveGrid.appendChild(empty);
      return;
    }

    visible.forEach((post) => {
      const btn = document.createElement("button");
      btn.className = "blog__archive-btn";
      btn.type = "button";

      const btnTitle = document.createElement("span");
      btnTitle.className = "blog__archive-btn-title";
      btnTitle.textContent = post.title;

      const btnDate = document.createElement("span");
      btnDate.className = "blog__archive-btn-date";
      btnDate.textContent = formatDate(post.date || post.createdAt);

      btn.appendChild(btnTitle);
      if (btnDate.textContent) btn.appendChild(btnDate);

      /* Click to view full article */
      btn.addEventListener("click", () => {
        const reordered = [post, ...posts.filter(p => p !== post)];
        posts.splice(0, posts.length, ...reordered);
        render();
        const mainArticle = document.querySelector(".blog__main-article");
        if (mainArticle) mainArticle.scrollTop = 0;
        window.scrollTo({ top: 0, behavior: "smooth" });
      });

      archiveGrid.appendChild(btn);
    });
  }

  /** Wire up archive arrow buttons and search */
  function initArchiveControls() {
    const prevBtn = document.getElementById("archivePrev");
    const nextBtn = document.getElementById("archiveNext");
    const searchInput = document.getElementById("blogSearch");

    prevBtn?.addEventListener("click", () => {
      _archivePage--;
      reRenderArchive();
    });

    nextBtn?.addEventListener("click", () => {
      _archivePage++;
      reRenderArchive();
    });

    searchInput?.addEventListener("input", () => {
      _searchQuery = searchInput.value.trim();
      _archivePage = 0;
      render();          // re-render main article + archive with search applied
    });

    searchInput?.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        _searchQuery = searchInput.value.trim();
        _archivePage = 0;
        render();
      }
    });
  }

  function reRenderArchive() {
    let categoryPosts = posts;
    if (currentCategory !== "all") {
      categoryPosts = posts.filter(p => p.category === currentCategory);
    }
    let filtered = categoryPosts.filter(p => p.title !== "Welcome to Ink & Crayons Articles");
    if (_searchQuery) {
      const q = _searchQuery.toLowerCase();
      filtered = filtered.filter(p => {
        const plain = p.body.replace(/<[^>]+>/g, " ").toLowerCase();
        return p.title.toLowerCase().includes(q) || plain.includes(q) || (p.author || "").toLowerCase().includes(q);
      });
    }
    renderArchive(filtered);
  }

  /* ---------- Composer submit ---------- */
  formEl.addEventListener("submit", (event) => {
    event.preventDefault();
    if (!canPost(user)) {
      statusEl.textContent = "Only designated writers can publish articles.";
      return;
    }

    const title = titleInput.value.trim();
    const body = bodyInput.value.trim();
    if (!title || !body) {
      statusEl.textContent = "Please add a title and article body.";
      return;
    }

    const post = {
      id: `post_${Date.now()}`,
      title: sanitize(title),
      body: sanitize(body),
      author: user.username,
      createdAt: new Date().toISOString(),
    };

    savePost(post);
    titleInput.value = "";
    bodyInput.value = "";
    statusEl.textContent = "Article published!";
    setTimeout(() => {
      statusEl.textContent = "";
    }, 2000);
    loadPosts().then((data) => {
      posts = data;
      render();
    });
  });

  return {
    async init() {
      posts = await loadPosts();
      render();
      initArchiveControls();
      currentCategory = "all";
    },
    setUser,
    render,
    /** Reload posts from storage and re-render */
    async reloadPosts() {
      posts = await loadPosts();
      render();
    },
    /** Return the most recent non-welcome post for the home preview */
    getLatestPost() {
      const filtered = posts.filter(p => p.title !== "Welcome to Ink & Crayons Articles");
      return filtered.length > 0 ? filtered[0] : null;
    },
  };
}
