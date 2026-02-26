const SHOP_OVERRIDE_KEY = "lrl_shop_override";

function readOverrides() {
  const raw = localStorage.getItem(SHOP_OVERRIDE_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw);
  } catch (error) {
    return [];
  }
}

function saveOverrides(list) {
  localStorage.setItem(SHOP_OVERRIDE_KEY, JSON.stringify(list));
}

export function addShopOverride(entry) {
  const list = readOverrides();
  list.unshift(entry);
  saveOverrides(list);
}

export async function loadShopItems() {
  const response = await fetch("./data/shop.json");
  const data = await response.json();
  const overrides = readOverrides();
  return [...overrides, ...(data.items || [])];
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
