export function updateInteractions({ player, objects, classroomEl, promptEl, isOverlayOpen }) {
  const rect = classroomEl.getBoundingClientRect();
  let closest = null;

  objects.forEach((object) => {
    const objectRect = object.element.getBoundingClientRect();
    const left = objectRect.left - rect.left;
    const top = objectRect.top - rect.top;
    const right = left + objectRect.width;
    const bottom = top + objectRect.height;

    const paddedLeft = left - object.interactionPadding;
    const paddedTop = top - object.interactionPadding;
    const paddedRight = right + object.interactionPadding;
    const paddedBottom = bottom + object.interactionPadding;

    const isNear =
      player.x + player.width > paddedLeft &&
      player.x < paddedRight &&
      player.y + player.height > paddedTop &&
      player.y < paddedBottom;

    object.element.classList.toggle("object--active", isNear);

    if (isNear && !closest) {
      closest = {
        id: object.id,
        name: object.name,
        type: object.type,
        centerX: left + objectRect.width / 2,
        top,
      };
    }
  });

  if (!closest || isOverlayOpen()) {
    promptEl.classList.remove("prompt--visible");
    return null;
  }

  const promptX = closest.centerX;
  const promptY = closest.top - 18;
  promptEl.style.left = `${promptX}px`;
  promptEl.style.top = `${promptY}px`;
  promptEl.textContent = `Press E to explore ${closest.name}`;
  promptEl.classList.add("prompt--visible");

  return closest;
}
