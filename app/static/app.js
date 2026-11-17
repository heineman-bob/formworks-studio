import { query, spec, matrixComponents, key as meshKey, specs } from './planning.mjs';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { STLLoader } from 'three/addons/loaders/STLLoader.js';
if (new URLSearchParams(location.search).has('embedded')) document.body.classList.add('embedded');

const $ = (id) => document.getElementById(id);
const viewer = $('viewer');
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(40, 1, 1, 8000);
camera.up.set(0, 0, 1);
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
viewer.prepend(renderer.domElement);
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
scene.add(new THREE.HemisphereLight(0xffffff, 0x506070, 2.6));
const front = new THREE.DirectionalLight(0xffffff, 2.5);
front.position.set(-250, -500, 800);
scene.add(front);
const back = new THREE.DirectionalLight(0xaac5fa, 1.3);
back.position.set(450, 300, 350);
scene.add(back);
const assembly = new THREE.Group();
scene.add(assembly);
const windowScene = new THREE.Group();
scene.add(windowScene);
const loader = new STLLoader();
const geometries = new Map();
const meshRequests = new Map();
const foamGeometries = new Map();
let current = null;
let currentQuery = null;
let currentComponents = [];
let currentMatrixComponents = [];
let generation = 0;
let wireframe = false;
let previewMode = 'assembly';
let designMode = true;
let windowVisible = true;
let windowStyle = 'double_hung';
let activeSelection = null;
let highlightedMesh = null;
let sealedView = false;
let electronicsView = false;
let previewSpeed = 70;
let lastRunningSpeed = 70;
let fanRotors = [];
let controlButtonTargets = [];
let selectedPartName = null;
let cameraFramed = false;
let lastAssemblyCenter = null;
let lastExplodedCenter = null;
let explodedLabels = [];
let panelFocus = '';
let pattern = [
  ['F', 'F', 'F'],
  ['F', 'F', 'F'],
];
const colors = {
  fan: 0x4b8ca1,
  grill: 0xb1c5cf,
  controller: 0x8acba7,
  controller_lid: 0x617b72,
  controller_blank: 0x9a886d,
  spacer: 0xa38b67,
  filler: 0xa38b67,
  left_cap: 0xb69b75,
  right_cap: 0xb69b75,
  top_rail: 0xb28bc8,
  louver: 0x7695b5,
  panel_lid: 0xb7a785,
  fan_cover: 0x769e91,
  fan_cover_lid: 0x9fc0aa,
  magnet_spacer: 0xb8bdc2,
  foam_core: 0xe8c98a,
};
// Purchased fan placement guide. These dark rotor shapes are preview only.
const rotorRing = new THREE.TorusGeometry(54, 1.8, 6, 48);
const rotorHub = new THREE.CylinderGeometry(13, 13, 3, 32);
const rotorBladeShapes = Array.from({ length: 7 }, (_, i) => {
  const a = (i * 2 * Math.PI) / 7;
  const polar = (r, offset) => [r * Math.cos(a + offset), r * Math.sin(a + offset)];
  const blade = new THREE.Shape();
  const points = [
    polar(13, 0),
    polar(34, 0.04),
    polar(53, 0.16),
    polar(52, 0.42),
    polar(37, 0.46),
    polar(14, 0.34),
  ];
  blade.moveTo(...points[0]);
  points.slice(1).forEach((point) => blade.lineTo(...point));
  blade.closePath();
  return blade;
});
const rotorBlades = new THREE.ShapeGeometry(rotorBladeShapes);
const fanFrameLong = new THREE.BoxGeometry(120, 25, 8);
const fanFrameSide = new THREE.BoxGeometry(8, 25, 104);
const fanCorner = new THREE.CylinderGeometry(5, 5, 25, 24);
const panelPlate = new THREE.BoxGeometry(66, 2, 86);
const panelButton = new THREE.CylinderGeometry(5, 5, 2, 24);
const panelButtonLabel = new THREE.PlaneGeometry(6, 6);
const pcbBoard = new THREE.BoxGeometry(32, 1.6, 60);
const pcbChip = new THREE.BoxGeometry(18, 2.5, 20);
const pcbHeader = new THREE.BoxGeometry(2, 3, 53);
const screenCanvas = document.createElement('canvas');
screenCanvas.width = 256;
screenCanvas.height = 112;
const screenTexture = new THREE.CanvasTexture(screenCanvas);
const buttonTextures = Object.fromEntries(
  [
    ['slower', '−'],
    ['power', '⏻'],
    ['faster', '+'],
  ].map(([action, symbol]) => {
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, 64, 64);
    ctx.fillStyle = '#0c2527';
    ctx.font = 'bold 50px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(symbol, 32, 33);
    return [action, new THREE.CanvasTexture(canvas)];
  }),
);
function drawControlScreen() {
  const ctx = screenCanvas.getContext('2d');
  ctx.fillStyle = '#071b1b';
  ctx.fillRect(0, 0, 256, 112);
  ctx.fillStyle = '#86efb4';
  ctx.font = 'bold 23px monospace';
  ctx.fillText('WINDOW FAN', 14, 38);
  ctx.font = 'bold 30px monospace';
  ctx.fillText(
    previewSpeed ? `SPEED ${String(previewSpeed).padStart(3, ' ')}%` : 'POWER OFF',
    14,
    82,
  );
  screenTexture.needsUpdate = true;
}
drawControlScreen();
function setPreviewSpeed(value) {
  previewSpeed = Math.max(0, Math.min(100, Math.round(value)));
  if (previewSpeed) lastRunningSpeed = previewSpeed;
  if (previewSpeed && sealedView && current?.fan_covers) {
    sealedView = false;
    $('sealedView').textContent = '◧ Show sealed view';
    if (previewMode === 'assembly') build(current);
  }
  $('fanSpeed').value = previewSpeed;
  $('fanSpeedValue').textContent = `${previewSpeed}%`;
  $('speedPower').setAttribute('aria-pressed', String(previewSpeed > 0));
  $('speedPower').setAttribute(
    'aria-label',
    previewSpeed ? 'Stop preview fans' : 'Start preview fans',
  );
  drawControlScreen();
}
function usePanelButton(action) {
  if (action === 'power') setPreviewSpeed(previewSpeed ? 0 : lastRunningSpeed);
  else if (action === 'slower') setPreviewSpeed(previewSpeed - 10);
  else if (action === 'faster') setPreviewSpeed(previewSpeed + 10);
}

