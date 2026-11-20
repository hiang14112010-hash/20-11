import * as THREE from "./vendor/three.module.min.js";
import { PLYLoader } from "./vendor/PLYLoader.js";

const modelHeight = 3.90;
const modelWidth = 2.60;
const modelCenter = .23;

const vertexShader = `
  varying vec3 surfacePoint;
  varying vec3 surfaceNormal;
  void main() {
    surfacePoint = position;
    surfaceNormal = normal;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const fragmentShader = `
  uniform sampler2D firstPhoto;
  uniform sampler2D secondPhoto;
  uniform vec2 firstProjection;
  uniform vec2 secondProjection;
  uniform float photoBlend;
  uniform float angleBetweenPhotos;
  uniform vec3 dimensions;
  varying vec3 surfacePoint;
  varying vec3 surfaceNormal;

  void main() {
    vec3 n = normalize(surfaceNormal);
    float v = 0.5 + (surfacePoint.y - dimensions.z) / dimensions.y;
    vec2 axis = surfacePoint.xz / dimensions.x;
    vec4 a = texture2D(firstPhoto, vec2(0.5 + dot(axis, firstProjection), v));
    vec4 b = texture2D(secondPhoto, vec2(0.5 + dot(axis, secondProjection), v));
    vec2 photoNormals = vec2(
      dot(n.xz, vec2(-firstProjection.y, firstProjection.x)),
      dot(n.xz, vec2(-secondProjection.y, secondProjection.x))
    );
    float facing = clamp((photoNormals.y - photoNormals.x) * 0.08, -0.06, 0.06);
    float blend = smoothstep(0.46, 0.54, photoBlend + facing);
    vec2 weights = vec2(1.0 - blend, blend);
    vec2 alpha = vec2(a.a, b.a);
    float gap = 1.0 - smoothstep(0.04, 0.30, dot(weights, alpha));
    weights += vec2(0.28 * sin(3.14159 * angleBetweenPhotos) * gap);
    vec2 coverage = weights * alpha;
    float sum = coverage.x + coverage.y;
    if (sum < 0.055) discard;
    vec3 color = (a.rgb * coverage.x + b.rgb * coverage.y) / max(sum, 0.001);
    gl_FragColor = vec4(color, 1.0);
    #include <colorspace_fragment>
  }
`;

async function loadBouquet() {
  const loader = new THREE.TextureLoader();
  const angles = ["", "-315", "-left", "-225", "-back", "-135", "-right", "-45"];
  const [geometry, textures] = await Promise.all([
    new PLYLoader().loadAsync("assets/lily-bouquet.ply?v=1"),
    Promise.all(angles.map((angle) =>
      loader.loadAsync("assets/lily-bouquet" + angle + ".webp"))),
  ]);
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  for (const texture of textures) {
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 4;
  }

  const firstProjection = new THREE.Vector2(1, 0);
  const secondProjection = new THREE.Vector2();
  const uniforms = {
    firstPhoto: { value: textures[0] },
    secondPhoto: { value: textures[1] },
    firstProjection: { value: firstProjection },
    secondProjection: { value: secondProjection },
    photoBlend: { value: 0 },
    angleBetweenPhotos: { value: 0 },
    dimensions: { value: new THREE.Vector3(modelWidth, modelHeight, modelCenter) },
  };
  const material = new THREE.ShaderMaterial({
    vertexShader,
    fragmentShader,
    toneMapped: false,
    uniforms,
  });
  const flowers = new THREE.Mesh(geometry, material);
  function updatePhotos(angle, dragging) {
    const sector = angle / 45;
    const index = Math.floor(sector);
    const a = index * Math.PI / 4;
    const b = a + Math.PI / 4;
    uniforms.firstPhoto.value = textures[index];
    uniforms.secondPhoto.value = textures[(index + 1) % textures.length];
    firstProjection.set(Math.cos(a), Math.sin(a));
    secondProjection.set(Math.cos(b), Math.sin(b));
    const progress = sector - index;
    uniforms.photoBlend.value = dragging ? progress : Math.round(progress);
    uniforms.angleBetweenPhotos.value = progress;
  }
  return { flowers, updatePhotos };
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
  const { flowers, updatePhotos } = model;
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
    updatePhotos(angle, drag?.moved);
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
    if (drag?.id !== event.pointerId) return;
    drag = undefined;
    queueDraw();
  });

  rotator.addEventListener("keydown", (event) => {
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
