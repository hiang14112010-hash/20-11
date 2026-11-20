const scenes = Object.fromEntries(
  [...document.querySelectorAll(".scene")].map((scene) => [scene.id.replace("-scene", ""), scene])
);
const heartButton = document.querySelector("#heart-button");
const heartOrigin = document.querySelector("#heart-origin");
const bouquetRotator = document.querySelector("#bouquet-rotator");
const bouquetNote = document.querySelector("#bouquet-note");
const envelopeButton = document.querySelector("#envelope-button");
const letterHeading = document.querySelector("#letter-heading");
const restartButton = document.querySelector("#restart-button");
const shower = document.querySelector("#flower-shower");
const motionPreference = window.matchMedia("(prefers-reduced-motion: reduce)");

const bouquetViewer = import("./bouquet.js?v=3").then(({ mountBouquet }) => mountBouquet({
  display: document.querySelector("#bouquet-display"),
  rotator: bouquetRotator,
  canvas: document.querySelector("#bouquet-canvas"),
  noteButton: bouquetNote,
  hint: document.querySelector("#bouquet-callout"),
})).catch(() => {
  bouquetRotator.removeAttribute("tabindex");
  bouquetRotator.setAttribute("aria-hidden", "true");
  document.querySelector("#bouquet-hint").textContent = "Chạm phong bì để mở thư";
  return null;
});

const flowerNames = ["pink", "blue", "gold", "ruby", "blossoms", "white"];
const flowerImages = flowerNames.map((name) => {
  const image = new Image();
  image.alt = "";
  image.src = `assets/${name}.webp`;
  return image;
});

let currentScene = "heart";
let transitioning = false;

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

function scatterFlowers(origin, reduced) {
  const { width, height } = shower.getBoundingClientRect();
  const x = origin.left + origin.width / 2;
  const y = origin.top + origin.height / 2;
  const mobile = width < 650;
  const columns = reduced ? 5 : mobile ? 8 : 15;
  const rows = reduced ? 4 : mobile ? 13 : 10;
  const fragment = document.createDocumentFragment();
  const flights = [];

  // Give each flower its own destination and curve through the burst.
  for (let index = 0; index < columns * rows; index += 1) {
    const column = index % columns;
    const row = Math.floor(index / columns);
    const left = (column + randomBetween(.12, .88)) * width / columns;
    const top = (row + randomBetween(.12, .88)) * height / rows;
    const size = randomBetween(25, mobile ? 58 : 80);
    const flower = flowerImages[(column + 2 * row) % flowerImages.length].cloneNode();
    flower.className = "shower-flower";
    flower.style.width = `${size}px`;
    flower.style.height = `${size}px`;
    flower.style.zIndex = Math.round(randomBetween(0, 6));
    fragment.append(flower);

    if (reduced) {
      flower.style.left = `${left - size / 2}px`;
      flower.style.top = `${top - size / 2}px`;
      flower.style.opacity = ".6";
      continue;
    }

    const across = left - x;
    const down = top - y;
    const heading = Math.atan2(down, across);
    const dx = Math.cos(heading);
    const dy = Math.sin(heading);
    const edgeX = (dx > 0 ? width - x : x) / Math.max(Math.abs(dx), .001);
    const edgeY = (dy > 0 ? height - y : y) / Math.max(Math.abs(dy), .001);
    const exitDistance = Math.min(edgeX, edgeY) + 2.5 * size;
    const curve = randomBetween(-85, 85);
    const spin = randomBetween(150, 325) * (index % 2 ? 1 : -1);
    const zoom = randomBetween(1.75, 2.45);
    flower.style.left = `${x - size / 2}px`;
    flower.style.top = `${y - size / 2}px`;
    const flight = flower.animate([
      { transform: "translate(0, 0) rotate(0deg) scale(.05)", opacity: 0, offset: 0 },
      { transform: `translate(${across * .34 - dy * curve}px, ${down * .34 + dx * curve}px) rotate(${spin * .26}deg) scale(.55)`, opacity: .88, offset: .23, easing: "ease-out" },
      { transform: `translate(${across}px, ${down}px) rotate(${spin * .62}deg) scale(${zoom})`, opacity: 1, offset: .56, easing: "ease-in" },
      { transform: `translate(${dx * exitDistance}px, ${dy * exitDistance}px) rotate(${spin}deg) scale(${zoom * 1.32})`, opacity: 0, offset: 1 },
    ], { duration: randomBetween(2000, 2490), delay: randomBetween(0, 240), fill: "both" });
    flights.push(flight.finished);
  }

  shower.append(fragment);
  return reduced ? wait(420) : Promise.all(flights);
}

heartButton.addEventListener("click", async () => {
  if (transitioning) return;
  transitioning = true;
  heartButton.setAttribute("aria-disabled", "true");
  const origin = heartOrigin.getBoundingClientRect();
  const reduced = motionPreference.matches;
  heartButton.classList.add("is-bursting");
  const flowersFinished = scatterFlowers(origin, reduced);
  if (!reduced) {
    await wait(1150);
    scenes.heart.classList.add("is-leaving");
  }
  await flowersFinished;
  shower.replaceChildren();
  const viewer = await bouquetViewer;
  showScene("bouquet", viewer ? bouquetRotator : bouquetNote);
  viewer?.reset();
  transitioning = false;
});

bouquetNote.addEventListener("click", () => {
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
  if (transitioning) return;
  heartButton.classList.remove("is-bursting");
  heartButton.removeAttribute("aria-disabled");
  envelopeButton.classList.remove("is-open");
  envelopeButton.removeAttribute("aria-disabled");
  showScene("heart", heartButton);
});