function rawConfig() {
  return {
    width: $('width').value,
    height: $('height').value,
    slots: $('slots').value,
    rows: $('rows').value,
    clearance_x: $('clearance_x').value,
    clearance_y: $('clearance_y').value,
    controller: $('controller').value,
    side: $('side').value,
    panel_mode: $('panel_mode').value,
    left_panels: $('left_panels').value,
    right_panels: $('right_panels').value,
    rail: $('rail').value,
    depth: $('depth').value,
    sash_slot_w: $('sash_slot_w').value,
    sash_engagement: $('sash_engagement').value,
    sash_thickness: $('sash_thickness').value,
    sash_gasket: $('sash_gasket').value,
    louvers: $('louvers').value,
    insulated: $('insulated').value,
    fan_covers: $('fan_covers').value,
    cover_depth: $('cover_depth').value,
    dovetail_clearance: $('dovetail_clearance').value,
    pin_clearance: $('pin_clearance').value,
    magnet_d: $('magnet_d').value,
    magnet_h: $('magnet_h').value,
    strike_d: $('strike_d').value,
    strike_h: $('strike_h').value,
    magnet_clearance: $('magnet_clearance').value,
    cleat_clearance: $('cleat_clearance').value,
    gasket_thickness: $('gasket_thickness').value,
    pattern: pattern.map((row) => row.join('')).join('/'),
    panel_focus: panelFocus,
  };
}
function applyNormalized(raw) {
  for (const id of [
    'width',
    'height',
    'slots',
    'rows',
    'clearance_x',
    'clearance_y',
    'controller',
    'side',
    'panel_mode',
    'left_panels',
    'right_panels',
    'rail',
    'depth',
    'sash_slot_w',
    'sash_engagement',
    'sash_thickness',
    'sash_gasket',
    'louvers',
    'insulated',
    'fan_covers',
    'cover_depth',
    'dovetail_clearance',
    'pin_clearance',
    'magnet_d',
    'magnet_h',
    'strike_d',
    'strike_h',
    'magnet_clearance',
    'cleat_clearance',
    'gasket_thickness',
  ]) {
    $(id).value = raw[id];
  }
  pattern = raw.pattern.split('/').map((row) => [...row]);
}
function componentGeometry(component) {
  if (component.part === 'foam_core') {
    const id = `${component.width}:${component.height}:${component.thickness}`;
    if (!foamGeometries.has(id))
      foamGeometries.set(
        id,
        new THREE.BoxGeometry(component.width, component.thickness, component.height),
      );
    return foamGeometries.get(id);
  }
  return geometries.get(
    key(spec(component.part, component.width, component.height, component.edge)),
  );
}
const key = (item, cfg = current) => meshKey(item, cfg);
function visibleSpecs(cfg) {
  const visible = new Set([
    'left_cap',
    'right_cap',
    'fan',
    'grill',
    'spacer',
    'filler',
    'panel_lid',
    'controller',
    'controller_blank',
    'top_rail',
  ]);
  if (cfg.louvers) visible.add('louver');
  if (!electronicsView) visible.add('controller_lid');
  if (sealedView) {
    visible.add('fan_cover');
    visible.add('fan_cover_lid');
  }
  return specs(cfg).filter((item) => visible.has(item.part));
}
async function ensureMeshes(items, raw, run = generation) {
  for (let i = 0; i < items.length; i += 3) {
    if (run !== generation) return false;
    $('loading').textContent =
      `Preparing preview parts ${Math.min(i + 3, items.length)} / ${items.length}`;
    await Promise.all(items.slice(i, i + 3).map((item) => getPart(item, raw)));
  }
  return run === generation;
}
function syncPattern() {
  const rows = Math.max(1, Math.min(8, Number($('rows').value) || 1));
  const slots = Math.max(1, Math.min(20, Number($('slots').value) || 1));
  pattern = Array.from({ length: rows }, (_, r) =>
    Array.from({ length: slots }, (_, c) => pattern[r]?.[c] || 'F'),
  );
  const grid = $('patternGrid');
  grid.replaceChildren();
  for (let r = rows - 1; r >= 0; r--) {
    const line = document.createElement('div');
    line.className = 'pattern-row';
    const label = document.createElement('span');
    label.className = 'row-label';
    label.textContent = `R${r + 1}`;
    line.append(label);
    for (let c = 0; c < slots; c++) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = `cell ${pattern[r][c] === 'F' ? 'cell-fan' : 'cell-solid'}`;
      button.textContent = pattern[r][c] === 'F' ? 'FAN' : 'SOLID';
      button.title = `Row ${r + 1}, column ${c + 1}: ${pattern[r][c] === 'F' ? 'fan' : 'solid panel'}. Click to switch.`;
      button.setAttribute('aria-label', button.title);
      button.addEventListener('click', () => {
        pattern[r][c] = pattern[r][c] === 'F' ? 'S' : 'F';
        schedule();
      });
      line.append(button);
    }
    grid.append(line);
  }
}
function showSuggestion() {
  const width = Number($('width').value) - Number($('clearance_x').value);
  const slots = Number($('slots').value);
  const controller = $('controller').value !== 'none' ? 80 : 0;
  const remaining = width - 24 - controller - slots * 140;
  const after = remaining - 140;
  const possible = slots < 20 && (after === 0 || after >= 22);
  $('suggestion').hidden = !possible;
  if (possible)
    $('suggestionText').textContent =
      `This opening can fit another 140 mm fan column${after ? ` with ${after} mm left for side panels` : ' exactly'}.`;
}
function clearAssembly() {
  highlightedMesh = null;
  while (assembly.children.length) {
    const child = assembly.children[0];
    assembly.remove(child);
    child.traverse((object) => {
      if (object.isMesh) {
        object.material.dispose();
        if (object.userData.placeholder) object.geometry.dispose();
      }
    });
  }
  fanRotors = [];
  controlButtonTargets = [];
  $('explodeLabels').replaceChildren();
  explodedLabels = [];
}
function material(part) {
  return new THREE.MeshStandardMaterial({
    color: colors[part] || 0x8c9ca8,
    metalness: part === 'foam_core' ? 0 : 0.15,
    roughness: 0.65,
    side: THREE.DoubleSide,
    wireframe,
  });
}
function addPart(item, x, z, y = 0, selection = null) {
  let geometry = geometries.get(key(item));
  const placeholder = !geometry;
  if (placeholder) {
    const width =
      item.width ||
      (item.part === 'controller' ||
      item.part === 'controller_blank' ||
      item.part === 'controller_lid'
        ? 80
        : item.part.includes('cap')
          ? 12
          : 140);
    const depth = ['grill', 'louver', 'panel_lid', 'fan_cover_lid'].includes(item.part)
      ? 3
      : item.part === 'fan_cover'
        ? current.cover_depth
        : current.depth;
    const height = item.height || 140;
    geometry = new THREE.BoxGeometry(width, depth, height);
    const offsetY =
      item.part === 'fan_cover'
        ? -depth / 2
        : item.part === 'grill'
          ? -depth / 2
          : item.part === 'controller_lid'
            ? current.depth + depth / 2
            : depth / 2;
    geometry.translate(0, offsetY, height / 2);
  }
  const partMaterial = material(item.part);
  if (placeholder) {
    partMaterial.transparent = true;
    partMaterial.opacity = 0.22;
    partMaterial.wireframe = true;
  }
  const mesh = new THREE.Mesh(geometry, partMaterial);
  mesh.position.set(x, y, z);
  mesh.userData.placeholder = placeholder;
  if (selection) mesh.userData.selection = selection;
  assembly.add(mesh);
  return mesh;
}
function addFanPreview(x, z) {
  const dark = () =>
    new THREE.MeshStandardMaterial({
      color: 0x243946,
      metalness: 0.25,
      roughness: 0.7,
      side: THREE.DoubleSide,
      wireframe,
    });
  for (const dz of [-56, 56]) {
    const beam = new THREE.Mesh(fanFrameLong, dark());
    beam.position.set(x, 17, z + 70 + dz);
    assembly.add(beam);
  }
  for (const dx of [-56, 56]) {
    const beam = new THREE.Mesh(fanFrameSide, dark());
    beam.position.set(x + dx, 17, z + 70);
    assembly.add(beam);
  }
  for (const dx of [-52.5, 52.5])
    for (const dz of [-52.5, 52.5]) {
      const boss = new THREE.Mesh(fanCorner, dark());
      boss.position.set(x + dx, 17, z + 70 + dz);
      assembly.add(boss);
    }
  const ring = new THREE.Mesh(rotorRing, dark());
  ring.rotation.x = Math.PI / 2;
  ring.position.set(x, 17, z + 70);
  assembly.add(ring);
  const rotor = new THREE.Group();
  rotor.position.set(x, 16, z + 70);
  const hub = new THREE.Mesh(rotorHub, dark());
  rotor.add(hub);
  const blades = new THREE.Mesh(rotorBlades, dark());
  blades.rotation.x = Math.PI / 2;
  rotor.add(blades);
  assembly.add(rotor);
  fanRotors.push(rotor);
}
function addControllerPreview(x, z) {
  const mesh = (geometry, color, px, py, pz, metalness = 0.05) => {
    const part = new THREE.Mesh(
      geometry,
      new THREE.MeshStandardMaterial({
        color,
        metalness,
        roughness: 0.62,
        wireframe,
      }),
    );
    part.position.set(x + px, py, z + pz);
    assembly.add(part);
    return part;
  };
  mesh(panelPlate, 0x17303c, 0, -1.1, 72);
  const display = mesh(new THREE.PlaneGeometry(49, 21), 0xffffff, 0, -2.25, 95);
  display.rotation.x = Math.PI / 2;
  display.material.map = screenTexture;
  display.material.emissive = new THREE.Color(0x285d45);
  display.material.emissiveIntensity = 0.45;
  display.material.needsUpdate = true;
  for (const [px, action] of [
    [-17, 'slower'],
    [0, 'power'],
    [17, 'faster'],
  ]) {
    const button = mesh(panelButton, action === 'power' ? 0x82dca6 : 0x567e86, px, -2.6, 56);
    button.userData.controlAction = action;
    controlButtonTargets.push(button);
    const label = new THREE.Mesh(
      panelButtonLabel,
      new THREE.MeshBasicMaterial({
        map: buttonTextures[action],
        transparent: true,
        side: THREE.DoubleSide,
        depthWrite: false,
      }),
    );
    label.rotation.x = Math.PI / 2;
    label.position.set(x + px, -3.72, z + 56);
    label.userData.controlAction = action;
    assembly.add(label);
    controlButtonTargets.push(label);
  }
  mesh(pcbBoard, 0x17614e, 0, 15, 72);
  mesh(pcbChip, 0x1d272d, 0, 17, 75);
  mesh(new THREE.BoxGeometry(11, 4, 7), 0xa6b8bc, 0, 18, 45, 0.55);
  for (const px of [-15, 15]) mesh(pcbHeader, 0x171d22, px, 17, 72);
}
function resetCamera() {
  if (!current) return;
  if (previewMode === 'explode' && assembly.children.length) {
    const bounds = new THREE.Box3().setFromObject(assembly);
    const center = bounds.getCenter(new THREE.Vector3());
    const size = bounds.getSize(new THREE.Vector3());
    const halfFov = THREE.MathUtils.degToRad(camera.fov / 2);
    const distance =
      Math.max(size.z / (2 * Math.tan(halfFov)), size.x / (2 * Math.tan(halfFov) * camera.aspect)) *
      1.45;
    controls.target.copy(center);
    camera.position.set(center.x, center.y - Math.max(400, distance), center.z + distance * 0.18);
    camera.far = 20000;
    camera.updateProjectionMatrix();
    controls.update();
    return;
  }
  if (previewMode === 'part' && assembly.children.length) {
    const bounds = new THREE.Box3().setFromObject(assembly);
    const center = bounds.getCenter(new THREE.Vector3());
    const size = bounds.getSize(new THREE.Vector3());
    controls.target.copy(center);
    camera.position.set(
      center.x,
      center.y - Math.max(200, size.x * 2.2, size.z * 2.2),
      center.z + Math.max(90, size.z * 0.8),
    );
    camera.updateProjectionMatrix();
    controls.update();
    return;
  }
  const bounds =
    windowVisible && windowScene.visible
      ? new THREE.Box3().setFromObject(windowScene)
      : new THREE.Box3().setFromObject(assembly);
  const center = bounds.getCenter(new THREE.Vector3());
  const size = bounds.getSize(new THREE.Vector3());
  const halfFov = THREE.MathUtils.degToRad(camera.fov / 2);
  const distance =
    Math.max(size.z / (2 * Math.tan(halfFov)), size.x / (2 * Math.tan(halfFov) * camera.aspect)) *
    1.3;
  controls.target.copy(center);
  camera.position.set(center.x, center.y - Math.max(450, distance), center.z + distance * 0.16);
  camera.far = 9000;
  camera.updateProjectionMatrix();
  controls.update();
}
function panCameraTo(center) {
  const difference = center.clone().sub(controls.target);
  camera.position.add(difference);
  controls.target.add(difference);
  controls.update();
}
function syncViewButtons() {
  $('viewAssembly').setAttribute('aria-pressed', String(previewMode === 'assembly'));
  $('viewExploded').setAttribute('aria-pressed', String(previewMode === 'explode'));
  renderer.domElement.style.cursor = 'grab';
}
function rebuildWindow(cfg) {
  const disposables = new Set();
  windowScene.traverse((object) => {
    if (object.isMesh) {
      disposables.add(object.geometry);
      disposables.add(object.material);
    }
  });
  windowScene.clear();
  disposables.forEach((item) => item.dispose());
  windowScene.visible = windowVisible && previewMode === 'assembly';
  $('windowNote').hidden = !windowScene.visible;
  if (!windowScene.visible) return;
  const w = cfg.width,
    h = cfg.height,
    f = Math.max(18, Math.min(34, w * 0.035));
  const upper = Math.max(260, Math.min(560, h * 0.95));
  const slide = Math.max(280, Math.min(700, w * 0.62));
  const totalW = windowStyle === 'slider' ? w + slide : w;
  const totalH = windowStyle === 'double_hung' ? h + upper : h;
  const trim = new THREE.MeshStandardMaterial({
    color: 0xdce1d9,
    roughness: 0.61,
    metalness: 0.06,
  });
  const inner = new THREE.MeshStandardMaterial({
    color: 0x9aaea9,
    roughness: 0.7,
  });
  const wall = new THREE.MeshStandardMaterial({
    color: 0x697777,
    roughness: 0.96,
  });
  const glass = new THREE.MeshPhysicalMaterial({
    color: 0x8ec6d4,
    transparent: true,
    opacity: 0.34,
    roughness: 0.12,
    metalness: 0.08,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const handle = new THREE.MeshStandardMaterial({
    color: 0x526361,
    roughness: 0.35,
    metalness: 0.55,
  });
  const seal = new THREE.MeshStandardMaterial({
    color: 0x477d62,
    roughness: 0.98,
  });
  function box(
    width,
    depth,
    height,
    x,
    y,
    z,
    material,
    parent = windowScene,
    selection = 'opening',
  ) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, depth, height), material);
    mesh.position.set(x, y, z);
    mesh.userData.selection = { kind: selection };
    parent.add(mesh);
    return mesh;
  }
  function glazedSash(x, z, width, height, y, parent = windowScene, sashDepth = 22) {
    const sash = new THREE.Group();
    sash.position.set(x, y, z);
    parent.add(sash);
    const t = Math.max(13, Math.min(24, f * 0.65));
    box(width - t, 2, height - t, 0, 0, 0, glass, sash, 'glass');
    for (const sx of [-width / 2 + t / 2, width / 2 - t / 2])
      box(t, sashDepth, height, sx, 0, 0, trim, sash);
    for (const sz of [-height / 2 + t / 2, height / 2 - t / 2])
      box(width, sashDepth, t, 0, 0, sz, trim, sash);
    box(t * 0.42, 8, height - t, 0, -7, 0, inner, sash, 'glass');
    return sash;
  }
  // Deep reveal and sill make the print assembly read as an insert in a wall.
  box(f * 3.6, cfg.depth + 90, totalH + f * 4, -f * 2, cfg.depth / 2, totalH / 2, wall);
  box(f * 3.6, cfg.depth + 90, totalH + f * 4, totalW + f * 2, cfg.depth / 2, totalH / 2, wall);
  box(totalW + f * 7, cfg.depth + 90, f * 2.4, totalW / 2, cfg.depth / 2, -f * 1.2, wall);
  box(totalW + f * 7, cfg.depth + 90, f * 2.4, totalW / 2, cfg.depth / 2, totalH + f * 1.2, wall);
  for (const x of [-f / 2, totalW + f / 2])
    box(f, cfg.depth + 28, totalH + f, x, cfg.depth / 2, totalH / 2, trim);
  box(totalW + f * 2, cfg.depth + 35, f, totalW / 2, cfg.depth / 2, -f / 2, trim);
  box(totalW + f * 2, cfg.depth + 35, f, totalW / 2, cfg.depth / 2, totalH + f / 2, trim);
  box(totalW + f * 3, cfg.depth + 65, f * 0.45, totalW / 2, -17, -f * 0.4, trim);
  const gap = Math.max(0, cfg.usable_height - cfg.built_height);
  if (gap > 0)
    box(w, 2, gap, w / 2, cfg.depth + 10, cfg.built_height + gap / 2, glass, windowScene, 'glass');
  if (windowStyle === 'double_hung') {
    // The upper sash remains in its own track. The lowered sash seats on the
    // printed rail, with gasket at the channel floor and both side walls.
    glazedSash(w / 2, h + upper * 0.55, w - f * 0.7, upper * 0.82, cfg.depth + 48);
    const channelY = cfg.depth - cfg.sash_slot_w / 2 - 5;
    const seatZ = cfg.rail
      ? cfg.built_height - cfg.sash_engagement + cfg.sash_gasket
      : cfg.built_height;
    const lowerHeight = upper * 0.68;
    glazedSash(
      w / 2,
      seatZ + lowerHeight / 2,
      w,
      lowerHeight,
      channelY,
      windowScene,
      cfg.sash_thickness,
    );
    if (cfg.rail) {
      const bottom = cfg.built_height - cfg.sash_engagement;
      const sideY = cfg.sash_slot_w / 2 - cfg.sash_gasket / 2;
      box(
        w,
        cfg.sash_slot_w,
        cfg.sash_gasket,
        w / 2,
        channelY,
        bottom + cfg.sash_gasket / 2,
        seal,
        windowScene,
        'rail',
      );
      for (const side of [-1, 1])
        box(
          w,
          cfg.sash_gasket,
          cfg.sash_engagement,
          w / 2,
          channelY + side * sideY,
          bottom + cfg.sash_engagement / 2,
          seal,
          windowScene,
          'rail',
        );
    }
    box(
      60,
      9,
      9,
      w / 2,
      channelY - cfg.sash_thickness / 2 - 6,
      seatZ + 15,
      handle,
      windowScene,
      'rail',
    );
  } else if (windowStyle === 'slider') {
    glazedSash(w + slide / 2, h / 2, slide - f * 0.55, h - f * 0.7, cfg.depth + 19);
    box(f * 0.6, 28, h, w + f * 0.3, cfg.depth + 9, h / 2, trim, windowScene, 'rail');
    box(totalW, 10, 7, totalW / 2, cfg.depth + 18, 7, inner);
    box(totalW, 10, 7, totalW / 2, cfg.depth + 18, h - 7, inner);
    box(9, 8, 44, w + 22, cfg.depth - 7, h / 2, handle);
  } else {
    const hinge = new THREE.Group();
    hinge.position.set(0, cfg.depth + 14, 0);
    hinge.rotation.z = 0.52;
    windowScene.add(hinge);
    glazedSash(w * 0.44, h / 2, w * 0.88, h - f * 0.7, 0, hinge);
    box(9, 14, 46, w * 0.83, -16, h / 2, handle, hinge);
    for (const z of [h * 0.2, h * 0.8]) box(17, 23, 18, 0, 0, z, handle);
  }
  $('windowNote').textContent =
    {
      double_hung: 'Lowered double-hung sash',
      slider: 'Horizontal slider',
      casement: 'Out-swing casement',
    }[windowStyle] +
    (windowStyle === 'double_hung' && !cfg.rail
      ? ' · No top rail: the sash has no printed sealing channel. Add a sealing rail.'
      : windowStyle === 'double_hung'
        ? ` · ${cfg.sash_engagement} mm channel; sash compresses ${cfg.sash_gasket} mm gasket on the floor and sides. Check actual sash travel.`
        : ' · Visual fit example. Measure the clear opening and check sash travel, screens, and hardware.');
}

