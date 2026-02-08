import {
  initAuth,
  onAuthStateChanged,
  signOut,
  getUserProfile,
  updateUserProfile,
  changeUserPassword,
  getPaymentMethods,
  addPaymentMethod,
  removePaymentMethod,
} from "./auth/auth.js";
import { createAuthGate } from "./ui/auth.js";
import { createModal } from "./ui/modal.js";
import { loadBooks, renderBooks, addBookOverride } from "./ui/bookshelf.js";
import { createBlogUI, addWriter, removeWriter, getWriters } from "./ui/blog.js";
import { loadShopItems, renderShopItems, addShopOverride } from "./ui/shop.js";
import {
  loadAnnouncements,
  renderAnnouncements,
  addAnnouncementOverride,
} from "./ui/whiteboard.js";

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
const signUpButton = document.getElementById("signUpBtn");
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
});

const blogUI = createBlogUI({
  postsContainer: blogPostsEl,
  formEl: blogFormEl,
  titleInput: blogTitleInput,
  bodyInput: blogBodyInput,
  statusEl: blogStatusEl,
  currentUser: getUserProfile(),
});

const authGate = createAuthGate({
  gateEl,
  formEl: gateForm,
  emailInput,
  passwordInput,
  usernameInput,
  statusEl: userStatusEl,
  signInButton,
  signUpButton,
});

/* ── Helpers ────────────────────────────────────────────── */
function ensureSignedIn() {
  if (currentUser) return true;
  authGate.setGateOpen(true);
  return false;
}

function isAdmin() {
  return currentUser?.role === "admin";
}

function setAdminVisibility(visible) {
  adminPanelEl.setAttribute("aria-hidden", String(!visible));
}

/* ── Content Loading ────────────────────────────────────── */
async function loadContent() {
  try {
    const [books, shopItems, announcements] = await Promise.all([
      loadBooks(),
      loadShopItems(),
      loadAnnouncements(),
    ]);
    contentStore.books = books;
    contentStore.shop = shopItems;
    contentStore.announcements = announcements;
  } catch (error) {
    console.warn("Unable to load content JSON.", error);
  }
}

/* ── Navigation Actions ─────────────────────────────────── */
function openBlog() {
  if (!ensureSignedIn()) return;
  blogPageEl.setAttribute("aria-hidden", "false");
  blogUI.init();
}

function closeBlog() {
  blogPageEl.setAttribute("aria-hidden", "true");
}

function openAbout() {
  aboutPageEl.setAttribute("aria-hidden", "false");
}

function closeAbout() {
  aboutPageEl.setAttribute("aria-hidden", "true");
}

function openResources() {
  if (!ensureSignedIn()) return;
  modal.open({
    title: "Bookshelf Resources",
    description: "Browse online books and classroom resources.",
    contentNodes: renderBooks(contentStore.books),
  });
}

