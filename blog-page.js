/**
 * blog-page.js — Standalone entry script for blog.html
 * Handles blog rendering + admin article management (create/edit/delete).
 */
import { createBlogUI, updatePost } from "./ui/blog.js";
import { initAuth, onAuthStateChanged } from "./auth/auth.js";
import { createPost } from "./services/blogService.js";
import { registerMigrationUtilities } from "./services/localStorageMigration.js";
import { isValidHttpUrl, sanitizeMultiline, sanitizeSingleLine } from "./utils/validation.js";
import { createAuthGate } from "./ui/auth.js";

/* ── DOM References ──────────────────────────────────── */
const blogPostsEl    = document.getElementById("blogPosts");
const blogFormEl     = document.getElementById("blogForm");
const blogTitleInput = document.getElementById("postTitle");
const blogBodyInput  = document.getElementById("postBody");
const blogStatusEl   = document.getElementById("blogStatus");

/* Auth header refs */
const headerSignInBtn = document.getElementById("headerSignIn");
const accountBtn      = document.getElementById("accountBtn");
const avatarInitialEl = document.getElementById("avatarInitial");

/* Auth gate refs */
const gateEl            = document.getElementById("gate");
const gateCloseBtn      = document.getElementById("gateClose");
const gateBackdrop      = gateEl?.querySelector(".gate__backdrop");
const gateForm          = document.getElementById("gateForm");
const emailInput        = document.getElementById("email");
const passwordInput     = document.getElementById("password");
const usernameInput     = document.getElementById("username");
const signUpButton      = document.getElementById("signUpBtn");
const forgotPasswordBtn = document.getElementById("resetPasswordBtn");
const userStatusEl      = document.getElementById("gateStatus");



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
let editingPostId = null; // null = creating new, string = editing existing

registerMigrationUtilities();

/* ── Auth Gate ───────────────────────────────────────── */
const authGate = gateEl ? createAuthGate({
  gateEl,
  formEl: gateForm,
  emailInput,
  passwordInput,
  usernameInput,
  statusEl: userStatusEl,
  signUpButton,
  forgotPasswordButton: forgotPasswordBtn,
}) : null;

gateCloseBtn?.addEventListener("click", () => authGate?.setGateOpen(false));
gateBackdrop?.addEventListener("click", () => authGate?.setGateOpen(false));
headerSignInBtn?.addEventListener("click", () => authGate?.setGateOpen(true));

/* Initialize auth FIRST so the Supabase session is available for RLS queries */
let currentUser = null;
try {
  currentUser = await initAuth();
} catch (err) {
  console.error("Auth init error on blog page:", err);
}

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

/* ── FAB: New article ────────────────────────────────── */
adminNewPostBtn?.addEventListener("click", () => {
  if (!isAdmin()) return;
  openEditor(null);
});

/* ── Editor form submit ──────────────────────────────── */
editorForm?.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!isAdmin()) return;

  const title = sanitizeSingleLine(editorTitle.value, 200);
  const body  = sanitizeMultiline(editorBody.value, 20000);
  const author = sanitizeSingleLine(editorAuthor.value, 80) || currentUser?.username || "Admin";
  const date  = editorDate.value || new Date().toISOString().split("T")[0];

  if (!title || !body) {
    editorStatus.textContent = "Title and body are required.";
    return;
  }

  if (editingPostId) {
    const updated = await updatePost(editingPostId, { title, body, author, date });
    if (!updated) {
      editorStatus.textContent = "Only Supabase posts can be edited. Seed posts are read-only.";
      return;
    }
    editorStatus.textContent = "Article updated!";
  } else {
    const result = await createPost({
      title,
      body,
      category: "all",
      user: currentUser,
    });
    if (result.error) {
      editorStatus.textContent = result.error;
      return;
    }
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
        insert = `**${sel || "bold text"}**`;
        break;
      case "italic":
        insert = `*${sel || "italic text"}*`;
        break;
      case "h2":
        insert = `${sel || "Heading"}`;
        break;
      case "ul":
        insert = sel
          ? sel.split("\n").map(l => `- ${l}`).join("\n")
          : "- Item";
        break;
      case "link":
        insert = `${sel || "link text"} https://example.com`;
        break;
    }

    ta.setRangeText(insert, start, end, "end");
    ta.focus();
  });
});

/* ── Auth state listener (updates if user signs in/out later) ─ */
onAuthStateChanged((user) => {
  const roleChanged = currentUser?.role !== user?.role;
  currentUser = user;
  blogUI.setUser(user);
  updateAdminUI();

  /* Update header auth buttons */
  if (accountBtn) accountBtn.hidden = !user;
  if (headerSignInBtn) headerSignInBtn.hidden = !!user;
  if (user) {
    const name = user.username || user.email || "?";
    accountBtn.textContent = "";
    if (user.avatarUrl && isValidHttpUrl(user.avatarUrl)) {
      const image = document.createElement("img");
      image.src = user.avatarUrl;
      image.alt = "Profile";
      image.className = "site-header__avatar-img";
      accountBtn.appendChild(image);
    } else {
      const initial = document.createElement("span");
      initial.id = "avatarInitial";
      initial.className = "site-header__avatar-initial";
      initial.textContent = name.charAt(0).toUpperCase();
      accountBtn.appendChild(initial);
    }
  }

  // Reload posts when role changes (e.g. admin sees unpublished posts via RLS)
  if (roleChanged) {
    blogUI.reloadPosts();
  } else {
    blogUI.render();
  }
});


