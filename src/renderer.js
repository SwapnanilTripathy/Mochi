const pet = document.getElementById("mochi");
const sprite = document.getElementById("sprite");
const rigRoot = document.getElementById("rig");

const ANIMATION_ROOT = "./assets/animations";
const FALLBACK_SPRITE = "./assets/idle/idle-1.png";

let state = "idle";
let direction = 1;
let dragging = false;
let lastPat = 0;
let settings = { sounds: true, personality: "playful" };
let musicTimer = null;
let manifest = null;
let currentAnimation = null;
let animationToken = 0;
let currentFrame = 0;
let frameTimer = null;
let idleTimer = null;
const preloaded = new Map();

if (rigRoot) rigRoot.style.display = "none";

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

function tinySound(kind) {
  if (!settings.sounds) return;
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = kind === "treat" ? 740 : 560;
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.035, ctx.currentTime + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.13);
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.14);
    osc.addEventListener("ended", () => ctx.close());
  } catch {}
}

function preload(url) {
  if (preloaded.has(url)) return preloaded.get(url);
  const img = new Image();
  img.src = url;
  preloaded.set(url, img);
  return img;
}

function animationEntries(category) {
  if (!manifest?.animations) return [];
  return Object.entries(manifest.animations).filter(([, a]) => a.category === category);
}

function chooseAnimation(category, preferred = []) {
  const all = manifest?.animations || {};
  for (const key of preferred) if (all[key]) return all[key];
  const entries = animationEntries(category);
  if (!entries.length) return null;

  const personality = settings.personality || "playful";
  const weighted = entries.map(([, anim]) => [
    anim,
    Math.max(0.05, Number(anim.personality?.[personality] ?? 1)) *
    Math.max(0.05, Number(anim.recommended_probability ?? 1))
  ]);
  const total = weighted.reduce((sum, [, weight]) => sum + weight, 0);
  let pick = Math.random() * total;
  for (const [anim, weight] of weighted) {
    pick -= weight;
    if (pick <= 0) return anim;
  }
  return weighted[0]?.[0] || null;
}

function resolveAnimation(nextState) {
  if (!manifest?.animations) return null;

  if (nextState === "walk") {
    const personality = settings.personality || "playful";
    if (personality === "calm" && Math.random() < 0.55) {
      return manifest.animations.walk_slow || manifest.animations.walk_normal;
    }
    if (personality === "playful") {
      const roll = Math.random();
      if (roll < 0.20) return manifest.animations.walk_excited || manifest.animations.walk_normal;
      if (roll < 0.35) return manifest.animations.walk_fast || manifest.animations.walk_normal;
    }
    return manifest.animations.walk_normal;
  }

  if (nextState === "idle") return chooseAnimation("idle");
  if (nextState === "sleep") return manifest.animations.sleep_a_breathe || chooseAnimation("sleep") || chooseAnimation("idle");
  if (nextState === "fall_asleep") return manifest.animations.fall_asleep || manifest.animations.sleep_a_breathe || chooseAnimation("sleep");
  if (nextState === "wake") return manifest.animations.wake || manifest.animations.stretch || chooseAnimation("stretch") || chooseAnimation("idle");
  if (nextState === "pat") return manifest.animations.pat || chooseAnimation("happy");
  if (nextState === "treat") return manifest.animations.treat || chooseAnimation("happy");
  if (nextState === "play") return manifest.animations.jump || manifest.animations.happy_a_bounce || chooseAnimation("happy");
  if (nextState === "stretch") return manifest.animations.stretch || chooseAnimation("stretch");
  if (nextState === "drag") return manifest.animations.drag_sway || chooseAnimation("drag");
  if (nextState === "edge") return manifest.animations.edge_sit_breathe || chooseAnimation("edge");
  if (nextState === "play") return manifest.animations.jump || manifest.animations.happy_a_bounce || chooseAnimation("happy");
  if (nextState === "curious") {
    return manifest.animations.cursor_nearby ||
      manifest.animations.sit_look_tilt ||
      manifest.animations.misc_question ||
      chooseAnimation("cursor") ||
      chooseAnimation("look") ||
      chooseAnimation("expression");
  }
  return chooseAnimation(nextState) || chooseAnimation("idle");
}

function applyDirection(anim) {
  if (!anim) return;
  if (anim.direction !== "horizontal") {
    sprite.style.transform = "scaleX(1)";
    return;
  }
  const facing = anim.facing || "right";
  const mirror = (facing === "right" && direction < 0) || (facing === "left" && direction > 0);
  sprite.style.transform = mirror ? "scaleX(-1)" : "scaleX(1)";
}

function stopAnimation() {
  animationToken++;
  clearTimeout(frameTimer);
  frameTimer = null;
}

function playAnimation(anim, token = animationToken) {
  if (!anim || !anim.frames?.length || token !== animationToken) return;

  currentAnimation = anim;
  const fps = Math.max(1, Number(anim.fps) || 10);
  const delay = 1000 / fps;
  const frame = anim.frames[currentFrame];

  if (frame) {
    const url = `${ANIMATION_ROOT}/${anim.folder}/${frame}`;
    preload(url);
    sprite.src = url;
    applyDirection(anim);
  }

  currentFrame++;
  if (currentFrame >= anim.frames.length) {
    if (anim.loop) currentFrame = 0;
    else {
      currentFrame = anim.frames.length - 1;
      return;
    }
  }

  frameTimer = setTimeout(() => playAnimation(anim, token), delay);
}

