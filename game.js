import {
  changeUserPassword,
  getUserProfile,
  initAuth,
  onAuthStateChanged,
  signOut,
  updateUserProfile,
} from "./auth/auth.js";
import {
  isValidHttpUrl,
  isValidUsername,
  sanitizeSingleLine,
} from "./utils/validation.js";
import { addWriter, createBlogUI, getWriters, loadPosts, removeWriter } from "./ui/blog.js";
import { createAuthGate } from "./ui/auth.js";
import { createModal } from "./ui/modal.js";
import { loadBooks, renderBooks, addBookOverride } from "./ui/bookshelf.js";
import { loadShopItems, renderShopItems, addShopOverride } from "./ui/shop.js";
import {
  loadAnnouncements,
  renderAnnouncements,
  addAnnouncementOverride,
} from "./ui/whiteboard.js";
import { registerMigrationUtilities } from "./services/localStorageMigration.js";

/* ── DOM References ─────────────────────────────────────── */
const modalEl = document.getElementById("modal");
const modalTitle = document.getElementById("modalTitle");
const modalDescription = document.getElementById("modalDescription");
const modalBody = document.getElementById("modalBody");

const blogPageEl = document.getElementById("blogPage");
const blogCloseBtn = document.getElementById("blogClose");
const aboutPageEl = document.getElementById("aboutPage");
const aboutCloseBtn = document.getElementById("aboutClose");
const blogPostsEl = document.getElementById("blogPosts");
const blogFormEl = document.getElementById("blogForm");
const blogTitleInput = document.getElementById("postTitle");
const blogBodyInput = document.getElementById("postBody");
const blogStatusEl = document.getElementById("blogStatus");
const adminPanelEl = document.getElementById("adminPanel");
const adminStatusEl = document.getElementById("adminStatus");
const adminAnnouncementForm = document.getElementById("adminAnnouncementForm");
const adminAnnouncementTitle = document.getElementById("adminAnnouncementTitle");
const adminAnnouncementMessage = document.getElementById("adminAnnouncementMessage");
const adminResourceForm = document.getElementById("adminResourceForm");
const adminResourceTitle = document.getElementById("adminResourceTitle");
const adminResourceDesc = document.getElementById("adminResourceDesc");
const adminResourceUrl = document.getElementById("adminResourceUrl");
const adminShopForm = document.getElementById("adminShopForm");
const adminShopTitle = document.getElementById("adminShopTitle");
const adminShopDesc = document.getElementById("adminShopDesc");
const adminShopPrice = document.getElementById("adminShopPrice");
const adminShopUrl = document.getElementById("adminShopUrl");
const adminWriterForm = document.getElementById("adminWriterForm");
const adminWriterUsername = document.getElementById("adminWriterUsername");
const adminRemoveWriterBtn = document.getElementById("adminRemoveWriter");
const writersListEl = document.getElementById("writersList");

/* Account modal refs */
const accountModal = document.getElementById("accountModal");
const accountBtn = document.getElementById("accountBtn");
const accountAvatar = document.getElementById("accountAvatar");
const accountUsername = document.getElementById("accountUsername");
const accountEmail = document.getElementById("accountEmail");
const accountRole = document.getElementById("accountRole");
const accountCreated = document.getElementById("accountCreated");
const accountIdEl = document.getElementById("accountId");
const profileForm = document.getElementById("profileForm");
const profileUsernameInput = document.getElementById("profileUsername");
const profilePicUrlInput = document.getElementById("profilePicUrl");
const profileStatus = document.getElementById("profileStatus");
const passwordForm = document.getElementById("passwordForm");
const currentPasswordInput = document.getElementById("currentPassword");
const newPasswordInput = document.getElementById("newPassword");
const confirmPasswordInput = document.getElementById("confirmPassword");
const passwordStatus = document.getElementById("passwordStatus");
const paymentMethodsEl = document.getElementById("paymentMethods");
const paymentForm = document.getElementById("paymentForm");
const cardNameInput = document.getElementById("cardName");
const cardNumberInput = document.getElementById("cardNumber");
const cardExpiryInput = document.getElementById("cardExpiry");
const cardCvcInput = document.getElementById("cardCvc");
const paymentStatusEl = document.getElementById("paymentStatus");

