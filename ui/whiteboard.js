export async function loadAnnouncements() {
  const response = await fetch("data/announcements.json");
  const data = await response.json();
  return data.announcements || [];
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
