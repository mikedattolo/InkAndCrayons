import { resolveBounds, resolveObstacles } from "./collisions.js";

export function createPlayer({ element, startX, startY, width, height }) {
  const state = {
    x: startX,
    y: startY,
    width,
    height,
    velocityX: 0,
    velocityY: 0,
  };

  const config = {
    maxSpeed: 200,
    acceleration: 1200,
    friction: 900,
  };

  function applyInput({ dx, dy }, deltaTime) {
    if (dx === 0 && dy === 0) {
      const friction = config.friction * deltaTime;
      state.velocityX = applyFriction(state.velocityX, friction);
      state.velocityY = applyFriction(state.velocityY, friction);
      return;
    }

    state.velocityX += dx * config.acceleration * deltaTime;
    state.velocityY += dy * config.acceleration * deltaTime;

    const speed = Math.hypot(state.velocityX, state.velocityY);
    if (speed > config.maxSpeed) {
      const ratio = config.maxSpeed / speed;
      state.velocityX *= ratio;
      state.velocityY *= ratio;
    }
  }

  function applyFriction(value, amount) {
    if (value > 0) {
      return Math.max(0, value - amount);
    }
    if (value < 0) {
      return Math.min(0, value + amount);
    }
    return 0;
  }

  function update({ direction, deltaTime, bounds, obstacles }) {
    const prevX = state.x;
    const prevY = state.y;

    applyInput(direction, deltaTime);

    state.x += state.velocityX * deltaTime;
    state.y += state.velocityY * deltaTime;

    resolveBounds(state, bounds);
    resolveObstacles(state, obstacles, { x: prevX, y: prevY });
  }

  function render() {
    element.style.transform = `translate(${state.x}px, ${state.y}px)`;
  }

  return {
    state,
    update,
    render,
  };
}
