/**
 * blog-page.js — Standalone entry script for blog.html
 * Handles blog rendering + admin article management (create/edit/delete).
 */
import { createBlogUI, updatePost, loadPosts } from "./ui/blog.js";
import { getUserProfile, initAuth, onAuthStateChanged } from "./auth/auth.js";

/* ── DOM References ──────────────────────────────────── */
const blogPostsEl    = document.getElementById("blogPosts");
const blogFormEl     = document.getElementById("blogForm");
const blogTitleInput = document.getElementById("postTitle");
const blogBodyInput  = document.getElementById("postBody");
const blogStatusEl   = document.getElementById("blogStatus");



/* Editor modal refs */
const editorBackdrop = document.getElementById("articleEditorBackdrop");
const editorForm     = document.getElementById("editorForm");
const editorTitle    = document.getElementById("editorTitle");
const editorAuthor   = document.getElementById("editorAuthor");
const editorDate     = document.getElementById("editorDate");
const editorBody     = document.getElementById("editorBody");
const editorStatus   = document.getElementById("editorStatus");
const editorSubmit   = document.getElementById("editorSubmit");
const editorCancel   = document.getElementById("editorCancel");
const editorClose    = document.getElementById("editorClose");
const editorModalTitle = document.getElementById("editorModalTitle");
const adminNewPostBtn  = document.getElementById("adminNewPost");

/* ── State ───────────────────────────────────────────── */
let currentUser = getUserProfile();
let editingPostId = null; // null = creating new, string = editing existing

function isAdmin() {
  return currentUser?.role === "admin";
}

/* ── Editor Modal ────────────────────────────────────── */
function openEditor(post = null) {
  editingPostId = post ? post.id : null;
  editorModalTitle.textContent = post ? "Edit Article" : "New Article";
  editorSubmit.textContent = post ? "Save Changes" : "Publish";
  editorTitle.value = post ? post.title : "";
  editorAuthor.value = post ? (post.author || "") : (currentUser?.username || "");
  editorBody.value = post ? post.body : "";
  editorStatus.textContent = "";

  /* Set date */
  if (post && (post.date || post.createdAt)) {
    const d = new Date(post.date || post.createdAt);
    editorDate.value = d.toISOString().split("T")[0];
  } else {
    editorDate.value = new Date().toISOString().split("T")[0];
  }

  editorBackdrop.setAttribute("aria-hidden", "false");
  editorTitle.focus();
}

function closeEditor() {
  editorBackdrop.setAttribute("aria-hidden", "true");
  editingPostId = null;
  editorForm.reset();
  editorStatus.textContent = "";
}

/* ── Blog UI ─────────────────────────────────────────── */
const blogUI = createBlogUI({
  postsContainer: blogPostsEl,
  formEl: blogFormEl,
  titleInput: blogTitleInput,
  bodyInput: blogBodyInput,
  statusEl: blogStatusEl,
  currentUser,
  onEditPost: (post) => {
    if (!isAdmin()) return;
    openEditor(post);
  },
});

await blogUI.init();

/* ── Admin visibility ────────────────────────────────── */
function updateAdminUI() {
  const admin = isAdmin();
  if (adminNewPostBtn) adminNewPostBtn.hidden = !admin;
}
updateAdminUI();

/* ── Auth state listener (updates if user signs in/out) ─ */
initAuth();
onAuthStateChanged((user) => {
  currentUser = user;
  blogUI.setUser(user);
  updateAdminUI();
  blogUI.render();
});

/* ── FAB: New article ────────────────────────────────── */
adminNewPostBtn?.addEventListener("click", () => {
  if (!isAdmin()) return;
  openEditor(null);
});

/* ── Editor form submit ──────────────────────────────── */
editorForm?.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!isAdmin()) return;

  const title = editorTitle.value.trim();
  const body  = editorBody.value.trim();
  const author = editorAuthor.value.trim() || currentUser?.username || "Admin";
  const date  = editorDate.value || new Date().toISOString().split("T")[0];

  if (!title || !body) {
    editorStatus.textContent = "Title and body are required.";
    return;
  }

  if (editingPostId) {
    /* ── Update existing post ── */
    const updated = updatePost(editingPostId, { title, body, author, date });
    if (!updated) {
      /* Seed post: save as new post with same ID to localStorage */
      const POSTS_KEY = "lrl_posts";
      const raw = localStorage.getItem(POSTS_KEY);
      const stored = raw ? JSON.parse(raw) : [];
      /* Load all posts to get the seed data */
      const allPosts = await loadPosts();
      const seedPost = allPosts.find(p => p.id === editingPostId);
      if (seedPost) {
        const updatedPost = { ...seedPost, title, body, author, date, updatedAt: new Date().toISOString() };
        stored.unshift(updatedPost);
        localStorage.setItem(POSTS_KEY, JSON.stringify(stored));
        /* Mark the seed version as the same ID so it gets overridden */
        const DELETED_KEY = "lrl_deleted_posts";
        const deletedRaw = localStorage.getItem(DELETED_KEY);
        const deleted = deletedRaw ? JSON.parse(deletedRaw) : [];
        if (!deleted.includes(editingPostId)) {
          deleted.push(editingPostId);
          localStorage.setItem(DELETED_KEY, JSON.stringify(deleted));
        }
      }
    }
    editorStatus.textContent = "Article updated!";
  } else {
    /* ── Create new post ── */
    const newPost = {
      id: `post_${Date.now()}`,
      title,
      body,
      author,
      date,
      createdAt: new Date().toISOString(),
    };
    const POSTS_KEY = "lrl_posts";
    const raw = localStorage.getItem(POSTS_KEY);
    const stored = raw ? JSON.parse(raw) : [];
    stored.unshift(newPost);
    localStorage.setItem(POSTS_KEY, JSON.stringify(stored));
    editorStatus.textContent = "Article published!";
  }

  await blogUI.reloadPosts();
  setTimeout(closeEditor, 800);
});

/* ── Editor cancel / close ───────────────────────────── */
editorCancel?.addEventListener("click", closeEditor);
editorClose?.addEventListener("click", closeEditor);
editorBackdrop?.addEventListener("click", (e) => {
  if (e.target === editorBackdrop) closeEditor();
});

/* ── Formatting toolbar ──────────────────────────────── */
document.querySelectorAll(".editor-modal__fmt-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    const fmt = btn.dataset.fmt;
    const ta = editorBody;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const sel = ta.value.substring(start, end);

    let insert = "";
    switch (fmt) {
      case "bold":
        insert = `<strong>${sel || "bold text"}</strong>`;
        break;
      case "italic":
        insert = `<em>${sel || "italic text"}</em>`;
        break;
      case "h2":
        insert = `<h2>${sel || "Heading"}</h2>`;
        break;
      case "ul":
        insert = sel
          ? sel.split("\n").map(l => `<li>${l}</li>`).join("\n")
          : "<li>Item</li>";
        insert = `<ul>\n${insert}\n</ul>`;
        break;
      case "link":
        insert = `<a href="URL">${sel || "link text"}</a>`;
        break;
    }

    ta.setRangeText(insert, start, end, "end");
    ta.focus();
  });
});


