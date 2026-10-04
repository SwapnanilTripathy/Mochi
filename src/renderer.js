const pet = document.getElementById("mochi");
const sprite = document.getElementById("sprite");

const frames = {
  idle: [1,2,3,4].map(i => `./assets/idle/idle-${i}.png`),
  walk: [1,2,3,4].map(i => `./assets/walk/walk-${i}.png`)
};

let state = "idle";
let direction = 1;
let frame = 0;
let timer;

function render() {
  const list = frames[state] || frames.idle;
  sprite.src = list[frame % list.length];
  sprite.style.transform = direction < 0 ? "scaleX(-1)" : "scaleX(1)";
  pet.className = `mochi ${state}`;
}

function setState(next) {
  state = next === "walk" ? "walk" : "idle";
  frame = 0;
  render();
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

render();

clearInterval(timer);
timer = setInterval(() => {
  frame = (frame + 1) % (frames[state] || frames.idle).length;
  render();
}, state === "walk" ? 110 : 240);

pet.addEventListener("mouseenter", () => {
  if (state === "idle") pet.className = "mochi look";
});
pet.addEventListener("mouseleave", () => {
  pet.className = `mochi ${state}`;
});
