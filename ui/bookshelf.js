const BOOKS_OVERRIDE_KEY = "lrl_books_override";

function readOverrides() {
  const raw = localStorage.getItem(BOOKS_OVERRIDE_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw);
  } catch (error) {
    return [];
  }
}

function saveOverrides(list) {
  localStorage.setItem(BOOKS_OVERRIDE_KEY, JSON.stringify(list));
}

export function addBookOverride(entry) {
  const list = readOverrides();
  list.unshift(entry);
  saveOverrides(list);
}

export async function loadBooks() {
  const response = await fetch("./data/books.json");
  const data = await response.json();
  const overrides = readOverrides();
  // Support both old format (data.books with music) and new format (data.music separate)
  const music = data.music || [];
  return [...overrides, ...music, ...(data.books || [])];
}

export function renderBooks(books) {
  return books.map((book) => {
    const card = document.createElement("div");
    card.className = "modal__card";

    const title = document.createElement("strong");
    title.textContent = book.title;

    const description = document.createElement("p");
    description.textContent = book.description || "";

    const link = document.createElement("a");
    link.href = book.url;
    link.target = "_blank";
    link.rel = "noreferrer";
    link.textContent = "Open resource";

    card.appendChild(title);
    card.appendChild(description);
    card.appendChild(link);
    return card;
  });
}
