import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { STLLoader } from 'three/addons/loaders/STLLoader.js';

const $ = id => document.getElementById(id);
const viewer = $('viewer');
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(40, 1, 1, 8000);
camera.up.set(0, 0, 1);
const renderer = new THREE.WebGLRenderer({antialias: true, alpha: true});
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
viewer.prepend(renderer.domElement);
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = .08;
scene.add(new THREE.HemisphereLight(0xffffff, 0x506070, 2.6));
const front = new THREE.DirectionalLight(0xffffff, 2.5);
front.position.set(-250, -500, 800);
scene.add(front);
const back = new THREE.DirectionalLight(0xaac5fa, 1.3);
back.position.set(450, 300, 350);
scene.add(back);
const assembly = new THREE.Group();
scene.add(assembly);
const loader = new STLLoader();
const geometries = new Map();
let current = null;
let currentQuery = null;
let currentComponents = [];
let generation = 0;
let wireframe = false;
let previewMode = 'assembly';
let selectedPartName = null;
let cameraFramed = false;
let lastAssemblyCenter = null;
let panelFocus = '';
let pattern = [['F', 'F', 'F'], ['F', 'F', 'F']];
const colors = {fan: 0x4b8ca1, grill: 0xb1c5cf, controller: 0x8acba7,
  controller_lid: 0x617b72, controller_blank: 0x9a886d, spacer: 0xa38b67,
  filler: 0xa38b67, left_cap: 0xb69b75, right_cap: 0xb69b75, top_rail: 0xb28bc8};

