import * as THREE from "./vendor/three.module.min.js";
import { PLYLoader } from "./vendor/PLYLoader.js";

const modelHeight = 3.90;
const modelWidth = 2.60;
const modelCenter = .23;

const vertexShader = `
  uniform vec3 dimensions;
  uniform vec2 referenceAxis;
  varying vec2 surfaceUV;
  varying vec2 referenceUV;

  void main() {
    surfaceUV = uv;
    referenceUV = vec2(
      0.5 + dot(position.xz, referenceAxis) / dimensions.x,
      0.5 + (position.y - dimensions.z) / dimensions.y
    );
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const fragmentShader = `
  uniform sampler2D surfacePhoto;
  uniform sampler2D referencePhoto;
  uniform float referenceDetail;
  varying vec2 surfaceUV;
  varying vec2 referenceUV;

  void main() {
    vec3 color = texture2D(surfacePhoto, surfaceUV).rgb;
    vec4 original = texture2D(referencePhoto, referenceUV);
    float detail = referenceDetail * smoothstep(0.20, 0.94, original.a);
    gl_FragColor = vec4(mix(color, original.rgb, detail), 1.0);
    #include <colorspace_fragment>
  }
`;

async function loadBouquet() {
  const loader = new THREE.TextureLoader();
  const angles = ["", "-315", "-left", "-225", "-back", "-135", "-right", "-45"];
  const [geometry, surfacePhoto, references] = await Promise.all([
    new PLYLoader().loadAsync("assets/lily-bouquet.ply?v=2"),
    loader.loadAsync("assets/lily-bouquet-texture.webp?v=1"),
    Promise.all(angles.map((suffix) => loader.loadAsync("assets/lily-bouquet" + suffix + ".webp"))),
  ]);
  geometry.computeBoundingSphere();
  for (const texture of [surfacePhoto, ...references]) {
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 4;
  }

  const referenceDetail = { value: 1 };
  const referencePhoto = { value: references[0] };
  const referenceAxis = new THREE.Vector2(1, 0);
  const material = new THREE.ShaderMaterial({
    vertexShader,
    fragmentShader,
    toneMapped: false,
    uniforms: {
      surfacePhoto: { value: surfacePhoto },
      referencePhoto,
      referenceAxis: { value: referenceAxis },
      referenceDetail,
      dimensions: { value: new THREE.Vector3(modelWidth, modelHeight, modelCenter) },
    },
  });
  function updateReference(angle) {
    const sector = Math.round(angle / 45);
    const anchor = sector * Math.PI / 4;
    referencePhoto.value = references[sector % references.length];
    referenceAxis.set(Math.cos(anchor), Math.sin(anchor));
    // Fade fully into the fixed texture before switching reference cameras.
    const offset = Math.abs(angle - sector * 45);
    referenceDetail.value = 1 - THREE.MathUtils.smoothstep(offset, 4, 22.5);
  }
  return { flowers: new THREE.Mesh(geometry, material), updateReference };
}

function createNote() {
  const note = new THREE.Group();
  note.position.set(.09, .66, .855);
  note.rotation.set(.36, -.10, -.18);

  const paper = new THREE.MeshStandardMaterial({ color: "#fdf0d6", roughness: .9 });
  note.add(new THREE.Mesh(new THREE.BoxGeometry(.72, .45, .026), paper));

  const flap = new THREE.Shape();
  flap.moveTo(-.358, .223);
  flap.lineTo(.358, .223);
  flap.lineTo(0, -.059);
  flap.closePath();
  const fold = new THREE.Mesh(
    new THREE.ShapeGeometry(flap),
    new THREE.MeshStandardMaterial({ color: "#ecc1cb", roughness: .9 }),
  );
  fold.position.z = .015;
  note.add(fold);

  const seal = new THREE.Mesh(
    new THREE.CylinderGeometry(.061, .061, .012, 24),
    new THREE.MeshStandardMaterial({ color: "#963151", roughness: .72 }),
  );
  seal.position.set(0, -.050, .023);
  seal.rotation.x = Math.PI / 2;
  note.add(seal);
  return note;
}

export async function mountBouquet({ display, rotator, canvas, noteButton, hint }) {
  const renderer = new THREE.WebGLRenderer({
    canvas, alpha: true, antialias: true, powerPreference: "low-power",
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.12;

  let model;
  try {
    model = await loadBouquet();
  } catch (error) {
    renderer.dispose();
    throw error;
  }
  const { flowers, updateReference } = model;
  const note = createNote();
  const bouquet = new THREE.Group();
  bouquet.add(flowers, note);

  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-2.30, 2.30, 2.30, -2.30, .1, 26);
  camera.position.set(0, modelCenter, 8);
  camera.lookAt(0, modelCenter, 0);
  scene.add(new THREE.HemisphereLight("#fff3eb", "#b68572", 2.1));
  const key = new THREE.DirectionalLight("#fff4e8", 2.7);
  key.position.set(-3, 4, 5);
  scene.add(key);
  const fill = new THREE.DirectionalLight("#ffe3ec", 1.7);
  fill.position.set(4, 2, -4);
  scene.add(fill);

  scene.add(bouquet);
  const ray = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  const renderSize = new THREE.Vector2();
  let angle = 0;
  let drag;
  let pendingNoteClick = false;
  let dismissed = false;
  let frame;

  function hitNote(x, y) {
    ray.setFromCamera(pointer.set(x, y), camera);
    const envelopeHit = ray.intersectObject(note, true)[0];
    if (!envelopeHit) return false;
    const flowerHit = ray.intersectObject(flowers)[0];
    return !flowerHit || flowerHit.distance > envelopeHit.distance;
  }

  function draw() {
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    if (!width || !height) return;
    renderer.getSize(renderSize);
    if (renderSize.x !== width || renderSize.y !== height) renderer.setSize(width, height, false);

    const turn = THREE.MathUtils.degToRad(angle);
    bouquet.rotation.y = turn;
    updateReference(angle);
    renderer.render(scene, camera);

    const center = note.localToWorld(new THREE.Vector3(0, .037, .024)).project(camera);
    const visible = hitNote(center.x, center.y);
    noteButton.hidden = !visible;
    hint.hidden = !visible || dismissed;
    if (visible) {
      const left = (center.x / 2 + .5) * 100;
      const top = (.5 - center.y / 2) * 100;
      noteButton.style.left = hint.style.left = left + "%";
      noteButton.style.top = hint.style.top = top + "%";
    }
  }

  function queueDraw() {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(draw);
  }

  function turn(next) {
    angle = (next % 360 + 360) % 360;
    rotator.setAttribute("aria-valuenow", Math.floor(angle));
    queueDraw();
  }

  function clickedNote(event) {
    const { left, top, width, height } = canvas.getBoundingClientRect();
    return hitNote(2 * (event.clientX - left) / width - 1, 1 - 2 * (event.clientY - top) / height);
  }

  rotator.addEventListener("pointerdown", (event) => {
    if (!event.isPrimary || event.button !== 0) return;
    rotator.dataset.pointer = "";
    pendingNoteClick = false;
    drag = { id: event.pointerId, x: event.clientX, y: event.clientY, angle, moved: false };
    rotator.setPointerCapture(event.pointerId);
  });
  rotator.addEventListener("pointermove", (event) => {
    if (drag?.id !== event.pointerId) {
      if (event.pointerType === "mouse") rotator.style.cursor = clickedNote(event) ? "pointer" : "";
      return;
    }
    const delta = event.clientX - drag.x;
    if (!drag.moved && Math.abs(delta) < 5 && Math.abs(event.clientY - drag.y) < 5) return;
    drag.moved = true;
    dismissed = true;
    rotator.style.cursor = "";
    turn(drag.angle + delta * 360 / rotator.clientWidth);
  });
  rotator.addEventListener("pointerup", (event) => {
    if (drag?.id !== event.pointerId) return;
    pendingNoteClick = !drag.moved && clickedNote(event);
  });
  rotator.addEventListener("click", () => {
    if (!pendingNoteClick) return;
    pendingNoteClick = false;
    noteButton.click();
  });
  rotator.addEventListener("lostpointercapture", (event) => {
    if (drag?.id === event.pointerId) drag = undefined;
  });

  rotator.addEventListener("keydown", (event) => {
    delete rotator.dataset.pointer;
    const step = { ArrowLeft: -15, ArrowDown: -15, ArrowRight: 15, ArrowUp: 15 };
    if (event.key === "Home" || event.key === "End") {
      turn(event.key === "Home" ? 0 : 359);
    } else if (Object.hasOwn(step, event.key)) {
      turn(angle + step[event.key]);
    } else {
      return;
    }
    dismissed = true;
    event.preventDefault();
  });

  rotator.addEventListener("blur", () => { delete rotator.dataset.pointer; });

  const observer = new ResizeObserver(queueDraw);
  observer.observe(rotator);
  canvas.hidden = false;
  display.classList.add("is-3d");
  return {
    reset() {
      dismissed = false;
      drag = undefined;
      pendingNoteClick = false;
      turn(0);
    },
  };
}
