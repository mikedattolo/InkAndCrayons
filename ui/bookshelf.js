export async function loadBooks() {
  const response = await fetch("data/books.json");
  const data = await response.json();
  return data.books || [];
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