/* Chat modal refs */
const chatModal = document.getElementById("chatModal");
const chatMessages = document.getElementById("chatMessages");
const chatForm = document.getElementById("chatForm");
const chatInput = document.getElementById("chatInput");

const gateEl = document.getElementById("gate");
const gateForm = document.getElementById("gateForm");
const emailInput = document.getElementById("email");
const passwordInput = document.getElementById("password");
const usernameInput = document.getElementById("username");
const signOutButton = document.getElementById("signOutBtn");
const avatarInitialEl = document.getElementById("avatarInitial");
const signInButton = document.getElementById("signInBtn");
const headerSignInBtn = document.getElementById("headerSignIn");
const signUpButton = document.getElementById("signUpBtn");
const forgotPasswordButton = document.getElementById("resetPasswordBtn");
const userStatusEl = document.getElementById("userStatus");

/* Navigation buttons */
const navLessonsBtn = document.getElementById("navLessons");
const navMilestonesBtn = document.getElementById("navMilestones");
const navCoachingBtn = document.getElementById("navCoaching");
const navAboutBtn = document.getElementById("navAbout");
const ctaExploreBtn = document.getElementById("ctaExplore");
const navBlogCtaBtn = document.getElementById("navBlogCta");
const heroCtaBtn = document.getElementById("heroCta");
const stickyBlogBtn = document.getElementById("stickyBlog");
const stickyLessonsBtn = document.getElementById("stickyLessons");
const stickyChatBtn = document.getElementById("stickyChat");
const stickyGuidesBtn = document.getElementById("stickyGuides");
const stickyMusicBtn = document.getElementById("stickyMusic");
/* Footer buttons */
const footBlogBtn = document.getElementById("footBlog");
const footResourcesBtn = document.getElementById("footResources");
const footCoachingBtn = document.getElementById("footCoaching");
const footContactBtn = document.getElementById("footContact");

/* ── State ──────────────────────────────────────────────── */
let currentUser = getUserProfile();
let _eventsAttached = false;

const contentStore = {
  books: [],
  shop: [],
  announcements: [],
};

/* ── UI Components ──────────────────────────────────────── */
const modal = createModal({
  modalEl,
  titleEl: modalTitle,
  descriptionEl: modalDescription,
  bodyEl: modalBody,
  onClose: () => {
    const mc = document.getElementById('marketControl');
    if (mc) mc.style.display = '';
  },
});

const blogUI = blogPostsEl ? createBlogUI({
  postsContainer: blogPostsEl,
  formEl: blogFormEl,
  titleInput: blogTitleInput,
  bodyInput: blogBodyInput,
  statusEl: blogStatusEl,
  currentUser: getUserProfile(),
}) : null;

const authGate = createAuthGate({
  gateEl,
  formEl: gateForm,
  emailInput,
  passwordInput,
  usernameInput,
  statusEl: userStatusEl,
  signInButton,
  signUpButton,
  forgotPasswordButton,
});

/* ── Helpers ────────────────────────────────────────────── */

/**
 * Sections that are freely browsable without signing in.
 * Everything else (downloads, purchases, posting, admin) requires auth.
 */
const PUBLIC_SECTIONS = new Set([
  "blog",
  "about",
  "resources",
  "milestones",
  "lessons",
  "guides",
  "music",
  "chat",
]);

/** Returns true if the section can be viewed without sign-in */
function allowOpenSection(sectionName) {
  return PUBLIC_SECTIONS.has(sectionName);
}

/**
 * Gate protected actions (download, purchase, post, admin).
 * Shows the sign-in modal with a contextual CTA if not authenticated.
 * Returns true when the user IS signed in and may proceed.
 */
function requireAuthFor(action) {
  if (currentUser) return true;
  // Show sign-in gate with contextual message
  authGate.setGateOpen(true);
  return false;
}

function isAdmin() {
  return currentUser?.role === "admin";
}

function setAdminVisibility(visible) {
  adminPanelEl?.setAttribute("aria-hidden", String(!visible));
}

