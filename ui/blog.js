const POSTS_KEY = "lrl_posts";
const COMMENTS_KEY = "lrl_comments";
const DELETED_POSTS_KEY = "lrl_deleted_posts";
const LIKES_KEY = "lrl_likes";
const WRITERS_KEY = "lrl_writers"; // usernames allowed to post articles
const SEED_VERSION_KEY = "lrl_posts_seed_version";
const SEED_VERSION = "2026-02-13-2";

/* --- Profanity word list (auto-censored, no admin action needed) --- */
const PROFANITY = [
  "ass","asshole","bastard","bitch","bullshit","crap","damn","dick",
  "dumbass","fuck","fucking","goddam","goddamn","hell","idiot","jackass",
  "moron","nigger","nigga","piss","prick","pussy","retard","retarded",
  "shit","slut","sob","stfu","stupid","suck","tits","twat","whore",
  "wtf","wanker","douche","douchebag","dumb","dummy","nasty","badword",
  "loser","lame","ugly","hate","kill","die","sex","sexy","nude",
  "porn","drug","drugs","drunk","beer","weed","cocaine","meth",
  "boob","boobs","butt","butthole","penis","vagina","anus","dildo",
  "fag","faggot","homo","gay","lesbo","tranny","cunt","cock",
  "spic","chink","kike","cracker","redneck","trash","skank",
  "bloody","bollocks","bugger","sodding","tosser","git","arse",
  "freak","psycho","creep","perv","pervert","molest",
  "bomb","gun","shoot","stab","murder","rape","suicide",
];

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
  PROFANITY.forEach((word) => {
    // Match word boundaries + common leet-speak evasions
    const regex = new RegExp(`\\b${word}\\b`, "gi");
    safe = safe.replace(regex, "****");
  });
  return safe;
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

  const response = await fetch("data/posts.json");
  const data = await response.json();
  const stored = readJson(POSTS_KEY, []);
  const deleted = new Set(readJson(DELETED_POSTS_KEY, []));

  const combined = [...(data.posts || []), ...stored].map((post, index) => {
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
    const filteredPosts = categoryPosts.filter(post => post.title !== "Welcome to Ink & Crayons Articles");
    
    /* Show only the first post (most recent) in main feed */
    const mainPost = filteredPosts.length > 0 ? [filteredPosts[0]] : [];
    const relatedPosts = filteredPosts.length > 1 ? filteredPosts.slice(1) : [];
    
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
        const deleteBtn = document.createElement("button");
        deleteBtn.type = "button";
        deleteBtn.textContent = "Delete";
        deleteBtn.className = "post__delete-btn";
        deleteBtn.addEventListener("click", () => {
          deletePost(post.id);
          loadPosts().then((data) => {
            posts = data;
            render();
          });
        });
        actionBar.appendChild(deleteBtn);
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

    /* Render related articles in sidebar */
    const relatedContainer = document.getElementById("blogRelated");
    if (relatedContainer) {
      relatedContainer.innerHTML = "";
      relatedPosts.forEach((post) => {
        const item = document.createElement("div");
        item.className = "blog__related-item";
        
        const itemTitle = document.createElement("h4");
        itemTitle.className = "blog__related-title";
        itemTitle.textContent = post.title;
        
        const itemAuthor = document.createElement("p");
        itemAuthor.className = "blog__related-author";
        itemAuthor.textContent = "by " + (post.author || "Anonymous");
        
        item.appendChild(itemTitle);
        item.appendChild(itemAuthor);
        relatedContainer.appendChild(item);
      });
    }
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
      
      /* Tab functionality removed - showing all articles */
      currentCategory = "all";
    },
    setUser,
    render,
  };
}