const inspectorGroups = {
  opening: [
    'width',
    'height',
    'slots',
    'rows',
    'rail',
    'sash_thickness',
    'sash_gasket',
    'clearance_x',
    'clearance_y',
  ],
  fan: ['depth', 'louvers', 'fan_covers', 'cover_depth'],
  solid: ['depth', 'insulated'],
  filler: ['panel_mode', 'side', 'depth'],
  controller: ['controller', 'depth'],
  rail: ['rail', 'sash_slot_w', 'sash_engagement', 'sash_thickness', 'sash_gasket'],
  cover: [
    'cover_depth',
    'magnet_d',
    'magnet_h',
    'strike_d',
    'strike_h',
    'magnet_clearance',
    'cleat_clearance',
    'gasket_thickness',
  ],
  louver: ['louvers', 'depth'],
  joint: ['dovetail_clearance', 'pin_clearance'],
};
function selectDesign(selection, mesh = null) {
  if (highlightedMesh?.material?.emissive) highlightedMesh.material.emissive.setHex(0);
  highlightedMesh = null;
  activeSelection = selection;
  if (mesh?.material?.emissive && mesh.parent === assembly) {
    mesh.material.emissive.setHex(0x286448);
    mesh.material.emissiveIntensity = 0.65;
    highlightedMesh = mesh;
  }
  renderInspector();
}
function renderInspector() {
  const box = $('designInspector');
  box.hidden = !designMode || previewMode !== 'assembly';
  if (box.hidden) return;
  const selection = activeSelection || { kind: 'opening' };
  const kind = selection.kind;
  const title =
    {
      opening: 'Window opening',
      glass: 'Window glazing',
      fan: 'Fan module',
      solid: 'Solid insulated panel',
      filler: 'Side filler panel',
      controller: 'Control module',
      rail: 'Top rail and sash',
      cover: 'Removable fan cover',
      louver: 'Output louver',
      joint: 'Module joints',
    }[kind] || 'Window build';
  $('inspectorTitle').textContent =
    selection.row != null
      ? `${title} · row ${selection.row + 1}, column ${selection.slot + 1}`
      : title;
  $('inspectorDescription').textContent =
    kind === 'fan' || kind === 'solid'
      ? 'Change this cell between a fan and a solid insulated panel, or adjust shared module settings.'
      : 'Changes here update the same printable configuration and part counts.';
  const fields = $('inspectorFields');
  fields.replaceChildren();
  const ids = inspectorGroups[kind === 'glass' ? 'opening' : kind] || inspectorGroups.opening;
  if (kind === 'filler' && selection.side != null) {
    const label = document.createElement('label');
    label.textContent = `${selection.side.toUpperCase()} PANEL WIDTH · mm`;
    const input = document.createElement('input');
    input.type = 'number';
    input.min = '22';
    input.max = '220';
    input.step = '1';
    input.value = selection.width;
    input.addEventListener('change', () => {
      $('panel_mode').value = 'manual';
      const id = selection.side === 'left' ? 'left_panels' : 'right_panels';
      const widths =
        selection.side === 'left' ? [...current.left_panels] : [...current.right_panels];
      widths[selection.index] = Math.max(22, Math.min(220, Number(input.value) || selection.width));
      $('left_panels').value =
        selection.side === 'left' ? widths.join(', ') : current.left_panels.join(', ');
      $('right_panels').value =
        selection.side === 'right' ? widths.join(', ') : current.right_panels.join(', ');
      schedule(id);
    });
    label.append(input);
    fields.append(label);
  }
  if (kind === 'fan' || kind === 'solid') {
    const toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.className = 'inspector-action';
    toggle.textContent =
      kind === 'fan' ? 'Change this cell to solid panel' : 'Change this cell to fan';
    toggle.addEventListener('click', () => {
      pattern[selection.row][selection.slot] = kind === 'fan' ? 'S' : 'F';
      activeSelection = {
        ...selection,
        kind: kind === 'fan' ? 'solid' : 'fan',
      };
      schedule();
    });
    fields.append(toggle);
  }
  for (const id of ids) {
    const original = $(id);
    const label = document.createElement('label');
    label.textContent =
      original.closest('label')?.firstChild?.textContent.trim() || id.replaceAll('_', ' ');
    const input = original.cloneNode(true);
    input.id = `design_${id}`;
    input.value = original.value;
    input.addEventListener('change', () => {
      original.value = input.value;
      original.dispatchEvent(new Event('change', { bubbles: true }));
    });
    label.append(input);
    fields.append(label);
  }
  const advanced = document.createElement('button');
  advanced.type = 'button';
  advanced.className = 'inspector-link';
  advanced.textContent = 'Open all settings and print list →';
  advanced.addEventListener('click', () => setDesignMode(false));
  fields.append(advanced);
}
function setDesignMode(enabled) {
  designMode = enabled;
  document.body.classList.toggle('design-mode', enabled);
  $('designMode').setAttribute('aria-pressed', String(enabled));
  $('designMode').textContent = enabled ? '✦ Design mode' : '✦ Enter design mode';
  $('advancedSettings').textContent = enabled ? '⚙ Full settings' : '✦ Design workspace';
  renderInspector();
  resize();
}
function build(cfg, frame = false) {
  const wasAssembly = previewMode === 'assembly';
  const center = new THREE.Vector3(cfg.usable_width / 2, -5, cfg.built_height / 2);
  previewMode = 'assembly';
  syncViewButtons();
  selectedPartName = null;
  clearAssembly();
  rebuildWindow(cfg);
  $('explodeLabels').hidden = true;
  $('explodeCatalog').hidden = true;
  document.querySelector('.viewport').classList.remove('exploded-mode');
  const rows = cfg.pattern.split('/');
  for (let r = 0; r < cfg.rows; r++) {
    let x = 0,
      slot = 0,
      fillerSeen = 0;
    for (const [kind, width] of cfg.columns) {
      const center = x + width / 2;
      if (kind === 'slot') {
        if (rows[r][slot] === 'F') {
          addPart(spec('fan'), center, r * 140, 0, {
            kind: 'fan',
            row: r,
            slot,
          });
          addPart(spec('grill'), center, r * 140, 0, {
            kind: 'fan',
            row: r,
            slot,
          });
          if (!sealedView) addFanPreview(center, r * 140);
          if (cfg.louvers)
            addPart(spec('louver'), center, r * 140, cfg.depth, {
              kind: 'louver',
              row: r,
              slot,
            });
          if (cfg.fan_covers && sealedView) {
            addPart(spec('fan_cover'), center, r * 140, 0, {
              kind: 'cover',
              row: r,
              slot,
            });
            addPart(spec('fan_cover_lid'), center, r * 140, -6, {
              kind: 'cover',
              row: r,
              slot,
            });
          }
        } else {
          addPart(spec('spacer'), center, r * 140, 0, {
            kind: 'solid',
            row: r,
            slot,
          });
          addPart(spec('panel_lid', 140), center, r * 140, cfg.depth, {
            kind: 'solid',
            row: r,
            slot,
          });
        }
        slot++;
      } else if (kind === 'controller') {
        addPart(spec(r === 0 ? 'controller' : 'controller_blank'), center, r * 140, 0, {
          kind: 'controller',
        });
        if (r === 0) {
          addControllerPreview(center, 0);
          if (!electronicsView)
            addPart(spec('controller_lid'), center, 0, 0, {
              kind: 'controller',
            });
        } else
          addPart(spec('panel_lid', 80), center, r * 140, cfg.depth, {
            kind: 'controller',
          });
      } else if (kind === 'filler') {
        const side = fillerSeen < cfg.left_panels.length ? 'left' : 'right';
        const index = side === 'left' ? fillerSeen : fillerSeen - cfg.left_panels.length;
        const selection = { kind: 'filler', width, side, index };
        addPart(spec('filler', width), center, r * 140, 0, selection);
        if (width >= 40) addPart(spec('panel_lid', width), center, r * 140, cfg.depth, selection);
        fillerSeen++;
      } else addPart(spec(kind), center, r * 140, 0, { kind: 'filler', width });
      x += width;
    }
  }
  if (cfg.rail) {
    let x = 0;
    cfg.columns.forEach((column, i) => {
      const width = column[1];
      const edge = i === 0 ? 'left' : i === cfg.columns.length - 1 ? 'right' : 'middle';
      addPart(spec('top_rail', width, cfg.rail, edge), x + width / 2, cfg.rows * 140, 0, {
        kind: 'rail',
      });
      x += width;
    });
  }
  $('heading').textContent =
    `${cfg.fan_count} FANS · ${cfg.solid_count} SOLID · ${cfg.rows} ROW${cfg.rows === 1 ? '' : 'S'}`;
  document.querySelectorAll('.part-card').forEach((card) => card.classList.remove('selected'));
  resize();
  if (frame || !cameraFramed) {
    resetCamera();
    cameraFramed = true;
  } else if (wasAssembly && lastAssemblyCenter) {
    const shift = center.clone().sub(lastAssemblyCenter);
    camera.position.add(shift);
    controls.target.add(shift);
    controls.update();
  } else {
    panCameraTo(center);
  }
  lastAssemblyCenter = center;
  renderInspector();
}
function buildExploded(cfg, components, frame = false) {
  if (!cfg || !components.length) return;
  const count = components.length;
  const columns = Math.min(6, Math.max(2, Math.ceil(Math.sqrt(count))));
  const rows = Math.ceil(count / columns);
  const bounds = components.map((component) => {
    const geometry = componentGeometry(component);
    geometry.computeBoundingBox();
    return geometry.boundingBox;
  });
  const cellWidth = Math.max(245, ...bounds.map((box) => box.max.x - box.min.x + 38));
  const cellHeight = Math.max(215, ...bounds.map((box) => box.max.z - box.min.z + 70));
  const center = new THREE.Vector3(
    ((columns - 1) * cellWidth) / 2,
    0,
    ((rows - 1) * cellHeight) / 2,
  );
  const wasExploded = previewMode === 'explode';
  previewMode = 'explode';
  syncViewButtons();
  selectedPartName = null;
  clearAssembly();
  windowScene.visible = false;
  $('windowNote').hidden = true;
  renderInspector();
  document.querySelector('.viewport').classList.add('exploded-mode');
  const catalog = $('explodeCatalog');
  catalog.replaceChildren();
  components.forEach((component, index) => {
    const box = bounds[index];
    const boxCenter = box.getCenter(new THREE.Vector3());
    const col = index % columns;
    const row = Math.floor(index / columns);
    const x = col * cellWidth - boxCenter.x;
    const z = (rows - 1 - row) * cellHeight - boxCenter.z;
    const mesh = new THREE.Mesh(componentGeometry(component), material(component.part));
    mesh.position.set(x, -boxCenter.y, z);
    mesh.userData.componentName = component.name;
    assembly.add(mesh);
    const number = String(index + 1).padStart(2, '0');
    const label = document.createElement('button');
    label.type = 'button';
    label.className = 'explode-label';
    const action = component.kind === 'cut' ? 'cut' : 'print';
    label.textContent = `${number} · ${action.toUpperCase()} ×${component.quantity}`;
    label.title = `${component.label} — ${action} ${component.quantity}`;
    label.setAttribute('aria-label', `Inspect ${component.label}, ${action} ${component.quantity}`);
    label.addEventListener('click', () => inspectPart(component));
    $('explodeLabels').append(label);
    explodedLabels.push({
      element: label,
      point: new THREE.Vector3(
        col * cellWidth,
        -boxCenter.y,
        (rows - 1 - row) * cellHeight - (box.max.z - box.min.z) / 2 - 23,
      ),
    });
    const entry = document.createElement('button');
    entry.type = 'button';
    const badge = document.createElement('b');
    badge.textContent = number;
    entry.append(badge);
    entry.append(document.createTextNode(`${component.label} · ${action} ×${component.quantity}`));
    const filename = document.createElement('span');
    filename.textContent =
      component.kind === 'cut'
        ? `${component.width} × ${component.height} × ${component.thickness} mm rigid foam`
        : `${component.name}.stl`;
    entry.append(filename);
    entry.addEventListener('click', () => inspectPart(component));
    catalog.append(entry);
  });
  $('explodeLabels').hidden = false;
  catalog.hidden = false;
  const printCount = components
    .filter((part) => part.kind !== 'cut')
    .reduce((sum, part) => sum + part.quantity, 0);
  $('heading').textContent =
    `EXPLODED · ${printCount} PRINTS · ${components.length - currentComponents.length} FOAM CUT TYPES`;
  document.querySelectorAll('.part-card').forEach((card) => card.classList.remove('selected'));
  resize();
  if (frame || !cameraFramed) {
    resetCamera();
    cameraFramed = true;
  } else if (wasExploded && lastExplodedCenter) {
    const shift = center.clone().sub(lastExplodedCenter);
    camera.position.add(shift);
    controls.target.add(shift);
    controls.update();
  } else {
    panCameraTo(center);
  }
  lastExplodedCenter = center;
}
async function inspectPart(component, preserveView = false) {
  if (!current) return;
  const queryAtStart = currentQuery;
  if (component.part !== 'foam_core' && !componentGeometry(component)) {
    $('loading').hidden = false;
    $('loading').textContent = `Preparing ${component.label}…`;
    try {
      await getPart(
        spec(component.part, component.width, component.height, component.edge),
        Object.fromEntries(new URLSearchParams(queryAtStart)),
      );
    } catch (error) {
      $('progress').textContent = `Preview failed: ${error.message}`;
      $('loading').hidden = true;
      return;
    }
    $('loading').hidden = true;
    if (queryAtStart !== currentQuery) return;
  }
  const geometry = componentGeometry(component);
  if (!geometry) return;
  clearAssembly();
  windowScene.visible = false;
  $('windowNote').hidden = true;
  renderInspector();
  previewMode = 'part';
  syncViewButtons();
  $('explodeLabels').hidden = true;
  $('explodeCatalog').hidden = true;
  document.querySelector('.viewport').classList.remove('exploded-mode');
  selectedPartName = component.name;
  if (component.kind === 'cut') assembly.add(new THREE.Mesh(geometry, material('foam_core')));
  else addPart(spec(component.part, component.width, component.height, component.edge), 0, 0);
  $('heading').textContent = component.label.toUpperCase();
  document
    .querySelectorAll('.part-card')
    .forEach((card) => card.classList.toggle('selected', card.dataset.part === component.name));
  resize();
  if (!preserveView) resetCamera();
}
async function getPart(item, raw) {
  const id = key(item);
  if (geometries.has(id)) return geometries.get(id);
  if (meshRequests.has(id)) return meshRequests.get(id);
  const request = (async () => {
    const params = new URLSearchParams(raw);
    params.set('panel_w', item.width);
    params.set('rail_h', item.height);
    params.set('rail_edge', item.edge);
    const response = await fetch(`/api/model/${item.part}?${params}`);
    if (!response.ok) throw Error((await response.json()).error || `${item.part} failed`);
    const geometry = loader.parse(await response.arrayBuffer());
    geometry.computeVertexNormals();
    geometries.set(id, geometry);
    return geometry;
  })();
  meshRequests.set(id, request);
  try {
    return await request;
  } finally {
    meshRequests.delete(id);
  }
}
function showFit(cfg, components, quantities, foamCuts, hardware) {
  $('total').textContent = cfg.fan_count;
  $('solidTotal').textContent = cfg.solid_count;
  $('panelTotal').textContent = cfg.left_panels.length + cfg.right_panels.length;
  $('topGap').textContent = `${cfg.top_gap} mm`;
  $('panelSummary').textContent =
    `Left: ${cfg.left_panels.length ? `${cfg.left_panels.join(' + ')} mm` : 'none'}  ·  Right: ${cfg.right_panels.length ? `${cfg.right_panels.join(' + ')} mm` : 'none'}`;
  $('fitSummary').textContent =
    `Built size ${cfg.usable_width} × ${cfg.built_height} × ${cfg.depth} mm · ${cfg.top_gap ? `${cfg.top_gap} mm open at top` : 'full height covered'}${cfg.rail ? ` · ${cfg.columns.length} sash-channel rail sections` : ''}`;
  $('insulationDepth').textContent = cfg.insulated
    ? `${cfg.depth} mm wall depth gives ${cfg.depth - 5} mm cut thickness for each solid-panel foam core. Stack snug foam layers if needed; seal the back skin.`
    : `${cfg.depth} mm wall depth gives a sealed air cavity. Add rigid foam cores for greater insulation.`;
  const list = $('partList');
  list.replaceChildren();
  $('printTotal').textContent = `${Object.values(quantities).reduce((a, b) => a + b, 0)} pieces`;
  for (const component of components) {
    const card = document.createElement('div');
    card.className = 'part-card';
    card.dataset.part = component.name;
    const top = document.createElement('div');
    top.className = 'part-card-top';
    const title = document.createElement('strong');
    title.textContent = component.label;
    const qty = document.createElement('b');
    qty.textContent = `PRINT × ${component.quantity}`;
    top.append(title, qty);
    const filename = document.createElement('small');
    filename.textContent = `${component.name}.stl`;
    const actions = document.createElement('div');
    actions.className = 'part-actions';
    const inspect = document.createElement('button');
    inspect.type = 'button';
    inspect.className = 'inspect-button';
    inspect.textContent = 'Inspect in 3D';
    inspect.disabled = true;
    inspect.addEventListener('click', () => inspectPart(component));
    const download = document.createElement('button');
    download.type = 'button';
    download.textContent = 'Download STL';
    download.disabled = true;
    download.className = 'component-download';
    download.addEventListener('click', () => downloadPart(component));
    actions.append(inspect, download);
    card.append(top, filename, actions);
    list.append(card);
  }
  const foamList = $('foamList');
  foamList.replaceChildren();
  if (!foamCuts.length) foamList.textContent = 'No foam inserts selected.';
  for (const cut of foamCuts) {
    const row = document.createElement('div');
    const name = document.createElement('span');
    const size = document.createElement('strong');
    name.textContent = `${cut.for} × ${cut.quantity}`;
    size.textContent = `${cut.width} × ${cut.height} × ${cut.thickness} mm`;
    row.append(name, size);
    foamList.append(row);
  }
  $('hardwareSummary').textContent =
    `Hardware: ${hardware.fan_mount_fasteners} fan mounting fasteners · ${hardware.M3_louver_screws} M3 louver screws · ${hardware.M3_panel_lid_screws} M3 panel screws · ${hardware.cover_magnets} magnets (${cfg.magnet_d} × ${cfg.magnet_h} mm) · ${hardware.cover_steel_washers} countersunk steel strike discs (${cfg.strike_d} × ${cfg.strike_h} mm) and ${hardware.M3_strike_washer_screws} countersunk M3 screws · ${hardware.M3_controller_lid_screws} M3 controller screws · ${hardware.sash_gasket_tape_mm} mm sash gasket tape allowance. Choose screw lengths for your prints.`;
  const summary = $('configList');
  summary.replaceChildren();
  const entries = [
    ['Measured opening', `${cfg.width} × ${cfg.height} mm`],
    ['Installation clearance', `${cfg.clearance_x} mm width · ${cfg.clearance_y} mm height`],
    ['Usable opening', `${cfg.usable_width} × ${cfg.usable_height} mm`],
    ['Printed body', `${cfg.usable_width} × ${cfg.built_height} × ${cfg.depth} mm`],
    ['Panel foam core thickness', cfg.insulated ? `${cfg.depth - 5} mm` : 'No foam selected'],
    ['Fan cells', `${cfg.slots} columns × ${cfg.rows} rows`],
    ['Fans to supply', `${cfg.fan_count} × 120 mm`],
    ['Solid cells', `${cfg.solid_count}`],
    ['Controller', cfg.controller === 'none' ? 'None' : `${cfg.controller} side`],
    [
      'Left side panels',
      cfg.left_panels.length ? cfg.left_panels.map((w) => `${w} mm`).join(' + ') : 'None',
    ],
    [
      'Right side panels',
      cfg.right_panels.length ? cfg.right_panels.map((w) => `${w} mm`).join(' + ') : 'None',
    ],
    ['Top rail', cfg.rail ? `${cfg.rail} mm · ${cfg.columns.length} sections` : 'None'],
    [
      'Sash channel',
      cfg.rail
        ? `${cfg.sash_slot_w} mm wide × ${cfg.sash_engagement} mm deep · ${cfg.sash_thickness} mm sash · ${cfg.sash_gasket} mm compressed gasket`
        : 'Inactive; sash cannot seal to array',
    ],
    [
      'Joint clearances',
      `Dovetail ${cfg.dovetail_clearance.toFixed(2)} mm radial · pins ${cfg.pin_clearance.toFixed(2)} mm radial`,
    ],
    ['Output louvers', cfg.louvers ? `${cfg.fan_count} bolt-on parts` : 'None'],
    [
      'Louver hardware',
      cfg.louvers ? `${cfg.louver_screws} M3 screws into rear corner pilot holes` : 'None',
    ],
    [
      'Solid panels',
      cfg.insulated
        ? 'Foam cores and sealed printed back skins'
        : 'Sealed back skins with air cavities',
    ],
    [
      'Fan-off covers',
      cfg.fan_covers ? `${cfg.fan_count} insulated covers · ${cfg.cover_depth} mm deep` : 'None',
    ],
    [
      'Cover closure',
      cfg.fan_covers
        ? `2 top hooks and 2 bottom magnets per cover · ${cfg.magnet_d} × ${cfg.magnet_h} mm magnets · ${cfg.strike_d} × ${cfg.strike_h} mm steel strikes · ${cfg.magnet_clearance} mm pocket clearance · ${cfg.cleat_clearance} mm cleat clearance · ${cfg.gasket_thickness} mm compressed gasket`
        : 'None',
    ],
    ['Unfilled top gap', `${cfg.top_gap} mm`],
    [
      'Rows, bottom to top',
      cfg.pattern
        .split('/')
        .map(
          (row, i) =>
            `R${i + 1}: ${[...row].map((cell) => (cell === 'F' ? 'Fan' : 'Solid')).join(' · ')}`,
        )
        .join(' / '),
    ],
  ];
  for (const [label, value] of entries) {
    const row = document.createElement('div');
    const term = document.createElement('span');
    const detail = document.createElement('strong');
    term.textContent = label;
    detail.textContent = value;
    row.append(term, detail);
    summary.append(row);
  }
}
async function downloadPart(component) {
  if (!currentQuery) return;
  const params = new URLSearchParams(currentQuery);
  params.set('panel_w', component.width);
  params.set('rail_h', component.height);
  params.set('rail_edge', component.edge);
  try {
    const response = await fetch(`/api/model/${component.part}?${params}`);
    if (!response.ok) throw Error((await response.json()).error || 'Download failed');
    const blob = await response.blob();
    const anchor = document.createElement('a');
    anchor.href = URL.createObjectURL(blob);
    anchor.download = `${component.name}.stl`;
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(anchor.href), 1500);
  } catch (error) {
    $('progress').textContent = `STL download failed: ${error.message}`;
  }
}
async function update() {
  const run = ++generation;
  syncPattern();
  $('manualPanels').hidden = $('panel_mode').value !== 'manual';
  $('autoPanels').hidden = $('panel_mode').value !== 'auto';
  $('download').disabled = true;
  const raw = rawConfig();
  try {
    const response = await fetch(`/api/resolve?${query(raw)}`);
    const data = await response.json();
    if (run !== generation) return;
    if (!response.ok) throw Error(data.error || 'Could not size this layout');
    applyNormalized(data.normalized);
    syncPattern();
    showSuggestion();
    panelFocus = '';
    const cfg = data.config;
    current = cfg;
    if (
      (activeSelection?.kind === 'fan' || activeSelection?.kind === 'solid') &&
      activeSelection.row < cfg.rows &&
      activeSelection.slot < cfg.slots
    )
      activeSelection = {
        ...activeSelection,
        kind:
          cfg.pattern.split('/')[activeSelection.row][activeSelection.slot] === 'F'
            ? 'fan'
            : 'solid',
      };
    if (activeSelection?.kind === 'filler') {
      const widths = activeSelection.side === 'left' ? cfg.left_panels : cfg.right_panels;
      activeSelection =
        widths[activeSelection.index] == null
          ? { kind: 'opening' }
          : { ...activeSelection, width: widths[activeSelection.index] };
    }
    if (cfg.controller === 'none') electronicsView = false;
    $('showElectronics').disabled = cfg.controller === 'none';
    $('showElectronics').textContent = electronicsView ? '◩ Hide internals' : '◩ Show internals';
    $('showElectronics').setAttribute('aria-pressed', String(electronicsView));
    currentQuery = query(data.normalized);
    currentComponents = data.components;
    currentMatrixComponents = matrixComponents(data.components, data.foam_cuts);
    $('error').hidden = true;
    $('adjustment').hidden = !data.adjusted.length;
    $('adjustment').textContent = data.adjusted.length
      ? `Adjusted ${data.adjusted.join(', ')} to keep the kit printable in this opening.`
      : '';
    showFit(cfg, data.components, data.quantities, data.foam_cuts, data.hardware);
    if (!cfg.fan_covers) sealedView = false;
    $('sealedView').disabled = !cfg.fan_covers;
    $('sealedView').textContent = sealedView ? '◧ Show running view' : '◧ Show sealed view';
    const inspected =
      previewMode === 'part' &&
      currentMatrixComponents.find((component) => component.name === selectedPartName);
    const needed =
      previewMode === 'explode'
        ? specs(cfg)
        : inspected && inspected.part !== 'foam_core'
          ? [spec(inspected.part, inspected.width, inspected.height, inspected.edge)]
          : visibleSpecs(cfg);
    $('loading').hidden = false;
    if (previewMode === 'assembly') build(cfg);
    if (!(await ensureMeshes(needed, data.normalized, run))) return;
    if (inspected) inspectPart(inspected, true);
    else if (previewMode === 'explode') buildExploded(cfg, currentMatrixComponents);
    else build(cfg);
    document.querySelectorAll('.part-actions button').forEach((button) => {
      button.disabled = false;
    });
    $('loading').hidden = true;
    $('download').disabled = false;
    $('downloadConfig').disabled = false;
    $('progress').textContent = 'Ready to export individual printable parts.';
  } catch (error) {
    if (run !== generation) return;
    current = null;
    currentQuery = null;
    currentComponents = [];
    currentMatrixComponents = [];
    clearAssembly();
    $('explodeLabels').hidden = true;
    $('explodeCatalog').hidden = true;
    document.querySelector('.viewport').classList.remove('exploded-mode');
    $('error').hidden = false;
    $('error').textContent = error.message;
    $('loading').textContent = 'Adjust the layout to preview';
    $('loading').hidden = false;
    $('progress').textContent = 'The generator could not prepare this kit.';
  }
}
let timer;
function schedule(focus = '') {
  generation++;
  current = null;
  currentQuery = null;
  panelFocus = focus;
  $('download').disabled = true;
  $('downloadConfig').disabled = true;
  clearTimeout(timer);
  timer = setTimeout(update, 220);
}
for (const id of [
  'width',
  'height',
  'clearance_x',
  'clearance_y',
  'slots',
  'rows',
  'left_panels',
  'right_panels',
  'rail',
  'depth',
  'sash_slot_w',
  'sash_engagement',
  'sash_thickness',
  'sash_gasket',
  'cover_depth',
  'dovetail_clearance',
  'pin_clearance',
  'magnet_d',
  'magnet_h',
  'strike_d',
  'strike_h',
  'magnet_clearance',
  'cleat_clearance',
  'gasket_thickness',
]) {
  $(id).addEventListener('input', () => {
    generation++;
    clearTimeout(timer);
    current = null;
    currentQuery = null;
    $('download').disabled = true;
    $('downloadConfig').disabled = true;
    document.querySelectorAll('.part-actions button').forEach((button) => {
      button.disabled = true;
    });
    $('progress').textContent = 'Finish editing to update the printable layout.';
  });
  $(id).addEventListener('change', () => schedule(id));
}
for (const id of ['controller', 'side', 'panel_mode', 'louvers', 'insulated', 'fan_covers']) {
  $(id).addEventListener('change', () => {
    if (id === 'panel_mode' && $('panel_mode').value === 'manual' && current) {
      $('left_panels').value = current.left_panels.join(', ');
      $('right_panels').value = current.right_panels.join(', ');
    }
    schedule(id);
  });
}
$('allFans').addEventListener('click', () => {
  pattern = pattern.map((row) => row.map(() => 'F'));
  schedule();
});
$('alternate').addEventListener('click', () => {
  pattern = pattern.map((row, r) => row.map((_, c) => ((r + c) % 2 ? 'S' : 'F')));
  schedule();
});
$('solidColumns').addEventListener('click', () => {
  pattern = pattern.map((row) => row.map((_, c) => (c === 0 || c === row.length - 1 ? 'S' : 'F')));
  schedule();
});
$('addFan').addEventListener('click', () => {
  $('slots').value = Number($('slots').value) + 1;
  schedule();
});
$('resetPanels').addEventListener('click', () => {
  $('panel_mode').value = 'auto';
  schedule();
});
$('fitRail').addEventListener('click', () => {
  let rows = Number($('rows').value);
  let available = Number($('height').value) - Number($('clearance_y').value) - rows * 140;
  if (available < 10 && rows > 1) {
    rows--;
    $('rows').value = rows;
    available = Number($('height').value) - Number($('clearance_y').value) - rows * 140;
  }
  $('rail').value = available >= 10 ? Math.min(available, 100) : 0;
  schedule();
});
$('viewAssembly').addEventListener('click', () => {
  if (current) build(current, true);
});
$('viewExploded').addEventListener('click', async () => {
  if (!current) return;
  const run = generation;
  $('loading').hidden = false;
  try {
    if (
      await ensureMeshes(specs(current), Object.fromEntries(new URLSearchParams(currentQuery)), run)
    )
      buildExploded(current, currentMatrixComponents, true);
  } catch (error) {
    $('progress').textContent = `Exploded preview failed: ${error.message}`;
  }
  $('loading').hidden = true;
});
$('designMode').addEventListener('click', () => {
  setDesignMode(!designMode);
  if (current && previewMode !== 'assembly') build(current);
});
$('advancedSettings').addEventListener('click', () => setDesignMode(!designMode));
$('windowView').addEventListener('click', () => {
  windowVisible = !windowVisible;
  $('windowView').setAttribute('aria-pressed', String(windowVisible));
  $('windowView').textContent = windowVisible ? '▣ Window on' : '▢ Window off';
  if (current && previewMode === 'assembly') rebuildWindow(current);
});
$('windowStyle').addEventListener('change', () => {
  windowStyle = $('windowStyle').value;
  if (current && previewMode === 'assembly') rebuildWindow(current);
});
document.querySelectorAll('[data-example-width]').forEach((button) =>
  button.addEventListener('click', () => {
    $('width').value = button.dataset.exampleWidth;
    schedule('width');
  }),
);
$('closeInspector').addEventListener('click', () => {
  $('designInspector').hidden = true;
});
$('showElectronics').addEventListener('click', () => {
  electronicsView = !electronicsView;
  $('showElectronics').textContent = electronicsView ? '◩ Hide internals' : '◩ Show internals';
  $('showElectronics').setAttribute('aria-pressed', String(electronicsView));
  if (current && previewMode === 'assembly') build(current);
});
$('fanSpeed').addEventListener('input', () => {
  setPreviewSpeed(Number($('fanSpeed').value));
});
$('speedDown').addEventListener('click', () => usePanelButton('slower'));
$('speedPower').addEventListener('click', () => usePanelButton('power'));
$('speedUp').addEventListener('click', () => usePanelButton('faster'));
$('sealedView').addEventListener('click', async () => {
  if (!current || !current.fan_covers) return;
  sealedView = !sealedView;
  $('sealedView').textContent = sealedView ? '◧ Show running view' : '◧ Show sealed view';
  if (previewMode === 'assembly') {
    const run = generation;
    if (sealedView) {
      $('loading').hidden = false;
      try {
        await ensureMeshes(
          [spec('fan_cover'), spec('fan_cover_lid')],
          Object.fromEntries(new URLSearchParams(currentQuery)),
          run,
        );
      } catch (error) {
        $('progress').textContent = `Cover preview failed: ${error.message}`;
      }
      $('loading').hidden = true;
    }
    if (run === generation) build(current);
  }
});
$('downloadConfig').addEventListener('click', async () => {
  if (!currentQuery || !current) return;
  try {
    const response = await fetch(`/api/config?${currentQuery}`);
    if (!response.ok) throw Error((await response.json()).error || 'Download failed');
    const blob = await response.blob();
    const anchor = document.createElement('a');
    anchor.href = URL.createObjectURL(blob);
    anchor.download = `window_fans_${current.width}x${current.height}.json`;
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(anchor.href), 1500);
  } catch (error) {
    $('progress').textContent = `Configuration download failed: ${error.message}`;
  }
});
$('reset').addEventListener('click', resetCamera);
$('wire').addEventListener('click', () => {
  wireframe = !wireframe;
  assembly.traverse((object) => {
    if (object.isMesh) object.material.wireframe = wireframe;
  });
});
$('download').addEventListener('click', async () => {
  if (!currentQuery || !current) return;
  const button = $('download');
  button.disabled = true;
  button.textContent = 'PREPARING STL PACKAGE…';
  $('progress').textContent = 'Rendering and packaging distinct parts; this may take a moment.';
  try {
    const response = await fetch(`/api/export?${currentQuery}`);
    if (!response.ok) throw Error((await response.json()).error || 'Export failed');
    const blob = await response.blob();
    const anchor = document.createElement('a');
    anchor.href = URL.createObjectURL(blob);
    anchor.download = `window_fans_${current.width}x${current.height}.zip`;
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(anchor.href), 1500);
    $('progress').textContent = 'STL package generated with print quantities and dimensions.';
  } catch (error) {
    $('progress').textContent = `Export error: ${error.message}`;
  } finally {
    button.disabled = !currentQuery;
    button.textContent = '⬇   EXPORT PRINTABLE STL KIT';
  }
});
function resize() {
  const rect = viewer.getBoundingClientRect();
  renderer.setSize(rect.width, rect.height);
  camera.aspect = rect.width / rect.height;
  camera.updateProjectionMatrix();
}
new ResizeObserver(resize).observe(viewer);
function renderExplodedLabels() {
  if (previewMode !== 'explode') return;
  const width = viewer.clientWidth,
    height = viewer.clientHeight;
  for (const { element, point } of explodedLabels) {
    const projected = point.clone().project(camera);
    const visible =
      projected.z > -1 &&
      projected.z < 1 &&
      Math.abs(projected.x) < 1.1 &&
      Math.abs(projected.y) < 1.1;
    element.style.display = visible ? '' : 'none';
    if (visible) {
      element.style.left = `${((projected.x + 1) * width) / 2}px`;
      element.style.top = `${((-projected.y + 1) * height) / 2}px`;
    }
  }
}
const raycaster = new THREE.Raycaster();
let clickStart = null;
function pickPreview(event, objects) {
  const rect = renderer.domElement.getBoundingClientRect();
  raycaster.setFromCamera(
    new THREE.Vector2(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      (-(event.clientY - rect.top) / rect.height) * 2 + 1,
    ),
    camera,
  );
  return raycaster.intersectObjects(objects, false)[0];
}
renderer.domElement.addEventListener('pointermove', (event) => {
  if (previewMode !== 'assembly' || clickStart) return;
  const editable =
    designMode &&
    pickPreview(
      event,
      [...assembly.children, ...windowScene.children].filter((object) => object.userData.selection),
    );
  renderer.domElement.style.cursor =
    pickPreview(event, controlButtonTargets) || editable ? 'pointer' : 'grab';
});
renderer.domElement.addEventListener('pointerdown', (event) => {
  clickStart = { x: event.clientX, y: event.clientY };
});
renderer.domElement.addEventListener('pointerup', (event) => {
  if (!clickStart) return;
  const moved = Math.hypot(event.clientX - clickStart.x, event.clientY - clickStart.y);
  clickStart = null;
  if (moved > 5) return;
  if (previewMode === 'assembly') {
    const hit = pickPreview(event, controlButtonTargets);
    if (hit) usePanelButton(hit.object.userData.controlAction);
    else if (designMode) {
      const editable = pickPreview(
        event,
        [...assembly.children, ...windowScene.children].filter(
          (object) => object.userData.selection,
        ),
      );
      selectDesign(editable?.object.userData.selection || { kind: 'opening' }, editable?.object);
    }
  } else if (previewMode === 'explode') {
    const hit = pickPreview(event, assembly.children);
    const component = currentMatrixComponents.find(
      (item) => item.name === hit?.object.userData.componentName,
    );
    if (component) inspectPart(component);
  }
});
const animationClock = new THREE.Clock();
function animate() {
  requestAnimationFrame(animate);
  const delta = Math.min(animationClock.getDelta(), 0.05);
  if (!sealedView && previewMode === 'assembly')
    for (const rotor of fanRotors) rotor.rotation.y += delta * previewSpeed * 0.18;
  controls.update();
  renderExplodedLabels();
  renderer.render(scene, camera);
}
animate();
setDesignMode(true);
update();