/* ── Content Loading ────────────────────────────────────── */
async function loadContent() {
  const [booksResult, shopResult, announcementsResult] = await Promise.allSettled([
    loadBooks(),
    loadShopItems(),
    loadAnnouncements(),
  ]);

  contentStore.books = booksResult.status === "fulfilled" ? booksResult.value : [];
  contentStore.shop = shopResult.status === "fulfilled" ? shopResult.value : [];
  contentStore.announcements = announcementsResult.status === "fulfilled" ? announcementsResult.value : [];

  if (booksResult.status === "rejected") {
    console.warn("Unable to load books JSON.", booksResult.reason);
  }
  if (shopResult.status === "rejected") {
    console.warn("Unable to load shop JSON.", shopResult.reason);
  }
  if (announcementsResult.status === "rejected") {
    console.warn("Unable to load announcements JSON.", announcementsResult.reason);
  }
}

/* ── Navigation Actions ─────────────────────────────────── */
const marketControlEl = document.getElementById('marketControl');
function setMarketVisible(visible) {
  if (marketControlEl) marketControlEl.style.display = visible ? '' : 'none';
}

function openBlog() {
  // Navigate to the standalone blog page
  window.location.href = "blog.html";
}

function closeBlog() {
  // No longer used — blog is a separate page
}

function openAbout() {
  aboutPageEl.setAttribute("aria-hidden", "false");
  setMarketVisible(false);
}

function closeAbout() {
  aboutPageEl.setAttribute("aria-hidden", "true");
  setMarketVisible(true);
}

function openResources() {
  // Resources are publicly browsable; downloads require auth
  setMarketVisible(false);
  const nodes = contentStore.books.length
    ? renderBooks(contentStore.books)
    : [Object.assign(document.createElement("p"), { textContent: "No resource links available right now." })];
  modal.open({
    title: "Bookshelf Resources",
    description: currentUser
      ? "Browse online books and classroom resources."
      : "Browse resources — sign in to download.",
    contentNodes: nodes,
  });
}

function openLessons() {
  // Lessons are publicly browsable; purchases require auth
  setMarketVisible(false);
  const nodes = contentStore.shop.length
    ? renderShopItems(contentStore.shop)
    : [Object.assign(document.createElement("p"), { textContent: "No shop links available right now." })];
  modal.open({
    title: "Education Worksheets & More",
    description: currentUser
      ? "Browse all our printable worksheets and learning resources."
      : "Browse worksheets — sign in to purchase.",
    contentNodes: nodes,
  });
}

const worksheetCategories = {
  "name-tracing": {
    title: "Name Tracing",
    description: "Practice writing names with guided tracing worksheets.",
  },
  "cutting-pages": {
    title: "Cutting Pages",
    description: "Fun scissor-skills pages to build hand coordination.",
  },
  "abcs": {
    title: "ABC's",
    description: "Learn the alphabet with tracing, coloring, and matching activities.",
  },
  "number-tracing": {
    title: "Number Tracing",
    description: "Practice writing numbers 0–20 with guided tracing sheets.",
  },
  "fine-motor": {
    title: "Fine Motor Skills",
    description: "Strengthen little hands with lacing, dotting, and pinching activities.",
  },
};

function openWorksheetCategory(category) {
  const info = worksheetCategories[category];
  if (!info) return openLessons();
  setMarketVisible(false);
  modal.open({
    title: info.title,
    description: currentUser
      ? info.description
      : info.description + " Sign in to download.",
    contentNodes: renderShopItems(contentStore.shop),
  });
}

function openMilestones() {
  setMarketVisible(false);
  modal.open({
    title: "Educational Milestones",
    description: "Track key milestones in your child's learning journey.",
    contentNodes: renderAnnouncements(contentStore.announcements),
  });
}

function openGuides() {
  setMarketVisible(false);
  modal.open({
    title: "Parent Coaching",
    description: "Helpful guides and coaching resources for parents and caregivers.",
    contentNodes: renderAnnouncements(contentStore.announcements),
  });
}

function openMusic() {
  setMarketVisible(false);
  const nodes = contentStore.books.length
    ? renderBooks(contentStore.books)
    : [Object.assign(document.createElement("p"), { textContent: "No music links available right now." })];
  modal.open({
    title: "Music & Activities",
    description: "Songs, rhymes, and creative activities for little learners.",
    contentNodes: nodes,
  });
}

function scrollToSection(id) {
  document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
}

