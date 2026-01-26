export function getBounds(classroomEl) {
  const rect = classroomEl.getBoundingClientRect();
  return { width: rect.width, height: rect.height };
}

export function getObstacles({ classroomEl, objects }) {
  const rect = classroomEl.getBoundingClientRect();

  return objects
    .filter((object) => object.isSolid)
    .map((object) => {
      const objectRect = object.element.getBoundingClientRect();
      const left = objectRect.left - rect.left;
      const top = objectRect.top - rect.top;
      const right = left + objectRect.width;
      const bottom = top + objectRect.height;

      return {
        id: object.id,
        left,
        top,
        right,
        bottom,
      };
    });
}