function openLessons() {
  if (!ensureSignedIn()) return;
  modal.open({
    title: "Education Worksheets & More",
    description: "Browse all our printable worksheets and learning resources.",
    contentNodes: renderShopItems(contentStore.shop),
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
  if (!ensureSignedIn()) return;
  const info = worksheetCategories[category];
  if (!info) return openLessons();
  modal.open({
    title: info.title,
    description: info.description,
    contentNodes: renderShopItems(contentStore.shop),
  });
}

function openMilestones() {
  if (!ensureSignedIn()) return;
  modal.open({
    title: "Educational Milestones",
    description: "Track key milestones in your child's learning journey.",
    contentNodes: renderAnnouncements(contentStore.announcements),
  });
}

function openGuides() {
  if (!ensureSignedIn()) return;
  modal.open({
    title: "Parent Coaching",
    description: "Helpful guides and coaching resources for parents and caregivers.",
    contentNodes: renderAnnouncements(contentStore.announcements),
  });
}

function openMusic() {
  if (!ensureSignedIn()) return;
  modal.open({
    title: "Music & Activities",
    description: "Songs, rhymes, and creative activities for little learners.",
    contentNodes: renderBooks(contentStore.books),
  });
}

function scrollToSection(id) {
  document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
}

/* ── Event Binding ──────────────────────────────────────── */
function attachEvents() {
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
    chatMessages.innerHTML = "";
    const msgs = loadChatMessages();
    if (msgs.length === 0) {
      chatMessages.innerHTML = '<div class="chat-empty">No messages yet. Say hello!</div>';
      return;
    }
    msgs.forEach(msg => {
      const el = document.createElement("div");
      const isAdmin = msg.role === "admin";
      el.className = `chat-msg ${isAdmin ? "chat-msg--admin" : "chat-msg--user"}`;
      el.innerHTML = `
        <div class="chat-msg__author">${msg.author}</div>
        <div>${msg.body}</div>
        <div class="chat-msg__time">${chatTimeAgo(msg.createdAt)}</div>
      `;
      chatMessages.appendChild(el);
    });
    chatMessages.scrollTop = chatMessages.scrollHeight;
  }

  function openChat() {
    if (!ensureSignedIn()) return;
    renderChatMessages();
    chatModal?.setAttribute("aria-hidden", "false");
    chatInput?.focus();
  }

  function closeChat() {
    chatModal?.setAttribute("aria-hidden", "true");
  }

  chatModal?.querySelector(".chat-modal__backdrop")?.addEventListener("click", closeChat);
  chatModal?.querySelector(".chat-modal__close")?.addEventListener("click", closeChat);

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
  stickyGuidesBtn?.addEventListener("click", openGuides);
  stickyMusicBtn?.addEventListener("click", openMusic);

  /* Footer buttons */
  footBlogBtn?.addEventListener("click", openBlog);
  footResourcesBtn?.addEventListener("click", openResources);
  footCoachingBtn?.addEventListener("click", openGuides);
  footContactBtn?.addEventListener("click", () => {
    modal.open({ title: "Contact Us", description: "We'd love to hear from you!", contentNodes: [] });
  });

  blogCloseBtn?.addEventListener("click", closeBlog);
  aboutCloseBtn?.addEventListener("click", closeAbout);

  /* Writer management */
  function refreshWritersList() {
    if (!writersListEl) return;
    const writers = getWriters();
    writersListEl.textContent = writers.length
      ? "Current writers: " + writers.join(", ")
      : "No additional writers yet. Only admins can post.";
  }

  adminWriterForm?.addEventListener("submit", (event) => {
    event.preventDefault();
    if (!isAdmin()) return;
    const username = adminWriterUsername.value.trim();
    if (!username) return;
    addWriter(username);
    adminStatusEl.textContent = `"${username}" can now publish articles.`;
    adminWriterUsername.value = "";
    refreshWritersList();
  });

  adminRemoveWriterBtn?.addEventListener("click", () => {
    if (!isAdmin()) return;
    const username = adminWriterUsername.value.trim();
    if (!username) return;
    removeWriter(username);
    adminStatusEl.textContent = `"${username}" removed from writers.`;
    adminWriterUsername.value = "";
    refreshWritersList();
  });

  refreshWritersList();

  /* ── Account Modal ─────────────────────────────────────── */
  function openAccountModal() {
    if (!currentUser) return;
    populateAccountModal();
    accountModal?.setAttribute("aria-hidden", "false");
  }

  function closeAccountModal() {
    accountModal?.setAttribute("aria-hidden", "true");
  }

  function getInitials(name) {
    if (!name) return "?";
    return name.split(/\s+/).map(w => w[0]).join("").toUpperCase().slice(0, 2);
  }

  function populateAccountModal() {
    const u = getUserProfile();
    if (!u) return;
    if (u.avatarUrl) {
      accountAvatar.innerHTML = `<img src="${u.avatarUrl}" alt="${u.username}" />`;
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
    const cards = getPaymentMethods();
    paymentMethodsEl.innerHTML = "";
    if (cards.length === 0) {
      paymentMethodsEl.innerHTML = '<p style="font-size:0.85rem;color:#999;">No payment methods saved.</p>';
      return;
    }
    cards.forEach(card => {
      const el = document.createElement("div");
      el.className = "account-payment-card";
      el.innerHTML = `
        <div class="account-payment-card__info">
          <span>&#128179;</span>
          <span>${card.name} &middot; **** ${card.lastFour} &middot; ${card.expiry}</span>
        </div>
        <button class="account-payment-card__remove" data-card-id="${card.id}" type="button">Remove</button>
      `;
      el.querySelector(".account-payment-card__remove").addEventListener("click", () => {
        removePaymentMethod(card.id);
        renderPaymentCards();
      });
      paymentMethodsEl.appendChild(el);
    });
  }

  accountBtn?.addEventListener("click", () => {
    if (!ensureSignedIn()) return;
    openAccountModal();
  });

  accountModal?.querySelector(".account-modal__close")?.addEventListener("click", closeAccountModal);
  accountModal?.querySelector(".account-modal__backdrop")?.addEventListener("click", closeAccountModal);

  /* Sign out from account modal */
  signOutButton?.addEventListener("click", () => {
    closeAccountModal();
    signOut();
  });

  profileForm?.addEventListener("submit", (e) => {
    e.preventDefault();
    const username = profileUsernameInput.value.trim();
    const avatarUrl = profilePicUrlInput.value.trim();
    if (!username) { profileStatus.textContent = "Username is required."; return; }
    const result = updateUserProfile({ username, avatarUrl: avatarUrl || undefined });
    if (result.error) {
      profileStatus.textContent = result.error;
    } else {
      profileStatus.textContent = "Profile updated!";
      setTimeout(() => { profileStatus.textContent = ""; }, 2000);
    }
  });

  passwordForm?.addEventListener("submit", (e) => {
    e.preventDefault();
    const current = currentPasswordInput.value;
    const next = newPasswordInput.value;
    const confirm = confirmPasswordInput.value;
    if (next !== confirm) { passwordStatus.textContent = "Passwords don't match."; return; }
    if (next.length < 6) { passwordStatus.textContent = "Password must be at least 6 characters."; return; }
    const result = changeUserPassword({ currentPassword: current, newPassword: next });
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
    const name = cardNameInput.value.trim();
    const number = cardNumberInput.value.replace(/\s/g, "");
    const expiry = cardExpiryInput.value.trim();
    if (!name || number.length < 4 || !expiry) {
      paymentStatusEl.textContent = "Please fill all card fields.";
      return;
    }
    const lastFour = number.slice(-4);
    const result = addPaymentMethod({ name, lastFour, expiry });
    if (result.error) {
      paymentStatusEl.textContent = result.error;
    } else {
      paymentStatusEl.textContent = "Card saved!";
      cardNameInput.value = "";
      cardNumberInput.value = "";
      cardExpiryInput.value = "";
      cardCvcInput.value = "";
      renderPaymentCards();
      setTimeout(() => { paymentStatusEl.textContent = ""; }, 2000);
    }
  });

  adminAnnouncementForm?.addEventListener("submit", (event) => {
    event.preventDefault();
    if (!isAdmin()) return;
    const title = adminAnnouncementTitle.value.trim();
    const message = adminAnnouncementMessage.value.trim();
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
    const title = adminResourceTitle.value.trim();
    const description = adminResourceDesc.value.trim();
    const url = adminResourceUrl.value.trim();
    if (!title || !description || !url) return;
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
    const title = adminShopTitle.value.trim();
    const description = adminShopDesc.value.trim();
    const price = adminShopPrice.value.trim();
    const url = adminShopUrl.value.trim();
    if (!title || !description || !price || !url) return;
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
  initAuth();

  onAuthStateChanged((user) => {
    currentUser = user;
    blogUI.setUser(user);
    blogStatusEl.textContent = user
      ? ""
      : "Sign in to read articles and comment.";
    setAdminVisibility(isAdmin());
    if (!isAdmin()) adminStatusEl.textContent = "";
    if (accountBtn) accountBtn.hidden = !user;
    /* Update avatar initial */
    if (avatarInitialEl && user) {
      const name = user.username || user.email || "?";
      avatarInitialEl.textContent = name.charAt(0).toUpperCase();
      /* If user has an avatar URL, show image instead */
      if (user.avatarUrl) {
        accountBtn.innerHTML = `<img src="${user.avatarUrl}" alt="Profile" class="site-header__avatar-img" />`;
      } else {
        accountBtn.innerHTML = `<span id="avatarInitial" class="site-header__avatar-initial">${name.charAt(0).toUpperCase()}</span>`;
      }
    }
    blogUI.render();
  });

  await loadContent();
  attachEvents();
  modal.setOpen(false);
}

init();