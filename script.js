const scenes = Object.fromEntries(
  [...document.querySelectorAll(".scene")].map((scene) => [scene.id.replace("-scene", ""), scene])
);
const heartButton = document.querySelector("#heart-button");
const heartOrigin = document.querySelector("#heart-origin");
const cardButton = document.querySelector("#card-button");
const envelopeButton = document.querySelector("#envelope-button");
const envelopeSeal = document.querySelector(".envelope-seal");
const letterHeading = document.querySelector("#letter-heading");
const restartButton = document.querySelector("#restart-button");
const shower = document.querySelector("#flower-shower");
const motionPreference = window.matchMedia("(prefers-reduced-motion: reduce)");

const flowerNames = ["pink", "blue", "gold", "ruby", "blossoms", "white"];
const flowerThumbnails = flowerNames.map((name) => {
  const image = new Image();
  image.alt = "";
  image.src = `assets/${name}-petal.webp`;
  return image;
});
const petalColors = ["#f6abbc", "#c95d82", "#f9dae2", "#f6cb8e", "#8aabd0"];
const bouquetFlowers = [
  ["ruby", 0, 4, 46, -18],
  ["blue", 35, 2, 43, 34],
  ["white", 68, 3, 45, -20],
  ["pink", 99, 4, 44, 18],
  ["gold", 1, 37, 42, 23],
  ["blossoms", 28, 30, 42, -26],
  ["ruby", 72, 33, 49, 26],
  ["blue", 99, 40, 44, -34],
  ["blue", 0, 67, 46, 20],
  ["white", 27, 66, 48, 22],
  ["blossoms", 73, 63, 46, -12],
  ["gold", 100, 71, 42, 24],
  ["pink", 0, 97, 45, -9],
  ["ruby", 32, 99, 48, 23],
  ["gold", 67, 98, 47, -18],
  ["white", 100, 98, 44, 15],
  ["pink", 50, 47, 57, -14],
];

let currentScene = "heart";
let transitioning = false;
let flowerCleanup;

function wait(milliseconds) {
  return new Promise((resolve) => window.setTimeout(resolve, milliseconds));
}

function showScene(next, focusTarget) {
  const previous = scenes[currentScene];
  previous.hidden = true;
  previous.classList.remove("is-entering", "is-leaving");
  const target = scenes[next];
  target.hidden = false;
  target.classList.add("is-entering");
  currentScene = next;
  document.body.dataset.scene = next;
  window.scrollTo(0, 0);
  focusTarget.focus({ preventScroll: true });
}

function randomBetween(min, max) {
  return min + Math.random() * (max - min);
}

function makeFlower(index, size) {
  const particle = flowerThumbnails[index % flowerThumbnails.length].cloneNode();
  particle.className = "shower-flower";
  particle.style.width = `${size}px`;
  particle.style.height = `${size}px`;
  return particle;
}

function makePetal(index, size) {
  const particle = document.createElement("span");
  particle.className = "shower-petal";
  particle.style.width = `${size * .72}px`;
  particle.style.height = `${size}px`;
  particle.style.background = petalColors[index % petalColors.length];
  return particle;
}

function scatterFlowers(origin) {
  const { width, height } = shower.getBoundingClientRect();
  const x = origin.left + origin.width / 2;
  const y = origin.top + origin.height / 2;
  const mobile = width < 650;
  const reduced = motionPreference.matches;
  const columns = reduced ? 5 : mobile ? 9 : 14;
  const rows = reduced ? 4 : mobile ? 10 : 8;
  const fragment = document.createDocumentFragment();

  clearTimeout(flowerCleanup);

  // Aim at a different patch of the screen for each particle so the burst
  // reaches the corners and fills the middle as the flowers drift down.
  for (let index = 0; index < columns * rows; index += 1) {
    const left = (index % columns + randomBetween(.15, .85)) * width / columns;
    const top = (Math.floor(index / columns) + randomBetween(.15, .85)) * height / rows;
    const isPetal = !reduced && index % 4 === 0;
    const size = isPetal ? randomBetween(10, 24) : randomBetween(29, mobile ? 75 : 98);
    const particle = isPetal ? makePetal(index, size) : makeFlower(index, size);
    fragment.append(particle);
    if (reduced) {
      particle.style.left = `${left - size / 2}px`;
      particle.style.top = `${top - size / 2}px`;
      particle.style.opacity = ".6";
      continue;
    }

    const across = left - x;
    const vertical = top - y;
    const loft = randomBetween(26, 82);
    const drift = randomBetween(-42, 42);
    const rotation = randomBetween(-220, 220);
    particle.style.left = `${x - size / 2}px`;
    particle.style.top = `${y - size / 2}px`;
    particle.animate([
      { transform: "translate(0, 0) rotate(0deg) scale(.16)", opacity: 0, offset: 0 },
      { transform: `translate(${across * .63}px, ${vertical * .63 - loft}px) rotate(${rotation * .44}deg) scale(.83)`, opacity: 1, offset: .16, easing: "ease-out" },
      { transform: `translate(${across}px, ${vertical}px) rotate(${rotation}deg) scale(1)`, opacity: 1, offset: .4 },
      { transform: `translate(${across + drift * .6}px, ${vertical + 33}px) rotate(${rotation + drift}deg) scale(.98)`, opacity: .92, offset: .7 },
      { transform: `translate(${across + drift}px, ${vertical + 135}px) rotate(${rotation + drift * 2}deg) scale(.87)`, opacity: 0, offset: 1 },
    ], { duration: randomBetween(2200, 3300), delay: randomBetween(0, 160), fill: "both" });
  }

  if (!reduced) {
    for (let index = 0; index < columns * 6; index += 1) {
      const isPetal = index % 3 === 0;
      const size = isPetal ? randomBetween(8, 19) : randomBetween(25, mobile ? 62 : 81);
      const particle = isPetal ? makePetal(index, size) : makeFlower(index + Math.floor(index / 6), size);
      const left = (index % columns + randomBetween(.16, .84)) * width / columns;
      const drift = randomBetween(-66, 66);
      const rotation = randomBetween(-310, 310);
      const distance = height + size * 2;
      const delay = 580 + Math.floor(index / columns) * 185 + randomBetween(0, 225);
      particle.style.left = `${left - size / 2}px`;
      particle.style.top = `${-size}px`;
      fragment.append(particle);
      particle.animate([
        { transform: "translate(0, 0) rotate(0deg)", opacity: 0, offset: 0 },
        { transform: `translate(${drift * .4}px, ${distance * .16}px) rotate(${rotation * .21}deg)`, opacity: .94, offset: .16 },
        { transform: `translate(${-drift * .27}px, ${distance * .63}px) rotate(${rotation * .66}deg)`, opacity: .9, offset: .63 },
        { transform: `translate(${drift}px, ${distance}px) rotate(${rotation}deg)`, opacity: 0, offset: 1 },
      ], { duration: randomBetween(2550, 3450), delay, fill: "both" });
    }
  }

  shower.replaceChildren(fragment);
  flowerCleanup = window.setTimeout(() => shower.replaceChildren(), reduced ? 750 : 5250);
}

