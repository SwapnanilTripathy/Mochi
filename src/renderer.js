const pet = document.getElementById("mochi");
const sprite = document.getElementById("sprite");

const frames = {
  idle: [1,2,3,4].map(i => `./assets/idle/idle-${i}.png`),
  walk: [1,2,3,4].map(i => `./assets/walk/walk-${i}.png`)
};

let state = "idle";
let direction = 1;
let frame = 0;
let timer = null;
let dragging = false;
let dragOffset = { x: 0, y: 0 };

function render() {
  const list = frames[state] || frames.idle;
  sprite.src = list[frame % list.length];
  sprite.style.transform = direction < 0 ? "scaleX(-1)" : "scaleX(1)";
  pet.className = `mochi ${state}`;
}

function setState(next) {
  state = ["idle", "walk", "sleep", "stretch", "drag", "edge"].includes(next) ? next : "idle";
  frame = 0;
  render();
  restartAnimation();
}

function restartAnimation() {
  clearInterval(timer);
  const speed = state === "walk" ? 110 : state === "idle" ? 240 : state === "drag" ? 180 : state === "edge" ? 360 : state === "curious" ? 260 : 320;
  timer = setInterval(() => {
    if (state === "edge") {
      frame = (frame + 1) % frames.idle.length;
      render();
      return;
    }
    if (state === "sleep") {
      frame = (frame + 1) % 2;
      sprite.src = frames.idle[frame];
      return;
    }
    frame = (frame + 1) % frames.idle.length;
    render();
  }, speed);
}

window.mochi.onState(setState);
window.mochi.onDirection(d => {
  direction = d;
  render();
});

sprite.onerror = () => {
  console.error("Mochi sprite failed to load:", sprite.src);
  sprite.src = "./assets/mochi.svg";
};

pet.addEventListener("mouseenter", () => {
  if (state === "idle") pet.className = "mochi look";
});

pet.addEventListener("mouseleave", () => {
  pet.className = `mochi ${state}`;
});

pet.addEventListener("click", () => {
  if (dragging) return;
  pet.classList.remove("pat");
  void pet.offsetWidth;
  pet.classList.add("pat");
});

pet.addEventListener("dblclick", () => {
  if (!dragging) window.mochi.nap();
});

pet.addEventListener("mousedown", event => {
  if (event.button !== 0) return;
  dragging = true;
  dragOffset = { x: event.clientX, y: event.clientY };
  window.mochi.dragStart();
});

window.addEventListener("mousemove", event => {
  if (!dragging) return;
  window.mochi.dragMove(event.screenX, event.screenY);
});

window.addEventListener("mouseup", event => {
  if (event.button !== 0 || !dragging) return;
  dragging = false;
  window.mochi.dragEnd();
});

render();
restartAnimation();