function rawConfig() {
  return {
    width: $('width').value, height: $('height').value,
    slots: $('slots').value, rows: $('rows').value,
    clearance_x: $('clearance_x').value, clearance_y: $('clearance_y').value,
    controller: $('controller').value, side: $('side').value,
    panel_mode: $('panel_mode').value,
    left_panels: $('left_panels').value, right_panels: $('right_panels').value,
    rail: $('rail').value, pattern: pattern.map(row => row.join('')).join('/'),
    panel_focus: panelFocus
  };
}
function applyNormalized(raw) {
  for (const id of ['width', 'height', 'slots', 'rows', 'clearance_x', 'clearance_y', 'controller', 'side', 'panel_mode', 'left_panels', 'right_panels', 'rail']) {
    $(id).value = raw[id];
  }
  pattern = raw.pattern.split('/').map(row => [...row]);
}
function query(raw) { return new URLSearchParams(raw).toString(); }
function spec(part, width = 0, height = 0, edge = 'middle') { return {part, width, height, edge}; }
function key(item) { return `${item.part}:${item.width}:${item.height}:${item.edge}`; }
function specs(cfg) {
  const found = new Map();
  const add = item => found.set(key(item), item);
  add(spec('left_cap')); add(spec('right_cap'));
  if (cfg.fan_count) { add(spec('fan')); add(spec('grill')); }
  if (cfg.solid_count) add(spec('spacer'));
  if (cfg.controller !== 'none') {
    add(spec('controller')); add(spec('controller_lid'));
    if (cfg.rows > 1) add(spec('controller_blank'));
  }
  for (const width of [...cfg.left_panels, ...cfg.right_panels]) add(spec('filler', width));
  if (cfg.rail) cfg.columns.forEach((column, i) => {
    const edge = i === 0 ? 'left' : i === cfg.columns.length - 1 ? 'right' : 'middle';
    add(spec('top_rail', column[1], cfg.rail, edge));
  });
  return [...found.values()];
}
function syncPattern() {
  const rows = Math.max(1, Math.min(8, Number($('rows').value) || 1));
  const slots = Math.max(1, Math.min(20, Number($('slots').value) || 1));
  pattern = Array.from({length: rows}, (_, r) => Array.from({length: slots}, (_, c) => pattern[r]?.[c] || 'F'));
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
  if (possible) $('suggestionText').textContent = `This opening can fit another 140 mm fan column${after ? ` with ${after} mm left for side panels` : ' exactly'}.`;
}
function clearAssembly() {
  while (assembly.children.length) {
    const child = assembly.children[0];
    assembly.remove(child);
    child.material.dispose();
  }
}
function material(part) {
  return new THREE.MeshStandardMaterial({color: colors[part] || 0x8c9ca8,
    metalness: .15, roughness: .65, side: THREE.DoubleSide, wireframe});
}
function addPart(item, x, z) {
  const geometry = geometries.get(key(item));
  if (!geometry) return;
  const mesh = new THREE.Mesh(geometry, material(item.part));
  mesh.position.set(x, 0, z);
  assembly.add(mesh);
}
function resetCamera() {
  if (!current) return;
  if (previewMode === 'part' && assembly.children.length) {
    const bounds = new THREE.Box3().setFromObject(assembly);
    const center = bounds.getCenter(new THREE.Vector3());
    const size = bounds.getSize(new THREE.Vector3());
    controls.target.copy(center);
    camera.position.set(center.x, center.y - Math.max(200, size.x * 2.2, size.z * 2.2), center.z + Math.max(90, size.z * .8));
    camera.updateProjectionMatrix();
    controls.update();
    return;
  }
  const width = current.usable_width, height = current.built_height;
  controls.target.set(width / 2, -5, height / 2);
  camera.position.set(width / 2, -Math.max(500, width * .85), height / 2 + Math.max(180, height * .48));
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
function build(cfg) {
  const wasAssembly = previewMode === 'assembly';
  const center = new THREE.Vector3(cfg.usable_width / 2, -5, cfg.built_height / 2);
  previewMode = 'assembly';
  selectedPartName = null;
  clearAssembly();
  const rows = cfg.pattern.split('/');
  for (let r = 0; r < cfg.rows; r++) {
    let x = 0, slot = 0;
    for (const [kind, width] of cfg.columns) {
      const center = x + width / 2;
      if (kind === 'slot') {
        if (rows[r][slot] === 'F') {
          addPart(spec('fan'), center, r * 140);
          addPart(spec('grill'), center, r * 140);
        } else addPart(spec('spacer'), center, r * 140);
        slot++;
      } else if (kind === 'controller') {
        addPart(spec(r === 0 ? 'controller' : 'controller_blank'), center, r * 140);
        if (r === 0) addPart(spec('controller_lid'), center, 0);
      } else if (kind === 'filler') addPart(spec('filler', width), center, r * 140);
      else addPart(spec(kind), center, r * 140);
      x += width;
    }
  }
  if (cfg.rail) {
    let x = 0;
    cfg.columns.forEach((column, i) => {
      const width = column[1];
      const edge = i === 0 ? 'left' : i === cfg.columns.length - 1 ? 'right' : 'middle';
      addPart(spec('top_rail', width, cfg.rail, edge), x + width / 2, cfg.rows * 140);
      x += width;
    });
  }
  $('heading').textContent = `${cfg.fan_count} FANS · ${cfg.solid_count} SOLID · ${cfg.rows} ROW${cfg.rows === 1 ? '' : 'S'}`;
  document.querySelectorAll('.part-card').forEach(card => card.classList.remove('selected'));
  if (!cameraFramed) {
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
}
function inspectPart(component, preserveView = false) {
  if (!current) return;
  const item = spec(component.part, component.width, component.height, component.edge);
  if (!geometries.has(key(item))) return;
  clearAssembly();
  previewMode = 'part';
  selectedPartName = component.name;
  addPart(item, 0, 0);
  $('heading').textContent = component.label.toUpperCase();
  document.querySelectorAll('.part-card').forEach(card => card.classList.toggle('selected', card.dataset.part === component.name));
  if (!preserveView) resetCamera();
}
async function getPart(item, raw) {
  const id = key(item);
  if (geometries.has(id)) return geometries.get(id);
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
}
function showFit(cfg, components, quantities) {
  $('total').textContent = cfg.fan_count;
  $('solidTotal').textContent = cfg.solid_count;
  $('panelTotal').textContent = cfg.left_panels.length + cfg.right_panels.length;
  $('topGap').textContent = `${cfg.top_gap} mm`;
  $('panelSummary').textContent = `Left: ${cfg.left_panels.length ? `${cfg.left_panels.join(' + ')} mm` : 'none'}  ·  Right: ${cfg.right_panels.length ? `${cfg.right_panels.join(' + ')} mm` : 'none'}`;
  $('fitSummary').textContent = `Built size ${cfg.usable_width} × ${cfg.built_height} mm · ${cfg.top_gap ? `${cfg.top_gap} mm open at top` : 'full height covered'}${cfg.rail ? ` · ${cfg.columns.length} top rail sections` : ''}`;
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
  const summary = $('configList');
  summary.replaceChildren();
  const entries = [
    ['Measured opening', `${cfg.width} × ${cfg.height} mm`],
    ['Installation clearance', `${cfg.clearance_x} mm width · ${cfg.clearance_y} mm height`],
    ['Usable opening', `${cfg.usable_width} × ${cfg.usable_height} mm`],
    ['Printed footprint', `${cfg.usable_width} × ${cfg.built_height} mm`],
    ['Fan cells', `${cfg.slots} columns × ${cfg.rows} rows`],
    ['Fans to supply', `${cfg.fan_count} × 120 mm`],
    ['Solid cells', `${cfg.solid_count}`],
    ['Controller', cfg.controller === 'none' ? 'None' : `${cfg.controller} side`],
    ['Left side panels', cfg.left_panels.length ? cfg.left_panels.map(w => `${w} mm`).join(' + ') : 'None'],
    ['Right side panels', cfg.right_panels.length ? cfg.right_panels.map(w => `${w} mm`).join(' + ') : 'None'],
    ['Top rail', cfg.rail ? `${cfg.rail} mm · ${cfg.columns.length} sections` : 'None'],
    ['Unfilled top gap', `${cfg.top_gap} mm`],
    ['Rows, bottom to top', cfg.pattern.split('/').map((row, i) => `R${i + 1}: ${[...row].map(cell => cell === 'F' ? 'Fan' : 'Solid').join(' · ')}`).join(' / ')]
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
    currentQuery = query(data.normalized);
    currentComponents = data.components;
    $('error').hidden = true;
    $('adjustment').hidden = !data.adjusted.length;
    $('adjustment').textContent = data.adjusted.length ? `Adjusted ${data.adjusted.join(', ')} to keep the kit printable in this opening.` : '';
    showFit(cfg, data.components, data.quantities);
    const needed = specs(cfg);
    $('loading').hidden = false;
    for (let i = 0; i < needed.length; i++) {
      if (run !== generation) return;
      const item = needed[i];
      $('loading').textContent = `Generating mesh ${i + 1} / ${needed.length}: ${item.part}${item.width ? ` ${item.width} mm` : ''}`;
      await getPart(item, data.normalized);
    }
    if (run !== generation) return;
    const inspected = previewMode === 'part' && data.components.find(component => component.name === selectedPartName);
    if (inspected) inspectPart(inspected, true);
    else build(cfg);
    document.querySelectorAll('.part-actions button').forEach(button => { button.disabled = false; });
    $('loading').hidden = true;
    $('download').disabled = false;
    $('downloadConfig').disabled = false;
    $('progress').textContent = 'Ready to export individual printable parts.';
  } catch (error) {
    if (run !== generation) return;
    current = null;
    currentQuery = null;
    currentComponents = [];
    clearAssembly();
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
for (const id of ['width', 'height', 'clearance_x', 'clearance_y', 'slots', 'rows', 'left_panels', 'right_panels', 'rail']) {
  $(id).addEventListener('input', () => {
    generation++;
    clearTimeout(timer);
    current = null;
    currentQuery = null;
    $('download').disabled = true;
    $('downloadConfig').disabled = true;
    document.querySelectorAll('.part-actions button').forEach(button => { button.disabled = true; });
    $('progress').textContent = 'Finish editing to update the printable layout.';
  });
  $(id).addEventListener('change', () => schedule(id));
}
for (const id of ['controller', 'side', 'panel_mode']) {
  $(id).addEventListener('change', () => {
    if (id === 'panel_mode' && $('panel_mode').value === 'manual' && current) {
      $('left_panels').value = current.left_panels.join(', ');
      $('right_panels').value = current.right_panels.join(', ');
    }
    schedule(id);
  });
}
$('allFans').addEventListener('click', () => { pattern = pattern.map(row => row.map(() => 'F')); schedule(); });
$('alternate').addEventListener('click', () => { pattern = pattern.map((row, r) => row.map((_, c) => (r + c) % 2 ? 'S' : 'F')); schedule(); });
$('solidColumns').addEventListener('click', () => { pattern = pattern.map(row => row.map((_, c) => c === 0 || c === row.length - 1 ? 'S' : 'F')); schedule(); });
$('addFan').addEventListener('click', () => { $('slots').value = Number($('slots').value) + 1; schedule(); });
$('resetPanels').addEventListener('click', () => { $('panel_mode').value = 'auto'; schedule(); });
$('fitRail').addEventListener('click', () => {
  const available = Number($('height').value) - Number($('clearance_y').value) - Number($('rows').value) * 140;
  $('rail').value = available >= 7 ? Math.min(available, 100) : 0;
  schedule();
});
$('viewAssembly').addEventListener('click', () => { if (current) build(current); });
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
  assembly.traverse(object => { if (object.isMesh) object.material.wireframe = wireframe; });
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
function animate() { requestAnimationFrame(animate); controls.update(); renderer.render(scene, camera); }
animate();
update();