async function revealLetterWithFlowers(origin) {
  const bloom = document.createElement("div");
  bloom.className = "flower-bloom";
  const bouquet = document.createElement("div");
  bouquet.className = "bloom-bouquet";
  bouquet.style.transformOrigin = `${origin.left + origin.width / 2}px ${origin.top + origin.height / 2}px`;

  for (const [name, x, y, size, rotation] of bouquetFlowers) {
    const flower = new Image();
    flower.src = `assets/${name}.webp`;
    flower.alt = "";
    flower.style.left = `${x}%`;
    flower.style.top = `${y}%`;
    flower.style.width = `${size}vmax`;
    flower.style.transform = `translate(-50%, -50%) rotate(${rotation}deg)`;
    bouquet.append(flower);
  }

  clearTimeout(flowerCleanup);
  bloom.append(bouquet);
  shower.replaceChildren(bloom);

  const bloomDuration = 1240;
  bloom.animate([
    { backgroundColor: "transparent", offset: 0 },
    { backgroundColor: "transparent", offset: .46 },
    { backgroundColor: "#f6d7e2", offset: 1 },
  ], { duration: bloomDuration, fill: "forwards" });
  const opening = bouquet.animate([
    { transform: "rotate(-154deg) scale(.035)", offset: 0 },
    { transform: "rotate(-66deg) scale(.43)", offset: .51, easing: "cubic-bezier(.16,.68,.3,1)" },
    { transform: "rotate(0deg) scale(1)", offset: 1 },
  ], { duration: bloomDuration, fill: "forwards" });
  await opening.finished;

  showScene("letter", letterHeading);
  const revealDuration = 1680;
  bouquet.animate([
    { transform: "translateY(0) rotate(0deg) scale(1)", offset: 0 },
    { transform: "translateY(6vh) rotate(12deg) scale(.97)", offset: .3 },
    { transform: "translateY(65vh) rotate(37deg) scale(.58)", offset: 1 },
  ], { duration: revealDuration, easing: "ease-in", fill: "forwards" });
  const closing = bloom.animate([
    { opacity: 1, offset: 0 },
    { opacity: 1, offset: .17 },
    { opacity: .5, offset: .65 },
    { opacity: 0, offset: 1 },
  ], { duration: revealDuration, easing: "ease-in-out", fill: "forwards" });
  await closing.finished;
  bloom.remove();
}

heartButton.addEventListener("click", async () => {
  if (transitioning) return;
  transitioning = true;
  heartButton.setAttribute("aria-disabled", "true");
  heartButton.classList.add("is-bursting");
  scatterFlowers(heartOrigin.getBoundingClientRect());
  if (!motionPreference.matches) {
    await wait(540);
    scenes.heart.classList.add("is-leaving");
    await wait(410);
  }
  showScene("card", cardButton);
  transitioning = false;
});

cardButton.addEventListener("click", () => {
  if (transitioning) return;
  showScene("envelope", envelopeButton);
});

envelopeButton.addEventListener("click", async () => {
  if (transitioning) return;
  transitioning = true;
  const origin = envelopeSeal.getBoundingClientRect();
  envelopeButton.setAttribute("aria-disabled", "true");
  envelopeButton.classList.add("is-open");
  if (motionPreference.matches) {
    showScene("letter", letterHeading);
    scatterFlowers(origin);
  } else {
    await wait(290);
    await revealLetterWithFlowers(origin);
  }
  transitioning = false;
});

restartButton.addEventListener("click", () => {
  if (transitioning) return;
  clearTimeout(flowerCleanup);
  shower.replaceChildren();
  heartButton.classList.remove("is-bursting");
  heartButton.removeAttribute("aria-disabled");
  envelopeButton.classList.remove("is-open");
  envelopeButton.removeAttribute("aria-disabled");
  showScene("heart", heartButton);
});
