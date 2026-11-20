import * as THREE from "./vendor/three.module.min.js";

const up = new THREE.Vector3(0, 1, 0);
const face = new THREE.Vector3(0, 0, 1);

function surface(rows, columns, sample) {
  const positions = [];
  const colors = [];
  const triangles = [];
  for (let row = 0; row <= rows; row += 1) {
    for (let column = 0; column <= columns; column += 1) {
      const { point, color } = sample(row / rows, column / columns);
      positions.push(...point);
      colors.push(color.r, color.g, color.b);
      if (row < rows && column < columns) {
        const a = row * (columns + 1) + column;
        const b = a + columns + 1;
        triangles.push(a, a + 1, b, a + 1, b + 1, b);
      }
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  geometry.setIndex(triangles);
  geometry.computeVertexNormals();
  return geometry;
}

function createBouquet() {
  const bouquet = new THREE.Group();
  const paperMaterial = new THREE.MeshStandardMaterial({
    vertexColors: true, side: THREE.DoubleSide, roughness: .99,
  });
  const petalMaterial = new THREE.MeshStandardMaterial({
    vertexColors: true, side: THREE.DoubleSide, roughness: .68,
  });
  const material = (color) => new THREE.MeshStandardMaterial({ color, roughness: .82 });
  const stemMaterial = material("#54602f");
  const twineMaterial = material("#caa576");
  const pollenMaterial = material("#bd7842");
  const cream = new THREE.Color("#ffe4b5");
  const palePink = new THREE.Color("#ffe2df");
  const rosePink = new THREE.Color("#d45983");
  const darkPink = new THREE.Color("#a82754");
  const olive = new THREE.Color("#334322");
  const leafGreen = new THREE.Color("#849657");
  const kraft = new THREE.Color("#c79566");

  function mesh(parent, geometry, mat, x = 0, y = 0, z = 0) {
    const item = new THREE.Mesh(geometry, mat);
    item.position.set(x, y, z);
    parent.add(item);
    return item;
  }

  function tube(parent, points, radius, mat, closed = false) {
    const path = new THREE.CatmullRomCurve3(points.map((point) => new THREE.Vector3(...point)), closed);
    mesh(parent, new THREE.TubeGeometry(path, points.length * 6, radius, 5, closed), mat);
  }

  function wrap(start, end, layer) {
    return surface(13, 56, (t, u) => {
      const angle = start + (end - start) * u;
      const front = Math.sin(angle);
      const crease = Math.cos(angle * 6 + layer * 2 + t * 1.4);
      const fold = .035 * crease + .018 * Math.sin(angle * 13 - t * 2.3);
      const lip = .48 + .62 * (1 - front) / 2 + .15 * Math.cos(angle * 2 + .6)
        + layer * (.10 + .18 * Math.sin(Math.PI * u));
      const y = -1.72 + t * (lip + 1.72) + .035 * Math.sin(angle * 3) * t;
      const taper = Math.max(0, (t - .29) / .71);
      const cinch = .065 * Math.exp(-((t - .38) ** 2) / .012);
      const r = .27 + .73 * (taper ** 1.35) - cinch + fold * (.3 + t) + layer * .02;
      const color = kraft.clone().multiplyScalar(.88 + .11 * Math.sin(t * 19 + angle * 4)
        + .06 * crease + .025 * Math.sin(angle * 39 + t * 70) + layer * .06);
      return { point: [Math.cos(angle) * r + .08 * t, y, front * r * .68], color };
    });
  }
  mesh(bouquet, wrap(-Math.PI, Math.PI, 0), paperMaterial);
  mesh(bouquet, wrap(-1.9, 1.64, 1), paperMaterial);
  mesh(bouquet, wrap(1.50, 3.78, .74), paperMaterial);
  const base = mesh(bouquet, new THREE.CircleGeometry(.27, 32), material("#a8764a"), 0, -1.72, 0);
  base.rotation.x = Math.PI / 2;
  base.scale.y = .67;

  for (let band = 0; band < 3; band += 1) {
    const points = Array.from({ length: 28 }, (_, i) => {
      const angle = i * Math.PI / 14;
      return [.34 * Math.cos(angle) + .04, -.71 + band * .037 + .018 * Math.sin(2 * angle), .24 * Math.sin(angle)];
    });
    tube(bouquet, points, .013, twineMaterial, true);
  }
  const knot = [.06, -.67, .25];
  for (const side of [-1, 1]) {
    tube(bouquet, [
      knot, [.06 + side * .17, -.53, .29], [.06 + side * .37, -.50, .28],
      [.06 + side * .37, -.61, .34], [.06 + side * .19, -.72, .32], knot,
    ], .018, twineMaterial);
    tube(bouquet, [
      knot, [.06 + side * .12, -.79, .31], [.06 + side * .18, -1.04, .29],
      [.06 + side * .30, -1.29, .30], [.06 + side * .24, -1.38, .26],
    ], .014, twineMaterial);
  }

  function lance(t, u, pink = false) {
    const side = 2 * u - 1;
    const width = Math.sin(Math.PI * t) ** .75 * (pink ? .185 : .145);
    const color = pink
      ? palePink.clone().lerp(rosePink, .29 + .64 * t).lerp(darkPink, .23 * (1 - Math.abs(side)) * t)
      : olive.clone().lerp(leafGreen, .38 + .29 * t + .25 * (1 - Math.abs(side)));
    color.multiplyScalar(.93 + .10 * Math.cos(side * 16 + t * 2));
    const z = pink
      ? .20 * Math.sin(Math.PI * t) - .16 * t ** 4 + .09 * side ** 2 * Math.sin(Math.PI * t)
      : .12 * Math.sin(Math.PI * t) - .18 * t ** 3 + .10 * Math.abs(side) * Math.sin(Math.PI * t);
    return { point: [side * width, .035 + t * (pink ? .55 : .74), z], color };
  }
  const leafGeometry = surface(13, 8, (t, u) => lance(t, u));
  const lilyGeometry = surface(14, 10, (t, u) => lance(t, u, true));
  const roseGeometry = surface(10, 9, (t, u) => {
    const side = 2 * u - 1;
    const width = (.043 + .155 * Math.sin(t * Math.PI * .72)) * (1 - .1 * Math.abs(side));
    const z = .22 * t - .055 * t ** 3 + .075 * side ** 2 * t;
    const color = darkPink.clone().lerp(palePink, .18 + .76 * t ** 1.35);
    color.multiplyScalar(1 - .11 * Math.abs(side));
    return { point: [side * width, .06 + .21 * t - .07 * Math.abs(side) * t, z], color };
  });
  const budGeometry = new THREE.LatheGeometry([
    new THREE.Vector2(0, 0), new THREE.Vector2(.07, .105), new THREE.Vector2(.102, .24),
    new THREE.Vector2(.092, .35), new THREE.Vector2(.047, .46), new THREE.Vector2(0, .52),
  ], 10);
  const budMaterials = [material("#b64972"), material("#aaae61"), material("#e39bac")];

  function makeStem(x, y, z) {
    tube(bouquet, [[x * .14, -.57, z * .18], [x * .63, .27, z * .59], [x, y, z]], .022, stemMaterial);
  }

  for (const [x, y, z, lean, twist, size] of [
    [-.55,.35,.43,1.04,-.34,1.28], [.59,.37,.42,-.98,.46,1.20],
    [-.52,.72,-.31,.61,1.40,1.22], [.54,.68,-.20,-.64,-.72,1.23],
    [-.27,1.23,-.44,.48,2.32,1.00], [.39,1.27,-.33,-.37,-2.37,1.08],
    [.61,.72,.15,-.82,1.03,1.03], [-.56,.72,.20,.85,-1.16,1.08],
    [0,.52,.65,.33,.33,.86], [.32,.58,.60,-.81,.36,.86],
    [-.41,.63,-.43,.88,2.71,.92], [.37,.86,-.45,-.45,-2.6,.98],
  ]) {
    const leaf = mesh(bouquet, leafGeometry, petalMaterial, x, y, z);
    leaf.rotation.set(.34, twist, lean);
    leaf.scale.setScalar(size);
  }

  for (const [x,y,z,dx,dy,dz,size,spin] of [
    [-.45,1.13,.38,-.37,.51,.79,.95,.15],
    [.51,1.16,.26,.59,.39,.75,.95,.57],
    [.02,.83,.61,-.06,.56,.83,1.05,.42],
    [-.30,1.59,-.27,-.31,.79,-.34,.87,.30],
    [.30,1.50,-.37,.23,.73,-.64,.91,.69],
  ]) {
    makeStem(x, y, z);
    const lily = new THREE.Group();
    lily.position.set(x, y, z);
    lily.quaternion.setFromUnitVectors(face, new THREE.Vector3(dx, dy, dz).normalize());
    lily.scale.setScalar(size);
    bouquet.add(lily);

    for (let i = 0; i < 6; i += 1) {
      const angle = i * Math.PI / 3 + spin;
      const petal = mesh(lily, lilyGeometry, petalMaterial);
      petal.rotation.z = angle;
      petal.scale.set(i % 2 ? .94 : 1.13, 1 - (i % 3) * .07, 1);
      const px = -Math.sin(angle) * .076;
      const py = Math.cos(angle) * .076;
      tube(lily, [[0, 0, .035], [px * .68, py * .68, .183], [px, py, .252]], .007, stemMaterial);
      const anther = mesh(lily, new THREE.SphereGeometry(.020, 7, 5), pollenMaterial, px, py, .253);
      anther.scale.set(1.1, .65, .65);
    }
    mesh(lily, new THREE.SphereGeometry(.062, 10, 7), material(cream), 0, 0, .047);
  }

  for (const [x,y,z,dx,dy,dz,size] of [
    [-.51,1.35,-.01,-.45,.61,.64,.63], [.27,1.23,.49,.14,.52,.84,.65],
    [.55,.95,.40,.61,.37,.68,.57], [-.52,1.08,.13,-.7,.39,.52,.57],
    [.08,1.32,-.49,0,.47,-.9,.70], [-.30,1.13,-.50,-.5,.48,-.74,.51],
  ]) {
    makeStem(x, y, z);
    const rose = new THREE.Group();
    rose.position.set(x, y, z);
    rose.quaternion.setFromUnitVectors(face, new THREE.Vector3(dx, dy, dz).normalize());
    rose.scale.setScalar(size);
    bouquet.add(rose);
    for (let i = 0; i < 12; i += 1) {
      const petal = mesh(rose, roseGeometry, petalMaterial, 0, 0, (i / 12) * .135);
      petal.rotation.z = i * 2.4;
      petal.scale.setScalar(1 - i * .060);
    }
  }

  for (const [x,y,z,dx,dz,size,shade] of [
    [-.52,1.42,-.14,-.35,.02,.99,0], [.04,1.69,-.24,.20,-.10,1.05,0],
    [.52,1.46,-.22,.44,-.20,.98,0], [-.21,1.54,.17,-.28,.25,.85,1],
    [.37,1.47,.13,.29,.14,.78,1], [-.62,1.09,.01,-.53,.14,.78,2],
    [.66,1.14,-.07,.54,.01,.72,1], [.08,1.54,.22,.14,.28,.72,2],
  ]) {
    makeStem(x, y, z);
    const bud = mesh(bouquet, budGeometry, budMaterials[shade], x, y, z);
    bud.quaternion.setFromUnitVectors(up, new THREE.Vector3(dx, 1, dz).normalize());
    bud.scale.setScalar(size);
  }

  const note = new THREE.Group();
  note.position.set(.14, .78, .98);
  note.rotation.set(-.16, .10, -.18);
  bouquet.add(note);
  mesh(note, new THREE.BoxGeometry(.73, .46, .029), material("#fff5db"));
  const flap = new THREE.Shape();
  flap.moveTo(-.363, .228);
  flap.lineTo(.363, .228);
  flap.lineTo(0, -.055);
  flap.closePath();
  mesh(note, new THREE.ShapeGeometry(flap), material("#edb0b8"), 0, 0, .017);
  const seal = mesh(note, new THREE.CylinderGeometry(.056, .056, .009, 20), material("#a44061"), 0, -.049, .023);
  seal.rotation.x = Math.PI / 2;
  note.traverse((object) => { object.userData.isNote = true; });

  const noteLeaf = mesh(bouquet, leafGeometry, petalMaterial, .39, .46, .99);
  noteLeaf.rotation.set(.21, .06, .79);
  noteLeaf.scale.setScalar(.53);

  return { bouquet, note };
}

export function mountBouquet({ display, rotator, canvas, noteButton, hint }) {
  const renderer = new THREE.WebGLRenderer({
    canvas, alpha: true, antialias: true, powerPreference: "low-power",
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.12;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(33, 1, .1, 26);
  camera.position.set(0, .82, 7.8);
  camera.lookAt(0, .23, 0);
  scene.add(new THREE.HemisphereLight("#fff3eb", "#b68572", 2.1));
  const key = new THREE.DirectionalLight("#fff4e8", 2.7);
  key.position.set(-3, 4, 5);
  scene.add(key);
  const fill = new THREE.DirectionalLight("#ffe3ec", 1.7);
  fill.position.set(4, 2, -4);
  scene.add(fill);

  const { bouquet, note } = createBouquet();
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
    return ray.intersectObject(bouquet, true)[0]?.object.userData.isNote === true;
  }

  function draw() {
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    if (!width || !height) return;
    renderer.getSize(renderSize);
    if (renderSize.x !== width || renderSize.y !== height) renderer.setSize(width, height, false);

    bouquet.rotation.y = THREE.MathUtils.degToRad(angle);
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
    if (drag?.id === event.pointerId) drag = undefined;
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
