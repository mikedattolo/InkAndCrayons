import { initAuth, onAuthStateChanged, getUserProfile } from "./auth/auth.js";
import { createAuthGate } from "./ui/auth.js";
import { createModal } from "./ui/modal.js";
import { loadBooks, renderBooks } from "./ui/bookshelf.js";
import { createBlogUI } from "./ui/blog.js";
import { loadShopItems, renderShopItems } from "./ui/shop.js";
import { loadAnnouncements, renderAnnouncements } from "./ui/whiteboard.js";
import { createPlayer } from "./game/player.js";
import { getBounds, getObstacles } from "./game/world.js";
import { updateInteractions } from "./game/interactions.js";

const classroom = document.getElementById("classroom");
const playerEl = document.getElementById("player");
const promptEl = document.getElementById("interactionPrompt");

const modalEl = document.getElementById("modal");
const modalTitle = document.getElementById("modalTitle");
const modalDescription = document.getElementById("modalDescription");
const modalBody = document.getElementById("modalBody");

const blogPageEl = document.getElementById("blogPage");
const blogCloseBtn = document.getElementById("blogClose");
const blogPostsEl = document.getElementById("blogPosts");
const blogFormEl = document.getElementById("blogForm");
const blogTitleInput = document.getElementById("postTitle");
const blogBodyInput = document.getElementById("postBody");
const blogStatusEl = document.getElementById("blogStatus");

const gateEl = document.getElementById("gate");
const gateForm = document.getElementById("gateForm");
const emailInput = document.getElementById("email");
const passwordInput = document.getElementById("password");
const usernameInput = document.getElementById("username");
const signOutButton = document.getElementById("signOutBtn");
const signInButton = document.getElementById("signInBtn");
const signUpButton = document.getElementById("signUpBtn");
const userStatusEl = document.getElementById("userStatus");

const inputState = new Set();
let lastFrameTime = performance.now();
let currentUser = getUserProfile();

const progress = loadProgress();

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
  signOutButton,
  signInButton,
  signUpButton,
});

const player = createPlayer({
  element: playerEl,
  startX: 420,
  startY: 300,
  width: 32,
  height: 40,
});

const objects = [
  {
    id: "bookshelf",
    name: "Bookshelf",
    element: document.getElementById("bookshelf"),
    interactionPadding: 30,
    type: "bookshelf",
    isSolid: true,
  },
  {
    id: "computer",
    name: "Computer",
    element: document.getElementById("computer"),
    interactionPadding: 32,
    type: "blog",
    isSolid: true,
  },
  {
    id: "desk",
    name: "Desk",
    element: document.getElementById("desk"),
    interactionPadding: 30,
    type: "shop",
    isSolid: true,
  },
  {
    id: "whiteboard",
    name: "Whiteboard",
    element: document.getElementById("whiteboard"),
    interactionPadding: 32,
    type: "announcements",
    isSolid: true,
  },
  {
    id: "door",
    name: "Door",
    element: document.getElementById("door"),
    interactionPadding: 36,
    type: "door",
    isSolid: true,
  },
];

const contentStore = {
  books: [],
  shop: [],
  announcements: [],
};

function loadProgress() {
  const raw = localStorage.getItem("lrl_progress");
  if (!raw) {
    return { visited: {} };
  }
  try {
    return JSON.parse(raw);
  } catch (error) {
    console.warn("Progress data corrupted, resetting.");
    return { visited: {} };
  }
}

function saveProgress() {
  localStorage.setItem("lrl_progress", JSON.stringify(progress));
}

function isOverlayOpen() {
  return (
    modalEl.getAttribute("aria-hidden") === "false" ||
    gateEl.getAttribute("aria-hidden") === "false" ||
    blogPageEl.getAttribute("aria-hidden") === "false"
  );
}

function ensureSignedIn() {
  if (currentUser) {
    return true;
  }
  authGate.setGateOpen(true);
  return false;
}

function getDirection() {
  let dx = 0;
  let dy = 0;

  if (inputState.has("ArrowUp") || inputState.has("KeyW")) {
    dy -= 1;
  }
  if (inputState.has("ArrowDown") || inputState.has("KeyS")) {
    dy += 1;
  }
  if (inputState.has("ArrowLeft") || inputState.has("KeyA")) {
    dx -= 1;
  }
  if (inputState.has("ArrowRight") || inputState.has("KeyD")) {
    dx += 1;
  }

  if (dx === 0 && dy === 0) {
    return { dx: 0, dy: 0 };
  }

  const length = Math.hypot(dx, dy) || 1;
  return { dx: dx / length, dy: dy / length };
}

function openInteraction(object) {
  if (!object) {
    return;
  }

  if (!ensureSignedIn()) {
    return;
  }

  if (object.type === "bookshelf") {
    modal.open({
      title: "Bookshelf Resources",
      description: "Browse online books and classroom resources.",
      contentNodes: renderBooks(contentStore.books),
    });
    progress.visited[object.id] = true;
    saveProgress();
    return;
  }

  if (object.type === "blog") {
    openBlog();
    return;
  }

  if (object.type === "shop") {
    modal.open({
      title: "Lesson Plan Marketplace",
      description: "Shop classroom-ready resources.",
      contentNodes: renderShopItems(contentStore.shop),
    });
    progress.visited[object.id] = true;
    saveProgress();
    return;
  }

  if (object.type === "announcements") {
    modal.open({
      title: "Whiteboard Announcements",
      description: "Highlights and guidance for today.",
      contentNodes: renderAnnouncements(contentStore.announcements),
    });
    progress.visited[object.id] = true;
    saveProgress();
    return;
  }

  modal.open({
    title: "Hallway",
    description: "More rooms are coming soon.",
    contentNodes: [],
  });
  progress.visited[object.id] = true;
  saveProgress();
}

function gameLoop(timestamp) {
  const deltaTime = Math.min(0.05, (timestamp - lastFrameTime) / 1000);
  lastFrameTime = timestamp;

  if (!isOverlayOpen()) {
    const bounds = getBounds(classroom);
    const obstacles = getObstacles({ classroomEl: classroom, objects });
    player.update({
      direction: getDirection(),
      deltaTime,
      bounds,
      obstacles,
    });
  }

  player.render();
  const nearest = updateInteractions({
    player: player.state,
    objects,
    classroomEl: classroom,
    promptEl,
    isOverlayOpen,
  });

  window.requestAnimationFrame(gameLoop);
  return nearest;
}

function handleKeyDown(event) {
  inputState.add(event.code);

  if (event.code === "KeyE") {
    const nearest = updateInteractions({
      player: player.state,
      objects,
      classroomEl: classroom,
      promptEl,
      isOverlayOpen,
    });
    openInteraction(nearest);
  }
}

function handleKeyUp(event) {
  inputState.delete(event.code);
}

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

function openBlog() {
  blogPageEl.setAttribute("aria-hidden", "false");
  blogUI.init();
  progress.visited.computer = true;
  saveProgress();
}

function closeBlog() {
  blogPageEl.setAttribute("aria-hidden", "true");
}

function attachEvents() {
  window.addEventListener("keydown", handleKeyDown);
  window.addEventListener("keyup", handleKeyUp);
  blogCloseBtn.addEventListener("click", closeBlog);
}

async function init() {
  initAuth();
  onAuthStateChanged((user) => {
    currentUser = user;
    blogUI.setUser(user);
    blogStatusEl.textContent = user ? "" : "Sign in to create posts and comments.";
  });

  await loadContent();
  attachEvents();
  modal.setOpen(false);
  player.render();
  window.requestAnimationFrame(gameLoop);
}

init();
