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

function render() {
  const list = frames[state] || frames.idle;
  sprite.src = list[frame % list.length];
  sprite.style.transform = direction < 0 ? "scaleX(-1)" : "scaleX(1)";
  pet.className = `mochi ${state}`;
}

function setState(next) {
  state = ["idle", "walk", "sleep", "stretch"].includes(next) ? next : "idle";
  frame = 0;
  render();
  restartAnimation();
}

function restartAnimation() {
  clearInterval(timer);
  const speed = state === "walk" ? 110 : state === "idle" ? 240 : 320;
  timer = setInterval(() => {
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
  pet.classList.remove("pat");
  void pet.offsetWidth;
  pet.classList.add("pat");
});

pet.addEventListener("dblclick", () => {
  window.mochi.nap();
});

render();
restartAnimation();
