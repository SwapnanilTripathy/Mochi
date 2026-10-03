const pet = document.getElementById("pet");

window.mochi?.onDirection((direction) => {
  pet.classList.toggle("walk-left", direction < 0);
  pet.classList.toggle("walk-right", direction >= 0);
});

pet.addEventListener("mouseenter", () => {
  pet.style.animationDuration = "1.2s";
});

pet.addEventListener("mouseleave", () => {
  pet.style.animationDuration = "2.4s";
});