function playState(nextState, force = false) {
  const anim = resolveAnimation(nextState);
  if (!anim) {
    sprite.src = FALLBACK_SPRITE;
    return;
  }
  const same = currentAnimation?.frames?.[0] === anim.frames?.[0] &&
    currentAnimation?.folder === anim.folder;
  if (!force && same) return;

  stopAnimation();
  currentFrame = 0;
  playAnimation(anim, animationToken);
}

function setState(next) {
  const allowed = ["idle", "walk", "sleep", "fall_asleep", "wake", "pat", "treat", "play", "stretch", "drag", "drag_release", "edge", "curious", "sit", "stand", "happy", "sad", "annoyed", "surprise", "jump", "climb"];
  state = allowed.includes(next) ? next : "idle";
  pet.className = `mochi ${state}`;
  playState(state);

  if (musicTimer) clearInterval(musicTimer);
  musicTimer = null;
  if (state === "walk" || state === "curious") {
    musicTimer = setInterval(() => {
      if (document.visibilityState !== "hidden") burst("♪");
    }, 2400);
  }
}

function randomIdleBehavior() {
  if (state !== "idle" || document.visibilityState === "hidden") return;
  const roll = Math.random();
  if (roll < 0.13) {
    setState("sit");
    setTimeout(() => { if (state === "sit") setState("idle"); }, 2500 + Math.random() * 2500);
  } else if (roll < 0.23) {
    setState("stretch");
    setTimeout(() => { if (state === "stretch") setState("idle"); }, 1700 + Math.random() * 900);
  } else if (roll < 0.31) {
    setState("happy");
    burst("♥");
    setTimeout(() => { if (state === "happy") setState("idle"); }, 900);
  } else if (roll < 0.38) {
    setState("curious");
    setTimeout(() => { if (state === "curious") setState("idle"); }, 1100 + Math.random() * 1000);
  } else {
    playState("idle", true);
  }
}

function scheduleIdleVariation() {
  clearTimeout(idleTimer);
  idleTimer = setTimeout(() => {
    randomIdleBehavior();
    scheduleIdleVariation();
  }, 5000 + Math.random() * 9000);
}

window.mochi.onState(setState);

window.mochi.onDirection(d => {
  direction = d < 0 ? -1 : 1;
  applyDirection(currentAnimation);
});

window.mochi.onPat(() => {
  burst("♥");
  const patAnim = manifest?.animations?.pat;
  if (patAnim) {
    stopAnimation();
    currentFrame = 0;
    playAnimation(patAnim, animationToken);
    setTimeout(() => { if (state !== "sleep" && !dragging) setState(state); }, 900);
  }
});

window.mochi.onNeeds(data => {
  if (!data) return;
  pet.dataset.energy = data.energy;
  pet.dataset.hunger = data.hunger;
  pet.dataset.happiness = data.happiness;
  pet.dataset.boredom = data.boredom;
});

window.mochi.onTreat(() => {
  burst("♥", 2);
  tinySound("treat");
  const treatAnim = manifest?.animations?.treat || chooseAnimation("treat");
  if (treatAnim) {
    stopAnimation();
    currentFrame = 0;
    playAnimation(treatAnim, animationToken);
    setTimeout(() => { if (!dragging && state !== "sleep") setState("curious"); }, 1200);
  }
});

window.mochi.onSettings(data => {
  if (data?.settings) settings = { ...settings, ...data.settings };
});

sprite.onerror = () => {
  sprite.onerror = null;
  sprite.src = FALLBACK_SPRITE;
};

pet.addEventListener("mouseenter", () => {
  if (state === "idle") {
    const look = manifest?.animations?.cursor_look || manifest?.animations?.sit_look_tilt;
    if (look) {
      stopAnimation();
      currentFrame = 0;
      playAnimation(look, animationToken);
    }
  }
});

pet.addEventListener("mouseleave", () => {
  if (state === "idle") playState("idle", true);
});

pet.addEventListener("click", () => {
  if (dragging || Date.now() - lastPat < 250) return;
  lastPat = Date.now();
  pet.classList.remove("pat");
  void pet.offsetWidth;
  pet.classList.add("pat");
  window.mochi.pat();
  tinySound("pat");
});

pet.addEventListener("dblclick", () => {
  if (!dragging) window.mochi.nap();
});

pet.addEventListener("mousedown", event => {
  if (event.button !== 0) return;
  dragging = true;
  setState("drag");
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

window.addEventListener("blur", () => {
  if (!dragging) return;
  dragging = false;
  window.mochi.dragEnd();
});

async function initAnimationLibrary() {
  try {
    const response = await fetch(`${ANIMATION_ROOT}/manifest.json`, { cache: "no-store" });
    if (!response.ok) throw new Error(`manifest HTTP ${response.status}`);
    manifest = await response.json();

    const idle = manifest.animations?.idle_a_breathe;
    if (idle) {
      for (const frame of idle.frames) preload(`${ANIMATION_ROOT}/${idle.folder}/${frame}`);
    }

    playState(state, true);
    scheduleIdleVariation();
  } catch (error) {
    console.error("Mochi animation library failed to load:", error);
    sprite.src = FALLBACK_SPRITE;
  }
}

initAnimationLibrary();
