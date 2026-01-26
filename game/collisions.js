export function resolveBounds(player, bounds) {
  const maxX = bounds.width - player.width;
  const maxY = bounds.height - player.height;

  player.x = Math.max(0, Math.min(player.x, maxX));
  player.y = Math.max(0, Math.min(player.y, maxY));
}

export function resolveObstacles(player, obstacles, previous) {
  obstacles.forEach((obstacle) => {
    if (!isOverlapping(player, obstacle)) {
      return;
    }

    if (previous.x + player.width <= obstacle.left) {
      player.x = obstacle.left - player.width;
    } else if (previous.x >= obstacle.right) {
      player.x = obstacle.right;
    } else if (previous.y + player.height <= obstacle.top) {
      player.y = obstacle.top - player.height;
    } else if (previous.y >= obstacle.bottom) {
      player.y = obstacle.bottom;
    }
  });
}

function isOverlapping(player, obstacle) {
  return (
    player.x < obstacle.right &&
    player.x + player.width > obstacle.left &&
    player.y < obstacle.bottom &&
    player.y + player.height > obstacle.top
  );
}
