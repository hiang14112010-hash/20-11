const scenes = Object.fromEntries(
  [...document.querySelectorAll(".scene")].map((scene) => [scene.id.replace("-scene", ""), scene])
);
const heartButton = document.querySelector("#heart-button");
const heartOrigin = document.querySelector("#heart-origin");
const cardButton = document.querySelector("#card-button");
const envelopeButton = document.querySelector("#envelope-button");
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

function scatterFlowers() {
  const center = heartOrigin.getBoundingClientRect();
  const x = center.left + center.width / 2;
  const y = center.top + center.height / 2;
  const mobile = window.innerWidth < 650;
  const reduced = motionPreference.matches;
  const flowerCount = reduced ? 18 : mobile ? 92 : 116;
  const petalCount = reduced ? 0 : mobile ? 33 : 46;
  const total = flowerCount + petalCount;
  const fragment = document.createDocumentFragment();
  const animations = [];

  clearTimeout(flowerCleanup);
  shower.replaceChildren();

  for (let index = 0; index < total; index += 1) {
    const isFlower = index < flowerCount;
    const size = isFlower ? randomBetween(22, mobile ? 66 : 91) : randomBetween(7, 19);
    const particle = isFlower ? makeFlower(index, size) : makePetal(index, size);
    const angle = (index / total) * 2 * Math.PI + randomBetween(-.3, .3);
    const horizontal = Math.cos(angle);
    const vertical = Math.sin(angle);

    if (reduced) {
      const radius = Math.min(window.innerWidth, window.innerHeight) * randomBetween(.18, .38);
      particle.style.left = `${x + horizontal * radius - size / 2}px`;
      particle.style.top = `${y + vertical * radius - size / 2}px`;
      particle.style.opacity = "0.8";
      fragment.append(particle);
      continue;
    }

    const spread = randomBetween(.32, .91);
    const across = horizontal * window.innerWidth * spread;
    const up = vertical * window.innerHeight * spread;
    const sway = randomBetween(-84, 84);
    const drop = randomBetween(80, 470);
    const rotation = randomBetween(-460, 460);
    const delay = index % 5 === 0 ? randomBetween(290, 520) : randomBetween(0, 250);
    const duration = randomBetween(1450, 2950);
    particle.style.left = `${x - size / 2}px`;
    particle.style.top = `${y - size / 2}px`;
    fragment.append(particle);
    animations.push({ particle, across, up, sway, drop, rotation, delay, duration });
  }

  shower.append(fragment);
  for (const { particle, across, up, sway, drop, rotation, delay, duration } of animations) {
    particle.animate([
      { transform: "translate(0, 0) rotate(0deg) scale(.18)", opacity: 0, offset: 0 },
      { transform: `translate(${across * .28}px, ${up * .28}px) rotate(${rotation * .21}deg) scale(1.04)`, opacity: 1, offset: .16 },
      { transform: `translate(${across * .75}px, ${up * .74 - 20}px) rotate(${rotation * .64}deg) scale(.98)`, opacity: .95, offset: .48 },
      { transform: `translate(${across + sway}px, ${up + drop}px) rotate(${rotation}deg) scale(.83)`, opacity: 0, offset: 1 },
    ], { duration, delay, fill: "both", easing: "cubic-bezier(.15,.61,.3,1)" });
  }
  flowerCleanup = window.setTimeout(() => shower.replaceChildren(), reduced ? 470 : 3500);
}

heartButton.addEventListener("click", async () => {
  if (transitioning) return;
  transitioning = true;
  heartButton.setAttribute("aria-disabled", "true");
  heartButton.classList.add("is-bursting");
  scatterFlowers();
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
  envelopeButton.setAttribute("aria-disabled", "true");
  envelopeButton.classList.add("is-open");
  if (!motionPreference.matches) {
    await wait(820);
    scenes.envelope.classList.add("is-leaving");
    await wait(410);
  }
  showScene("letter", letterHeading);
  transitioning = false;
});

restartButton.addEventListener("click", () => {
  clearTimeout(flowerCleanup);
  shower.replaceChildren();
  heartButton.classList.remove("is-bursting");
  heartButton.removeAttribute("aria-disabled");
  envelopeButton.classList.remove("is-open");
  envelopeButton.removeAttribute("aria-disabled");
  showScene("heart", heartButton);
});