/* ── Event Binding ──────────────────────────────────────── */
function attachEvents() {
  if (_eventsAttached) return;
  _eventsAttached = true;

  // TEMP DEBUG: verify sign-in button lookup before binding click listener
  console.debug("[TEMP DEBUG] sign-in button lookup result", {
    found: Boolean(headerSignInBtn),
  });

  /* Header nav pills */
  navLessonsBtn?.addEventListener("click", openLessons);

  /* Dropdown category items */
  document.querySelectorAll(".nav-dropdown__item[data-category]").forEach((item) => {
    item.addEventListener("click", () => {
      openWorksheetCategory(item.dataset.category);
    });
  });

  navMilestonesBtn?.addEventListener("click", openMilestones);
  navCoachingBtn?.addEventListener("click", openGuides);
  navAboutBtn?.addEventListener("click", openAbout);

  /* Header CTAs */
  ctaExploreBtn?.addEventListener("click", () => scrollToSection("howItWorks"));
  navBlogCtaBtn?.addEventListener("click", openBlog);

  /* Hero CTA */
  heroCtaBtn?.addEventListener("click", () => scrollToSection("howItWorks"));

  /* Sticky note buttons */
  stickyBlogBtn?.addEventListener("click", openBlog);
  stickyLessonsBtn?.addEventListener("click", openLessons);
  stickyChatBtn?.addEventListener("click", openChat);

  /* ── Chat Modal ─────────────────────────────────────────── */
  const CHAT_KEY = "lrl_chat_messages";

  function loadChatMessages() {
    const raw = localStorage.getItem(CHAT_KEY);
    if (!raw) return [];
    try { return JSON.parse(raw); } catch { return []; }
  }

  function saveChatMessage(msg) {
    const msgs = loadChatMessages();
    msgs.push(msg);
    localStorage.setItem(CHAT_KEY, JSON.stringify(msgs));
  }

  function chatTimeAgo(dateStr) {
    const diff = Date.now() - new Date(dateStr).getTime();
    const m = Math.floor(diff / 60000);
    if (m < 1) return "just now";
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    return new Date(dateStr).toLocaleDateString();
  }

  function renderChatMessages() {
    if (!chatMessages) return;
    chatMessages.textContent = "";
    const msgs = loadChatMessages();
    if (msgs.length === 0) {
      const empty = document.createElement("div");
      empty.className = "chat-empty";
      empty.textContent = "No messages yet. Say hello!";
      chatMessages.appendChild(empty);
      return;
    }
    msgs.forEach(msg => {
      const el = document.createElement("div");
      const msgIsAdmin = msg.role === "admin";
      el.className = `chat-msg ${msgIsAdmin ? "chat-msg--admin" : "chat-msg--user"}`;

      const author = document.createElement("div");
      author.className = "chat-msg__author";
      author.textContent = sanitizeSingleLine(msg.author, 40) || "User";

      const body = document.createElement("div");
      body.textContent = sanitizeSingleLine(msg.body, 400);

      const time = document.createElement("div");
      time.className = "chat-msg__time";
      time.textContent = chatTimeAgo(msg.createdAt);

      el.append(author, body, time);
      chatMessages.appendChild(el);
    });
    chatMessages.scrollTop = chatMessages.scrollHeight;
  }

  function openChat() {
    // Chat is publicly viewable; posting requires auth
    setMarketVisible(false);
    chatModal?.setAttribute("aria-hidden", "false");
  }

  function closeChat() {
    chatModal?.setAttribute("aria-hidden", "true");
    setMarketVisible(true);
  }

  chatModal?.querySelector(".chat-modal__backdrop")?.addEventListener("click", closeChat);
  chatModal?.querySelector(".chat-modal__close")?.addEventListener("click", closeChat);

  /* Commented out - chat form removed
  chatForm?.addEventListener("submit", (e) => {
    e.preventDefault();
    if (!currentUser) return;
    const body = chatInput.value.trim();
    if (!body) return;
    saveChatMessage({
      id: `msg_${Date.now()}`,
      author: currentUser.username,
      role: currentUser.role || "user",
      body,
      createdAt: new Date().toISOString(),
    });
    chatInput.value = "";
    renderChatMessages();
  });
  */
  
  stickyGuidesBtn?.addEventListener("click", openGuides);
  stickyMusicBtn?.addEventListener("click", openMusic);

  /* Footer buttons */
  footBlogBtn?.addEventListener("click", openBlog);
  footResourcesBtn?.addEventListener("click", openResources);
  footCoachingBtn?.addEventListener("click", openGuides);
  footContactBtn?.addEventListener("click", () => {
    window.location.href = "./contact.html";
  });

  blogCloseBtn?.addEventListener("click", closeBlog);
  aboutCloseBtn?.addEventListener("click", closeAbout);

  /* Writer management */
  async function refreshWritersList() {
    if (!writersListEl) return;
    const writers = await getWriters();
    writersListEl.textContent = writers.length
      ? "Current writers: " + writers.join(", ")
      : "No additional writers yet. Only admins can post.";
  }

  adminWriterForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!isAdmin()) return;
    const username = sanitizeSingleLine(adminWriterUsername.value, 20);
    if (!isValidUsername(username)) {
      adminStatusEl.textContent = "Enter a valid username (2-20 chars).";
      return;
    }
    const result = await addWriter(username);
    if (result?.error) {
      adminStatusEl.textContent = result.error;
      return;
    }
    adminStatusEl.textContent = `"${username}" can now publish articles.`;
    adminWriterUsername.value = "";
    await refreshWritersList();
  });

  adminRemoveWriterBtn?.addEventListener("click", async () => {
    if (!isAdmin()) return;
    const username = sanitizeSingleLine(adminWriterUsername.value, 20);
    if (!isValidUsername(username)) {
      adminStatusEl.textContent = "Enter a valid username (2-20 chars).";
      return;
    }
    const result = await removeWriter(username);
    if (result?.error) {
      adminStatusEl.textContent = result.error;
      return;
    }
    adminStatusEl.textContent = `"${username}" removed from writers.`;
    adminWriterUsername.value = "";
    await refreshWritersList();
  });

  refreshWritersList();

  /* ── Account Modal ─────────────────────────────────────── */
  function openAccountModal() {
    if (!currentUser) return;
    setMarketVisible(false);
    populateAccountModal();
    accountModal?.setAttribute("aria-hidden", "false");
  }

  function closeAccountModal() {
    accountModal?.setAttribute("aria-hidden", "true");
    setMarketVisible(true);
  }

  function getInitials(name) {
    if (!name) return "?";
    return name.split(/\s+/).map(w => w[0]).join("").toUpperCase().slice(0, 2);
  }

  function populateAccountModal() {
    const u = getUserProfile();
    if (!u) return;
    accountAvatar.textContent = "";
    if (u.avatarUrl && isValidHttpUrl(u.avatarUrl)) {
      const image = document.createElement("img");
      image.src = u.avatarUrl;
      image.alt = u.username;
      accountAvatar.appendChild(image);
    } else {
      accountAvatar.textContent = getInitials(u.username);
    }
    accountUsername.textContent = u.username;
    accountEmail.textContent = u.email;
    accountRole.textContent = u.role === "admin" ? "Admin" : "Member";
    profileUsernameInput.value = u.username;
    profilePicUrlInput.value = u.avatarUrl || "";
    accountCreated.textContent = `Member since: ${new Date(u.createdAt).toLocaleDateString()}`;
    accountIdEl.textContent = `Account ID: ${u.id}`;
    renderPaymentCards();
  }

  function renderPaymentCards() {
    paymentMethodsEl.textContent = "";
    const note = document.createElement("p");
    note.style.fontSize = "0.85rem";
    note.style.color = "#999";
    note.textContent = "Card storage is disabled. Use external checkout links in the shop.";
    paymentMethodsEl.appendChild(note);

    if (paymentForm) {
      Array.from(paymentForm.querySelectorAll("input")).forEach((input) => {
        input.required = false;
        input.disabled = true;
      });
      const submitBtn = paymentForm.querySelector("button[type='submit']");
      if (submitBtn) submitBtn.disabled = true;
    }
  }

  accountBtn?.addEventListener("click", () => {
    if (!requireAuthFor("account")) return;
    openAccountModal();
  });

  headerSignInBtn?.addEventListener("click", () => {
    authGate.setGateOpen(true);
  });
  // TEMP DEBUG: confirm click listener attachment for header sign-in
  console.debug("[TEMP DEBUG] sign-in click listener attached", {
    attached: Boolean(headerSignInBtn),
  });

  accountModal?.querySelector(".account-modal__close")?.addEventListener("click", closeAccountModal);
  accountModal?.querySelector(".account-modal__backdrop")?.addEventListener("click", closeAccountModal);

  /* Sign out from account modal */
  signOutButton?.addEventListener("click", async () => {
    closeAccountModal();
    await signOut();
  });

  profileForm?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const username = sanitizeSingleLine(profileUsernameInput.value, 20);
    const avatarUrl = profilePicUrlInput.value.trim();
    if (!isValidUsername(username)) { profileStatus.textContent = "Username must be 2-20 chars."; return; }
    if (avatarUrl && !isValidHttpUrl(avatarUrl)) {
      profileStatus.textContent = "Profile URL must be a valid http(s) URL.";
      return;
    }
    const result = await updateUserProfile({ username, avatarUrl: avatarUrl || undefined });
    if (result.error) {
      profileStatus.textContent = result.error;
    } else {
      profileStatus.textContent = "Profile updated!";
      setTimeout(() => { profileStatus.textContent = ""; }, 2000);
    }
  });

  passwordForm?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const current = currentPasswordInput.value;
    const next = newPasswordInput.value;
    const confirm = confirmPasswordInput.value;
    if (next !== confirm) { passwordStatus.textContent = "Passwords don't match."; return; }
    if (next.length < 6) { passwordStatus.textContent = "Password must be at least 6 characters."; return; }
    const result = await changeUserPassword({ currentPassword: current, newPassword: next });
    if (result.error) {
      passwordStatus.textContent = result.error;
    } else {
      passwordStatus.textContent = "Password updated!";
      currentPasswordInput.value = "";
      newPasswordInput.value = "";
      confirmPasswordInput.value = "";
      setTimeout(() => { passwordStatus.textContent = ""; }, 2000);
    }
  });

  paymentForm?.addEventListener("submit", (e) => {
    e.preventDefault();
    paymentStatusEl.textContent = "Card storage is disabled for security. Use external checkout links.";
    cardNameInput.value = "";
    cardNumberInput.value = "";
    cardExpiryInput.value = "";
    cardCvcInput.value = "";
    renderPaymentCards();
  });

  adminAnnouncementForm?.addEventListener("submit", (event) => {
    event.preventDefault();
    if (!isAdmin()) return;
    const title = sanitizeSingleLine(adminAnnouncementTitle.value, 120);
    const message = sanitizeSingleLine(adminAnnouncementMessage.value, 500);
    if (!title || !message) return;
    addAnnouncementOverride({ title, message });
    adminStatusEl.textContent = "Announcement saved.";
    adminAnnouncementTitle.value = "";
    adminAnnouncementMessage.value = "";
    loadContent();
  });

  adminResourceForm?.addEventListener("submit", (event) => {
    event.preventDefault();
    if (!isAdmin()) return;
    const title = sanitizeSingleLine(adminResourceTitle.value, 120);
    const description = sanitizeSingleLine(adminResourceDesc.value, 400);
    const url = adminResourceUrl.value.trim();
    if (!title || !description || !url) return;
    if (!isValidHttpUrl(url)) {
      adminStatusEl.textContent = "Resource URL must be a valid http(s) URL.";
      return;
    }
    addBookOverride({ title, description, url });
    adminStatusEl.textContent = "Resource link saved.";
    adminResourceTitle.value = "";
    adminResourceDesc.value = "";
    adminResourceUrl.value = "";
    loadContent();
  });

  adminShopForm?.addEventListener("submit", (event) => {
    event.preventDefault();
    if (!isAdmin()) return;
    const title = sanitizeSingleLine(adminShopTitle.value, 120);
    const description = sanitizeSingleLine(adminShopDesc.value, 400);
    const price = sanitizeSingleLine(adminShopPrice.value, 40);
    const url = adminShopUrl.value.trim();
    if (!title || !description || !price || !url) return;
    if (!isValidHttpUrl(url)) {
      adminStatusEl.textContent = "Shop URL must be a valid http(s) URL.";
      return;
    }
    addShopOverride({ title, description, price, url });
    adminStatusEl.textContent = "Shop item saved.";
    adminShopTitle.value = "";
    adminShopDesc.value = "";
    adminShopPrice.value = "";
    adminShopUrl.value = "";
    loadContent();
  });
}

