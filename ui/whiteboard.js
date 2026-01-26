const ANNOUNCE_OVERRIDE_KEY = "lrl_announcements_override";

function readOverrides() {
  const raw = localStorage.getItem(ANNOUNCE_OVERRIDE_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw);
  } catch (error) {
    return [];
  }
}

function saveOverrides(list) {
  localStorage.setItem(ANNOUNCE_OVERRIDE_KEY, JSON.stringify(list));
}

export function addAnnouncementOverride(entry) {
  const list = readOverrides();
  list.unshift(entry);
  saveOverrides(list);
}

export async function loadAnnouncements() {
  const response = await fetch("data/announcements.json");
  const data = await response.json();
  const overrides = readOverrides();
  return [...overrides, ...(data.announcements || [])];
}

export function renderAnnouncements(items) {
  return items.map((item) => {
    const card = document.createElement("div");
    card.className = "modal__card";

    const title = document.createElement("strong");
    title.textContent = item.title;

    const message = document.createElement("p");
    message.textContent = item.message || "";

    card.appendChild(title);
    card.appendChild(message);
    return card;
  });
}
