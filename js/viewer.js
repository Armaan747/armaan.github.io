import * as THREE from 'three';
import { OrbitControls } from 'three/addons/OrbitControls.js';
import { STLLoader } from 'three/addons/STLLoader.js';
import { toCreasedNormals } from 'three/addons/BufferGeometryUtils.js';

// Model units are millimetres. +Z = nose, +Y = up, wing spans X.
// The tail group slides toward -Z by up to STROKE mm.
const STROKE = 200;
const ARM_MIN = 790;          // mm, retracted tail arm (from the paper)
const VHT_MIN = 0.36, VHT_MAX = 0.44;
const TARGET = new THREE.Vector3(0, 20, -300);

const host = document.getElementById('viewer');
const canvas = document.getElementById('viewer-canvas');
const statusEl = document.getElementById('viewer-status');
const slider = document.getElementById('ext');
const outExt = document.getElementById('out-ext');
const outArm = document.getElementById('out-arm');
const outVht = document.getElementById('out-vht');

const darkQuery = window.matchMedia('(prefers-color-scheme: dark)');
const THEMES = {
  light: { fixed: 0xc9cdd3, tail: 0x9db2d2, edge: 0x3d444c, edgeOpacity: 0.35 },
  dark:  { fixed: 0x858c94, tail: 0x6b8fc2, edge: 0xdfe3e7, edgeOpacity: 0.22 }
};

let renderer, scene, camera, controls;
let fixedMat, tailMat, edgeMats = [];
let tailGroup;
let queued = false;

function requestRender() {
  if (queued || !renderer) return;
  queued = true;
  requestAnimationFrame(() => { queued = false; renderer.render(scene, camera); });
}

function applyTheme() {
  const forced = document.documentElement.dataset.theme;
  const t = (forced ? forced === 'dark' : darkQuery.matches) ? THEMES.dark : THEMES.light;
  const surface = getComputedStyle(document.documentElement).getPropertyValue('--surface').trim() || '#f6f7f8';
  scene.background = new THREE.Color(surface);
  fixedMat.color.setHex(t.fixed);
  tailMat.color.setHex(t.tail);
  edgeMats.forEach(m => { m.color.setHex(t.edge); m.opacity = t.edgeOpacity; });
  requestRender();
}

function build(geometry, material, group) {
  const g = toCreasedNormals(geometry, THREE.MathUtils.degToRad(35));
  const mesh = new THREE.Mesh(g, material);
  const edgeMat = new THREE.LineBasicMaterial({ transparent: true });
  edgeMats.push(edgeMat);
  const edges = new THREE.LineSegments(new THREE.EdgesGeometry(g, 35), edgeMat);
  group.add(mesh, edges);
}

// Approximate projected size (mm) of the model in each view, used to frame it.
const FIT = { iso: [1850, 1100], top: [2000, 1900], side: [1950, 450], front: [2150, 500] };

function fitDistance(name) {
  const aspect = host.clientWidth / Math.max(host.clientHeight, 1);
  const k = 2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
  const [w, h] = FIT[name] || FIT.iso;
  return Math.max(w / (k * aspect), h / k) * 1.08;
}

const VIEWS = {
  iso:   new THREE.Vector3(-0.78, 0.5, 0.95),
  top:   new THREE.Vector3(0, 1, -0.02),
  side:  new THREE.Vector3(1, 0.04, 0),
  front: new THREE.Vector3(0, 0.06, 1)
};

function setView(name) {
  const dir = (VIEWS[name] || VIEWS.iso).clone().normalize();
  camera.position.copy(TARGET).addScaledVector(dir, fitDistance(VIEWS[name] ? name : 'iso'));
  controls.target.copy(TARGET);
  camera.lookAt(TARGET);
  controls.update();
  requestRender();
}

function setExtension(mm) {
  const e = Math.min(STROKE, Math.max(0, Number(mm) || 0));
  if (tailGroup) tailGroup.position.z = -e;
  const arm = ARM_MIN + e;
  const vht = VHT_MIN + (VHT_MAX - VHT_MIN) * (e / STROKE);
  outExt.textContent = e.toFixed(0) + ' mm';
  outArm.textContent = arm.toFixed(0) + ' mm';
  outVht.textContent = vht.toFixed(2);
  slider.value = String(e);
  slider.setAttribute('aria-valuetext', `${e.toFixed(0)} millimetres extended, tail volume coefficient ${vht.toFixed(2)}`);
  requestRender();
}

let lastW = 0, lastH = 0;
function resize() {
  const r = host.getBoundingClientRect();
  const w = Math.round(r.width), h = Math.round(r.height);
  if (!w || !h) return;
  if (Math.abs(w - lastW) < 2 && Math.abs(h - lastH) < 2) return;   // ignore feedback / tiny changes
  lastW = w; lastH = h;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  requestRender();
}

async function init() {
  // Belt and braces: keep the canvas out of the page flow even if CSS fails to load.
  host.style.position = 'relative';
  canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block;touch-action:none';
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'low-power' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));

  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(32, 1.6, 20, 20000);

  scene.add(new THREE.AmbientLight(0xffffff, 0.8));
  const key = new THREE.DirectionalLight(0xffffff, 2.2); key.position.set(-1.2, 2, 1.4); scene.add(key);
  const fill = new THREE.DirectionalLight(0xffffff, 0.7); fill.position.set(1.5, 0.6, -1); scene.add(fill);

  const common = { roughness: 0.9, metalness: 0, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 };
  fixedMat = new THREE.MeshStandardMaterial(common);
  tailMat = new THREE.MeshStandardMaterial({ ...common, side: THREE.DoubleSide });

  controls = new OrbitControls(camera, canvas);
  controls.enableDamping = false;           // no continuous animation loop
  controls.screenSpacePanning = true;
  controls.minDistance = 500;
  controls.maxDistance = 7000;
  controls.rotateSpeed = 0.8;
  controls.listenToKeyEvents(canvas);
  controls.addEventListener('change', requestRender);

  const loader = new STLLoader();
  const [fixedGeo, tailGeo] = await Promise.all([
    loader.loadAsync('models/uav_fixed.stl'),
    loader.loadAsync('models/uav_tail.stl')
  ]);
  const fixedGroup = new THREE.Group();
  tailGroup = new THREE.Group();
  build(fixedGeo, fixedMat, fixedGroup);
  build(tailGeo, tailMat, tailGroup);
  scene.add(fixedGroup, tailGroup);

  applyTheme();
  darkQuery.addEventListener('change', applyTheme);
  document.addEventListener('themechange', applyTheme);
  new ResizeObserver(resize).observe(host);
  resize();
  setView('iso');
  setExtension(Number(slider.value) || 0);

  slider.addEventListener('input', () => setExtension(slider.value));
  document.querySelectorAll('[data-view]').forEach(btn =>
    btn.addEventListener('click', () => setView(btn.dataset.view)));

  statusEl.hidden = true;
  window.__viewer = { setExtension, setView };
  window.__viewerReady = true;
}

init().catch(err => {
  console.error(err);
  statusEl.hidden = false;
  statusEl.textContent = 'The 3D viewer could not start in this browser. The rest of the page is unaffected.';
});
