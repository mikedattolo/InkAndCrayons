export async function loadShopItems() {
  const response = await fetch("data/shop.json");
  const data = await response.json();
  return data.items || [];
}

export function renderShopItems(items) {
  return items.map((item) => {
    const card = document.createElement("div");
    card.className = "modal__card";

    const title = document.createElement("strong");
    title.textContent = item.title;

    const description = document.createElement("p");
    description.textContent = item.description || "";

    const price = document.createElement("small");
    price.textContent = `Price: ${item.price}`;

    const link = document.createElement("a");
    link.href = item.url;
    link.target = "_blank";
    link.rel = "noreferrer";
    link.textContent = "View purchase link";

    card.appendChild(title);
    card.appendChild(description);
    card.appendChild(price);
    card.appendChild(link);
    return card;
  });
}
