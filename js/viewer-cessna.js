import { THREE, createStage, bindViewButtons } from './viewer-core.js?v=11';
import { STLLoader } from 'three/addons/STLLoader.js';

// RC Cessna 172, nose at +Z, up +Y, aircraft left wing at +X.
// Two section sliders, only one active at a time (moving one switches the other off):
//   cross-section: plane perpendicular to Z, measured from the nose tip toward the tail.
//   side section:  plane parallel to the right (YZ) plane, measured from the left wingtip across the span.
// Everything on the near side of the plane is removed and the cut is capped with a flat colour
// using the stencil buffer, so the model must be closed solids.
const host = document.getElementById('cessna-viewer');
const canvas = document.getElementById('cessna-canvas');
const statusEl = document.getElementById('cessna-status');
const sliderZ = document.getElementById('cessna-sec');
const outZ = document.getElementById('cessna-out-sec');
const sliderX = document.getElementById('cessna-sec-x');
const outX = document.getElementById('cessna-out-sec-x');

const THEMES = {
  light: { body: 0xc9cdd3, cap: 0x9db2d2, edge: 0x3d444c, edgeOpacity: 0.35 },
  dark:  { body: 0x858c94, cap: 0x6b8fc2, edge: 0xdfe3e7, edgeOpacity: 0.22 }
};
const OFF = 1e6;              // plane constant that keeps everything

let stage, planeZ, planeX, capZ, capX, stencilMeshes;
let zNose = 0, xLeft = 0;

function showCut(slider, out, plane, cap, edge, dist, what) {
  const d = Math.min(Number(slider.max), Math.max(0, Number(dist) || 0));
  const on = d > 0;
  slider.value = String(d);
  plane.constant = on ? edge - d : OFF;
  cap.visible = on;
  if (on) cap.position[cap.userData.axis] = edge - d;
  out.textContent = on ? d.toFixed(0) + ' mm from ' + what : 'Off';
  slider.setAttribute('aria-valuetext', on ? `Section ${d.toFixed(0)} millimetres from the ${what}` : 'Section off');
  return on;
}

function setSection(dist) {
  const on = showCut(sliderZ, outZ, planeZ, capZ, zNose, dist, 'nose');
  if (on) showCut(sliderX, outX, planeX, capX, xLeft, 0, 'left wingtip');
  stencilMeshes.forEach(m => { m.visible = on || capX.visible; });
  stage.requestRender();
}

function setSectionX(dist) {
  const on = showCut(sliderX, outX, planeX, capX, xLeft, dist, 'left wingtip');
  if (on) showCut(sliderZ, outZ, planeZ, capZ, zNose, 0, 'nose');
  stencilMeshes.forEach(m => { m.visible = on || capZ.visible; });
  stage.requestRender();
}

async function init() {
  // The iso camera sits on the left side so it also sees the cut face of the side section.
  stage = createStage({
    host, canvas, target: new THREE.Vector3(), fit: {}, stencil: true,
    views: { iso: new THREE.Vector3(0.78, 0.5, 0.95) }
  });
  planeZ = new THREE.Plane(new THREE.Vector3(0, 0, -1), OFF);   // keeps z <= constant
  planeX = new THREE.Plane(new THREE.Vector3(-1, 0, 0), OFF);   // keeps x <= constant
  const planes = [planeZ, planeX];

  const common = { roughness: 0.9, metalness: 0, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1, clippingPlanes: planes };
  const bodyMat = new THREE.MeshStandardMaterial(common);

  const geo = await new STLLoader().loadAsync('models/cessna172.stl');
  geo.computeBoundingBox();
  const bb = geo.boundingBox;
  const size = bb.getSize(new THREE.Vector3());
  const center = bb.getCenter(new THREE.Vector3());
  stage.target.copy(center);
  stage.fit = {
    iso: [size.x * 0.95, size.z * 0.5 + size.y * 0.9],
    top: [size.x * 1.1, size.z * 1.1],
    side: [size.z * 1.2, size.y * 1.3],
    front: [size.x * 1.1, size.y * 1.3]
  };
  zNose = bb.max.z;
  xLeft = bb.max.x;
  stage.controls.minDistance = size.length() * 0.3;
  stage.controls.maxDistance = size.length() * 4;

  const group = new THREE.Group();
  const body = stage.addBody(geo, bodyMat, group);
  body.mesh.renderOrder = 6;
  body.edges.renderOrder = 6;

  // Stencil: back faces add, front faces subtract. Where the count is non-zero the plane cuts solid material.
  const stencilBase = {
    depthWrite: false, depthTest: false, colorWrite: false, stencilWrite: true,
    stencilFunc: THREE.AlwaysStencilFunc, clippingPlanes: planes
  };
  const back = new THREE.MeshBasicMaterial({
    ...stencilBase, side: THREE.BackSide,
    stencilFail: THREE.IncrementWrapStencilOp, stencilZFail: THREE.IncrementWrapStencilOp, stencilZPass: THREE.IncrementWrapStencilOp
  });
  const front = new THREE.MeshBasicMaterial({
    ...stencilBase, side: THREE.FrontSide,
    stencilFail: THREE.DecrementWrapStencilOp, stencilZFail: THREE.DecrementWrapStencilOp, stencilZPass: THREE.DecrementWrapStencilOp
  });
  stencilMeshes = [new THREE.Mesh(body.geometry, back), new THREE.Mesh(body.geometry, front)];
  stencilMeshes.forEach(m => { m.renderOrder = 1; m.visible = false; group.add(m); });

  const capMat = new THREE.MeshStandardMaterial({
    roughness: 0.9, metalness: 0, side: THREE.DoubleSide,
    stencilWrite: true, stencilRef: 0, stencilFunc: THREE.NotEqualStencilFunc,
    stencilFail: THREE.ReplaceStencilOp, stencilZFail: THREE.ReplaceStencilOp, stencilZPass: THREE.ReplaceStencilOp
  });
  function makeCap(width, axis) {
    const cap = new THREE.Mesh(new THREE.PlaneGeometry(width, size.y * 3), capMat);
    cap.userData.axis = axis;
    cap.position.copy(center);
    cap.renderOrder = 1.1;
    cap.visible = false;
    cap.onAfterRender = renderer => renderer.clearStencil();
    group.add(cap);
    return cap;
  }
  capZ = makeCap(size.x * 1.5, 'z');                  // plane faces +Z
  capX = makeCap(size.z * 1.5, 'x');                  // plane faces +X
  capX.rotation.y = Math.PI / 2;
  stage.scene.add(group);

  stage.onTheme(dark => {
    const t = dark ? THEMES.dark : THEMES.light;
    bodyMat.color.setHex(t.body);
    capMat.color.setHex(t.cap);
    body.edgeMat.color.setHex(t.edge);
    body.edgeMat.opacity = t.edgeOpacity;
  });
  stage.start();

  sliderZ.max = String(Math.round(size.z));
  sliderX.max = String(Math.round(size.x));
  setSection(Number(sliderZ.value) || 0);
  setSectionX(Number(sliderX.value) || 0);
  sliderZ.addEventListener('input', () => setSection(sliderZ.value));
  sliderX.addEventListener('input', () => setSectionX(sliderX.value));
  bindViewButtons(host.parentElement, stage);

  statusEl.hidden = true;
  statusEl.dataset.ready = '1';
  window.__cessna = { setSection, setSectionX, setView: stage.setView };
}

init().catch(err => {
  console.error(err);
  statusEl.dataset.failed = '1';
  statusEl.hidden = false;
  statusEl.textContent = 'The 3D viewer could not start in this browser. The rest of the page is unaffected.';
});
