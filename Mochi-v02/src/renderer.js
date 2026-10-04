const pet = document.getElementById("pet");
const mochi = document.getElementById("mochi");

const idleFrames = [
  "./assets/idle-1.png",
  "./assets/idle-2.png",
  "./assets/idle-3.png",
  "./assets/idle-4.png"
];
const walkFrames = [
  "./assets/walk-1.png",
  "./assets/walk-2.png",
  "./assets/walk-3.png",
  "./assets/walk-4.png"
];

let direction = 1;
let walking = true;
let frame = 0;
let timer = null;

function renderFrame() {
  const frames = walking ? walkFrames : idleFrames;
  mochi.src = frames[frame % frames.length];
  mochi.classList.toggle("flip", direction < 0);
  frame += 1;
}

function startAnimation() {
  clearInterval(timer);
  timer = setInterval(renderFrame, walking ? 145 : 650);
}

window.mochi?.onDirection((nextDirection) => {
  direction = nextDirection;
  walking = true;
  startAnimation();
});

pet.addEventListener("mouseenter", () => {
  walking = false;
  frame = 0;
  startAnimation();
});

pet.addEventListener("mouseleave", () => {
  walking = true;
  frame = 0;
  startAnimation();
});

renderFrame();
startAnimation();
