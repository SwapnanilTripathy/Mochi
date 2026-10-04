const pet = document.getElementById("mochi");
const sprite = document.getElementById("sprite");
const rigRoot = document.getElementById("rig");
const rig = new MochiRig(rigRoot);
let rigReady = true;
let state = "idle";
let direction = 1;
let dragging = false;
let lastPat = 0;
let settings = { sounds: true };
let musicTimer = null;

rigRoot.addEventListener("rig-error", () => {
  if (!rigReady) return;
  rigReady = false;
  rigRoot.style.display = "none";
  sprite.classList.remove("rig-fallback");
  sprite.src = "./assets/idle/idle-1.png";
});

function render() {
  rig.setState(state);
  rig.setDirection(direction);
  pet.className = `mochi ${state}`;
}

function setState(next) {
  const allowed = ["idle", "walk", "sleep", "stretch", "drag", "edge", "curious"];
  state = allowed.includes(next) ? next : "idle";
  render();
  if (musicTimer) { clearInterval(musicTimer); musicTimer = null; }
  if (state === "walk" || state === "curious") {
    musicTimer = setInterval(() => { if (document.visibilityState !== "hidden") burst("♪"); }, 2400);
  }
}

function tinySound(kind) {
  if (!settings.sounds) return;
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx(), osc = ctx.createOscillator(), gain = ctx.createGain();
    osc.type = "sine"; osc.frequency.value = kind === "treat" ? 740 : 560;
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.035, ctx.currentTime + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.13);
    osc.connect(gain).connect(ctx.destination); osc.start(); osc.stop(ctx.currentTime + 0.14);
    osc.addEventListener("ended", () => ctx.close());
  } catch {}
}

function burst(symbol, count = 1) {
  for (let i = 0; i < count; i++) {
    const node = document.createElement("span");
    node.className = symbol === "♪" ? "note" : "heart";
    node.textContent = symbol;
    node.style.left = `${28 + Math.random() * 30}px`;
    node.style.top = `${14 + Math.random() * 18}px`;
    node.style.setProperty("--dx", `${(Math.random() - .5) * 20}px`);
    pet.appendChild(node);
    setTimeout(() => node.remove(), symbol === "♪" ? 1100 : 900);
  }
}

window.mochi.onState(setState);
window.mochi.onDirection(d => { direction = d < 0 ? -1 : 1; rig.setDirection(direction); });
window.mochi.onPat(() => burst("♥"));
window.mochi.onTreat(() => { burst("♥", 2); tinySound("treat"); pet.classList.remove("treat"); void pet.offsetWidth; pet.classList.add("treat"); });
window.mochi.onSettings(data => { if (data?.settings) settings = data.settings; });

sprite.onerror = () => console.error("Mochi fallback sprite failed to load:", sprite.src);

pet.addEventListener("mouseenter", () => { if (state === "idle") pet.classList.add("look"); });
pet.addEventListener("mouseleave", () => pet.classList.remove("look"));

pet.addEventListener("click", () => {
  if (dragging || Date.now() - lastPat < 250) return;
  lastPat = Date.now();
  pet.classList.remove("pat");
  void pet.offsetWidth;
  pet.classList.add("pat");
  rig.pat();
  window.mochi.pat();
  tinySound("pat");
});

pet.addEventListener("dblclick", () => { if (!dragging) window.mochi.nap(); });

pet.addEventListener("mousedown", event => {
  if (event.button !== 0) return;
  dragging = true;
  window.mochi.dragStart();
});

window.addEventListener("mousemove", event => {
  if (dragging) window.mochi.dragMove(event.screenX, event.screenY);
});

window.addEventListener("mouseup", event => {
  if (event.button !== 0 || !dragging) return;
  dragging = false;
  window.mochi.dragEnd();
});

render();
