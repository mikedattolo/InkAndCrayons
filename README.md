# 🌱 LittleRootsLearning  
### An Interactive, Game-Styled Educational Website & Teacher Marketplace

---

## 📖 Project Description

**LittleRootsLearning** is a **game-inspired educational website** designed as a **virtual classroom environment**.  
Users create accounts, choose a username, and control a **player avatar** that moves around a classroom.  
Different objects in the classroom unlock educational content, blog posts, and lesson-plan purchases.

The platform combines:
- 🎮 A 2D interactive game world  
- 🧑‍🏫 A teacher-focused blog and resource hub  
- 🛒 A lightweight digital marketplace  

All while remaining **fully compatible with GitHub Pages** and **free-tier services only**.

---

## 🎯 Core Goals

- Feel like a **game**, not a traditional website
- Encourage exploration instead of scrolling
- Be visually engaging but technically lightweight
- Allow **real user accounts** with usernames
- Enable monetization **without paid infrastructure**
- Be expandable over time (more rooms, features, users)

---

## 👤 User Accounts & Authentication (Critical Feature)

### Requirements
Users must be able to:
- Create an account with:
  - Email
  - Password
  - Username (unique)
- Log in and log out
- Persist identity across sessions
- Store basic profile data

### Implementation Constraints
- ❌ No custom backend server
- ❌ No paid authentication services
- ✅ Must work on GitHub Pages

### Approved Solution
Use a **free-tier external auth provider**, such as:
- Firebase Authentication (Email + Password)
- Supabase Authentication (Email + Password)

### User Data Stored
- Email
- Username
- Avatar (default selectable options)
- Progress (visited areas, unlocked interactions)

### Storage
- Auth provider → identity
- localStorage → non-critical state (progress, preferences)
- JSON or provider DB → usernames mapped to user IDs

### Design Rule
Authentication logic **must be isolated** so it can be swapped or extended later without rewriting game code.

---

## 🧍 Player & Movement System

- 2D top-down or side-view classroom
- Player avatar visible at all times
- Keyboard controls:
  - WASD
  - Arrow keys
- Smooth movement with easing
- Collision boundaries to prevent leaving room or walking through objects
- Player position tracked in real time

---

## 🏫 Classroom Environment

### Visuals
- Single classroom scene (initially)
- Static background image or tile-based layout
- Clear, recognizable objects:
  - 📚 Bookshelf
  - 💻 Computer
  - 🪑 Desk
  - 🧠 Whiteboard
  - 🚪 Door

### Expansion
The classroom should be designed so additional rooms (hallways, subjects, grade levels) can be added later.

---

## 🧩 Interactive Objects (Hotspots)

### General Interaction Rules
- Objects have invisible interaction zones
- When player enters zone:
  - Object highlights OR
  - Interaction prompt appears (e.g. “Press E”)
- Interactions open **modal UI overlays**
- No page reloads

---

### 📚 Bookshelf
**Purpose:** Learning resources

- Opens a modal panel
- Displays:
  - Online book links
  - PDFs
  - External educational websites
- Data loaded from `books.json`
- Links open in a new browser tab

---

### 💻 Computer (Blog Hub)
**Purpose:** Reading & publishing content

- Opens blog interface overlay
- Displays posts loaded from `posts.json`
- Posts support:
  - Titles
  - Body text (Markdown or HTML)
  - Images (optional)
- Phase 2:
  - Logged-in users may submit posts (stored externally or locally)

---

### 🪑 Desk (Marketplace)
**Purpose:** Monetization

- Opens shop UI overlay
- Displays lesson plans and resources
- Each item includes:
  - Title
  - Description
  - Price
  - External purchase link
- Purchase handled via:
  - Gumroad
  - Payhip
  - Ko-fi Shop
- No internal payment processing required

---

### 🧠 Whiteboard
**Purpose:** Announcements & guidance

- Displays:
  - Updates
  - Featured content
  - Welcome messages
- Content loaded from `announcements.json`

---

## 💾 Data & State Management

### Content
- Stored in local JSON files
- Loaded dynamically via JavaScript

### User Progress
- Stored using:
  - localStorage (non-critical)
  - Auth provider DB (critical identity data)

### Rules
- Code must separate:
  - Game logic
  - UI logic
  - Data loading
  - Authentication

---

## 🧱 Technical Stack (Strict Constraints)

- HTML5
- CSS3
- Vanilla JavaScript (ES6+)
- Optional: Phaser.js (only if justified)
- GitHub Pages hosting
- No Node.js server
- No paid APIs or services

---

## 🎨 Design & UX Guidelines

- Smooth animations and transitions
- Friendly, classroom-inspired color palette
- Clean typography
- Game-like UI panels
- Desktop-first experience
- Mobile support as secondary goal

---

## 🗂️ Suggested Project Structure

/
├── index.html
├── style.css
├── game.js
├── auth/
│ ├── auth.js
│ └── user.js
├── game/
│ ├── player.js
│ ├── world.js
│ ├── collisions.js
│ └── interactions.js
├── ui/
│ ├── modal.js
│ ├── blog.js
│ ├── shop.js
│ └── bookshelf.js
├── data/
│ ├── books.json
│ ├── posts.json
│ ├── shop.json
│ └── announcements.json
└── assets/
├── sprites/
├── backgrounds/
└── ui/


---

## 🚀 Development Phases

### Phase 1 – Core Prototype
- Classroom rendering
- Player movement
- One interactive object
- Modal UI system

### Phase 2 – Accounts
- Email/password signup
- Username creation
- Login/logout flow
- Persist user identity

### Phase 3 – Content & Shop
- Blog reader
- Resource library
- Lesson plan shop

### Phase 4 – Polish & Expansion
- Animations
- Sound effects (optional)
- More rooms
- Progress tracking

---

## ☁️ Production Deployment (Cloudflare + Supabase)

- Supabase schema: `supabase/schema.sql`
- Supabase RLS policies: `supabase/rls-policies.sql`
- Migration notes: `docs/migration-notes.md`
- One-time localStorage migration: `docs/localstorage-migration-checklist.md`
- Cloudflare checklist: `docs/cloudflare-pages-checklist.md`

Runtime config is loaded from `config/runtime-config.js`:

```js
window.__LRL_CONFIG__ = {
  SUPABASE_URL: "https://YOUR_PROJECT.supabase.co",
  SUPABASE_ANON_KEY: "YOUR_ANON_KEY"
};
```

---

## ✅ Definition of Success

- Fully playable classroom experience
- User accounts work reliably
- No backend server required
- Hosted entirely on GitHub Pages
- Easy to extend without refactoring
- Feels like a **learning game**, not a blog

---

## 🌱 Vision Statement

LittleRootsLearning is meant to feel like  
**walking into a classroom — not clicking a website.**