/* ── Init ───────────────────────────────────────────────── */
async function init() {
  // TEMP DEBUG: homepage init start
  console.debug("[TEMP DEBUG] homepage init start");

  registerMigrationUtilities();
  attachEvents();

  // TEMP DEBUG: auth init start
  console.debug("[TEMP DEBUG] auth init start");
  try {
    await initAuth();
  } catch (error) {
    // TEMP DEBUG: auth/profile sync failures should not block homepage wiring
    console.error("[TEMP DEBUG] auth init failed, continuing homepage init", error);
  }
  // TEMP DEBUG: auth init end
  console.debug("[TEMP DEBUG] auth init end");

  try {
    onAuthStateChanged((user) => {
      currentUser = user;
      blogUI?.setUser(user);
      if (blogStatusEl) {
        blogStatusEl.textContent = user
          ? ""
          : "Sign in to read articles and comment.";
      }
      setAdminVisibility(isAdmin());
      if (!isAdmin() && adminStatusEl) adminStatusEl.textContent = "";
      if (accountBtn) accountBtn.hidden = !user;
      if (headerSignInBtn) headerSignInBtn.hidden = !!user;
      /* Update avatar initial */
      if (avatarInitialEl && user) {
        const name = user.username || user.email || "?";
        avatarInitialEl.textContent = name.charAt(0).toUpperCase();
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
      blogUI?.render();
    });
  } catch (error) {
    // TEMP DEBUG: auth state listener failures should not break homepage init
    console.error("[TEMP DEBUG] auth listener setup failed, continuing homepage init", error);
  }

  try {
    await loadContent();
  } catch (error) {
    // TEMP DEBUG: content load failures should not block event wiring
    console.error("[TEMP DEBUG] content load failed, continuing homepage init", error);
  }
  modal.setOpen(false);

  /* ── Home-page blog preview ──────────────────────────── */
  try {
    await populateHomeBlogPreview();
  } catch (error) {
    // TEMP DEBUG: latest blogs preview should fail open with fallback UI
    console.error("[TEMP DEBUG] latest blogs render failed", error);
    const cardEl = document.getElementById("homeBlogCard");
    if (cardEl) {
      cardEl.textContent = "";
      const empty = document.createElement("p");
      empty.style.color = "#999";
      empty.style.textAlign = "center";
      empty.textContent = "Unable to load latest posts right now.";
      cardEl.appendChild(empty);
    }
  }

  // TEMP DEBUG: homepage init end
  console.debug("[TEMP DEBUG] homepage init end");
}

async function populateHomeBlogPreview() {
  // TEMP DEBUG: latest blogs render start
  console.debug("[TEMP DEBUG] latest blogs render start");

  const cardEl = document.getElementById("homeBlogCard");
  const readMoreBtn = document.getElementById("homeBlogReadMore");
  if (!cardEl) return;

  /* Load posts directly — blogUI may not be available on the home page */
  const posts = await loadPosts();
  // TEMP DEBUG: posts fetch result count
  console.debug("[TEMP DEBUG] posts fetch result count", posts.length);
  const filtered = posts.filter(p => p.title !== "Welcome to Ink & Crayons Articles");
  const latest = filtered.length > 0 ? filtered[0] : null;
  if (!latest) {
    cardEl.textContent = "";
    const empty = document.createElement("p");
    empty.style.color = "#999";
    empty.style.textAlign = "center";
    empty.textContent = "No articles yet — check back soon!";
    cardEl.appendChild(empty);
    // TEMP DEBUG: latest blogs render end
    console.debug("[TEMP DEBUG] latest blogs render end", { hasLatest: false });
    return;
  }

  /* Build the preview card */
  const title = document.createElement("h3");
  title.className = "home-blog-preview__title";
  title.textContent = latest.title;

  const meta = document.createElement("p");
  meta.className = "home-blog-preview__meta";
  meta.textContent = "by " + (latest.author || "Anonymous");

  const snippet = document.createElement("p");
  snippet.className = "home-blog-preview__snippet";
  const plain = latest.body.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  snippet.textContent = plain.length > 260 ? plain.slice(0, 260) + "…" : plain;

  cardEl.textContent = "";
  cardEl.appendChild(title);
  cardEl.appendChild(meta);
  cardEl.appendChild(snippet);

  /* Wire the Read More button */
  readMoreBtn?.addEventListener("click", () => {
    window.location.href = "blog.html";
  });

  // TEMP DEBUG: latest blogs render end
  console.debug("[TEMP DEBUG] latest blogs render end", { hasLatest: true });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init, { once: true });
} else {
  init();
}