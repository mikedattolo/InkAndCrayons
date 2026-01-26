const POSTS_KEY = "lrl_posts";
const COMMENTS_KEY = "lrl_comments";
const DELETED_POSTS_KEY = "lrl_deleted_posts";
const PROFANITY = [
  "badword",
  "dummy",
  "nasty",
  "stupid",
  "idiot",
  "dumb",
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
  // Lightweight markdown: **bold**, *italic*, `code`, and URLs.
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
    const regex = new RegExp(`\\b${word}\\b`, "gi");
    safe = safe.replace(regex, "****");
  });
  return safe;
}

export async function loadPosts() {
  const response = await fetch("data/posts.json");
  const data = await response.json();
  const stored = readJson(POSTS_KEY, []);
  const deleted = new Set(readJson(DELETED_POSTS_KEY, []));

  const combined = [...(data.posts || []), ...stored].map((post, index) => {
    if (post.id) return post;
    return { ...post, id: `builtin_${index}` };
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

  function setUser(nextUser) {
    user = nextUser;
  }

  function render() {
    postsContainer.innerHTML = "";
    const comments = loadComments();

    posts.forEach((post) => {
      const card = document.createElement("article");
      card.className = "post";

      const title = document.createElement("strong");
      title.textContent = post.title;

      const meta = document.createElement("div");
      meta.className = "post__meta";
      meta.textContent = `By ${post.author} · ${new Date(post.createdAt).toLocaleDateString()}`;

      const body = document.createElement("div");
      body.className = "modal__body-text";
      body.innerHTML = renderMarkdown(post.body);

      const commentsWrap = document.createElement("div");
      commentsWrap.className = "post__comments";

      const postComments = comments[post.id] || [];
      postComments.forEach((comment) => {
        const commentEl = document.createElement("div");
        commentEl.className = "comment";

        const commentMeta = document.createElement("div");
        commentMeta.className = "comment__meta";
        commentMeta.textContent = `${comment.author} · ${new Date(comment.createdAt).toLocaleDateString()}`;

        const commentBody = document.createElement("div");
        commentBody.innerHTML = renderMarkdown(comment.body);

        commentEl.appendChild(commentMeta);
        commentEl.appendChild(commentBody);
        commentsWrap.appendChild(commentEl);
      });

      const commentForm = document.createElement("form");
      commentForm.className = "comment__form";

      const commentInput = document.createElement("input");
      commentInput.type = "text";
      commentInput.placeholder = user ? "Add a comment" : "Sign in to comment";
      commentInput.disabled = !user;

      const commentButton = document.createElement("button");
      commentButton.type = "submit";
      commentButton.textContent = "Post Comment";
      commentButton.disabled = !user;

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

      commentForm.appendChild(commentInput);
      commentForm.appendChild(commentButton);

      const actions = document.createElement("div");
      actions.className = "post__actions";

      if (user?.role === "admin") {
        const deleteBtn = document.createElement("button");
        deleteBtn.type = "button";
        deleteBtn.textContent = "Delete";
        deleteBtn.className = "post__delete";
        deleteBtn.addEventListener("click", () => {
          deletePost(post.id);
          loadPosts().then((data) => {
            posts = data;
            render();
          });
        });
        actions.appendChild(deleteBtn);
      }

      card.appendChild(title);
      card.appendChild(meta);
      card.appendChild(body);
      if (actions.childNodes.length) {
        card.appendChild(actions);
      }
      card.appendChild(commentsWrap);
      card.appendChild(commentForm);
      postsContainer.appendChild(card);
    });
  }

  formEl.addEventListener("submit", (event) => {
    event.preventDefault();
    if (!user) {
      statusEl.textContent = "Sign in to create a post.";
      return;
    }

    const title = titleInput.value.trim();
    const body = bodyInput.value.trim();
    if (!title || !body) {
      statusEl.textContent = "Please add a title and post body.";
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
    statusEl.textContent = "Post published locally.";
    loadPosts().then((data) => {
      posts = data;
      render();
    });
  });

  return {
    async init() {
      posts = await loadPosts();
      render();
    },
    setUser,
    render,
  };
}
