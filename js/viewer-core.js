import * as THREE from 'three';
import { OrbitControls } from 'three/addons/OrbitControls.js';
import { toCreasedNormals } from 'three/addons/BufferGeometryUtils.js';

// Shared stage for the model viewers. Model units are millimetres. +Z = nose, +Y = up, wing spans X.
// Rules that must hold: render on demand only, canvas absolutely positioned inside the host,
// and resize() ignores changes under 2 px.
export { THREE };

const darkQuery = window.matchMedia('(prefers-color-scheme: dark)');
export function isDark() {
  const forced = document.documentElement.dataset.theme;
  return forced ? forced === 'dark' : darkQuery.matches;
}

const VIEWS = {
  iso:   new THREE.Vector3(-0.78, 0.5, 0.95),
  top:   new THREE.Vector3(0, 1, -0.02),
  side:  new THREE.Vector3(1, 0.04, 0),
  front: new THREE.Vector3(0, 0.06, 1)
};

// host: the .viewer container, canvas: its canvas, fit: projected size (mm) of the model per view.
// views: optional camera directions that replace the defaults (iso, top, side, front).
export function createStage({ host, canvas, target, fit, stencil = false, views = {} }) {
  const viewDirs = { ...VIEWS, ...views };
  // Belt and braces: keep the canvas out of the page flow even if CSS fails to load.
  host.style.position = 'relative';
  canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block;touch-action:none';

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, stencil, powerPreference: 'low-power' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.localClippingEnabled = true;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(32, 1.6, 20, 20000);
  scene.add(new THREE.AmbientLight(0xffffff, 0.8));
  const key = new THREE.DirectionalLight(0xffffff, 2.2); key.position.set(-1.2, 2, 1.4); scene.add(key);
  const fill = new THREE.DirectionalLight(0xffffff, 0.7); fill.position.set(1.5, 0.6, -1); scene.add(fill);

  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = false;           // no continuous animation loop
  controls.screenSpacePanning = true;
  controls.minDistance = 500;
  controls.maxDistance = 7000;
  controls.rotateSpeed = 0.8;
  controls.listenToKeyEvents(canvas);

  const stage = { THREE, scene, camera, renderer, controls, target: target.clone(), fit };
  const themeHandlers = [];
  let queued = false;

  stage.requestRender = function () {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => { queued = false; renderer.render(scene, camera); });
  };
  controls.addEventListener('change', stage.requestRender);

  // fn(dark) recolours the materials; the stage handles the background.
  stage.onTheme = fn => themeHandlers.push(fn);
  stage.applyTheme = function () {
    const surface = getComputedStyle(document.documentElement).getPropertyValue('--surface').trim() || '#f6f7f8';
    scene.background = new THREE.Color(surface);
    const dark = isDark();
    themeHandlers.forEach(fn => fn(dark));
    stage.requestRender();
  };

  // Creased normals at 35 degrees plus edge lines. Returns the edge material so it can be themed.
  stage.addBody = function (geometry, material, group) {
    const g = toCreasedNormals(geometry, THREE.MathUtils.degToRad(35));
    const mesh = new THREE.Mesh(g, material);
    const edgeMat = new THREE.LineBasicMaterial({ transparent: true });
    if (material.clippingPlanes) edgeMat.clippingPlanes = material.clippingPlanes;
    const edges = new THREE.LineSegments(new THREE.EdgesGeometry(g, 35), edgeMat);
    group.add(mesh, edges);
    return { mesh, edges, edgeMat, geometry: g };
  };

  function fitDistance(name) {
    const aspect = host.clientWidth / Math.max(host.clientHeight, 1);
    const k = 2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    const [w, h] = stage.fit[name] || stage.fit.iso;
    return Math.max(w / (k * aspect), h / k) * 1.08;
  }

  let viewName = 'iso', fitRef = 0;
  stage.setView = function (name) {
    viewName = viewDirs[name] ? name : 'iso';
    const dir = viewDirs[viewName].clone().normalize();
    fitRef = fitDistance(viewName);
    camera.position.copy(stage.target).addScaledVector(dir, fitRef);
    controls.target.copy(stage.target);
    camera.lookAt(stage.target);
    controls.update();
    stage.requestRender();
  };

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
    const f = fitDistance(viewName);
    if (fitRef) {
      const offset = camera.position.clone().sub(controls.target).multiplyScalar(f / fitRef);
      camera.position.copy(controls.target).add(offset);
      controls.update();
    }
    fitRef = f;
    stage.requestRender();
  }

  // Call once the model is in the scene.
  stage.start = function () {
    stage.applyTheme();
    darkQuery.addEventListener('change', stage.applyTheme);
    document.addEventListener('themechange', stage.applyTheme);
    new ResizeObserver(resize).observe(host);
    resize();
    stage.setView('iso');
  };

  addFullscreen(host);
  return stage;
}

// Full screen for the viewer and its controls (host's parent). Uses the Fullscreen API where it
// exists and a fixed overlay otherwise (iPhone Safari), so it works everywhere. Added to every
// stage automatically, so any new viewer gets it.
function addFullscreen(host) {
  const wrap = host.parentElement;
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'viewer-fs-btn';
  btn.style.cssText = 'position:absolute;top:8px;right:8px;z-index:2';
  host.appendChild(btn);

  let active = false;
  function paint() {
    btn.textContent = active ? 'Exit full screen' : 'Full screen';
    btn.setAttribute('aria-label', btn.textContent);
  }
  function enter() {
    active = true;
    wrap.classList.add('viewer-wrap-full');
    document.documentElement.classList.add('viewer-full');
    if (wrap.requestFullscreen) wrap.requestFullscreen().catch(() => {});   // overlay still works if refused
    paint();
  }
  function exit() {
    active = false;
    wrap.classList.remove('viewer-wrap-full');
    document.documentElement.classList.remove('viewer-full');
    if (document.fullscreenElement === wrap) document.exitFullscreen().catch(() => {});
    paint();
  }
  btn.addEventListener('click', () => (active ? exit() : enter()));
  document.addEventListener('keydown', e => { if (active && e.key === 'Escape') exit(); });
  document.addEventListener('fullscreenchange', () => {
    if (active && document.fullscreenElement !== wrap) exit();   // user left with the browser's own control
  });
  paint();
}

// Wires the camera view buttons inside root.
export function bindViewButtons(root, stage) {
  root.querySelectorAll('[data-view]').forEach(btn =>
    btn.addEventListener('click', () => stage.setView(btn.dataset.view)));
}
