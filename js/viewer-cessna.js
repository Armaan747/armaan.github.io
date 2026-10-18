import { THREE, createStage, bindViewButtons } from './viewer-core.js?v=9';
import { STLLoader } from 'three/addons/STLLoader.js';

// RC Cessna 172. The section slider moves a cutting plane perpendicular to Z, from the nose
// tip (0 mm, no cut) toward the tail. Everything nose-side of the plane is removed and the
// cut is capped with a flat colour using the stencil buffer, so the model must be closed solids.
const host = document.getElementById('cessna-viewer');
const canvas = document.getElementById('cessna-canvas');
const statusEl = document.getElementById('cessna-status');
const slider = document.getElementById('cessna-sec');
const outSec = document.getElementById('cessna-out-sec');

const THEMES = {
  light: { body: 0xc9cdd3, cap: 0x9db2d2, edge: 0x3d444c, edgeOpacity: 0.35 },
  dark:  { body: 0x858c94, cap: 0x6b8fc2, edge: 0xdfe3e7, edgeOpacity: 0.22 }
};
const OFF = 1e6;              // plane constant that keeps everything

let stage, plane, cap, zNose = 0;

function setSection(d) {
  const dist = Math.min(Number(slider.max), Math.max(0, Number(d) || 0));
  slider.value = String(dist);
  const on = dist > 0;
  // Plane keeps z <= zNose - dist (the tail side).
  plane.constant = on ? zNose - dist : OFF;
  cap.visible = on;
  cap.position.z = zNose - dist;
  outSec.textContent = on ? dist.toFixed(0) + ' mm from nose' : 'Off';
  slider.setAttribute('aria-valuetext', on ? `Section ${dist.toFixed(0)} millimetres behind the nose` : 'Section off');
  stage.requestRender();
}

async function init() {
  stage = createStage({ host, canvas, target: new THREE.Vector3(), fit: {}, stencil: true });
  plane = new THREE.Plane(new THREE.Vector3(0, 0, -1), OFF);

  const common = { roughness: 0.9, metalness: 0, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1, clippingPlanes: [plane] };
  const bodyMat = new THREE.MeshStandardMaterial(common);

  const geo = await new STLLoader().loadAsync('models/cessna172.stl');
  geo.computeBoundingBox();
  const bb = geo.boundingBox;
  const size = bb.getSize(new THREE.Vector3());
  stage.target.copy(bb.getCenter(new THREE.Vector3()));
  stage.fit = {
    iso: [size.x * 0.95, size.z * 0.5 + size.y * 0.9],
    top: [size.x * 1.1, size.z * 1.1],
    side: [size.z * 1.2, size.y * 1.3],
    front: [size.x * 1.1, size.y * 1.3]
  };
  zNose = bb.max.z;
  stage.controls.minDistance = size.length() * 0.3;
  stage.controls.maxDistance = size.length() * 4;

  const group = new THREE.Group();
  const body = stage.addBody(geo, bodyMat, group);
  body.mesh.renderOrder = 6;
  body.edges.renderOrder = 6;

  // Stencil: back faces add, front faces subtract. Where the count is non-zero the plane cuts solid material.
  const stencilBase = {
    depthWrite: false, depthTest: false, colorWrite: false, stencilWrite: true,
    stencilFunc: THREE.AlwaysStencilFunc, clippingPlanes: [plane]
  };
  const back = new THREE.MeshBasicMaterial({
    ...stencilBase, side: THREE.BackSide,
    stencilFail: THREE.IncrementWrapStencilOp, stencilZFail: THREE.IncrementWrapStencilOp, stencilZPass: THREE.IncrementWrapStencilOp
  });
  const front = new THREE.MeshBasicMaterial({
    ...stencilBase, side: THREE.FrontSide,
    stencilFail: THREE.DecrementWrapStencilOp, stencilZFail: THREE.DecrementWrapStencilOp, stencilZPass: THREE.DecrementWrapStencilOp
  });
  const backMesh = new THREE.Mesh(body.geometry, back);
  const frontMesh = new THREE.Mesh(body.geometry, front);
  backMesh.renderOrder = frontMesh.renderOrder = 1;
  group.add(backMesh, frontMesh);

  const capMat = new THREE.MeshStandardMaterial({
    roughness: 0.9, metalness: 0, side: THREE.DoubleSide,
    stencilWrite: true, stencilRef: 0, stencilFunc: THREE.NotEqualStencilFunc,
    stencilFail: THREE.ReplaceStencilOp, stencilZFail: THREE.ReplaceStencilOp, stencilZPass: THREE.ReplaceStencilOp
  });
  cap = new THREE.Mesh(new THREE.PlaneGeometry(size.x * 1.5, size.y * 3), capMat);
  cap.position.x = stage.target.x;
  cap.position.y = stage.target.y;
  cap.renderOrder = 1.1;
  cap.visible = false;
  cap.onAfterRender = renderer => renderer.clearStencil();
  group.add(cap);
  stage.scene.add(group);

  stage.onTheme(dark => {
    const t = dark ? THEMES.dark : THEMES.light;
    bodyMat.color.setHex(t.body);
    capMat.color.setHex(t.cap);
    body.edgeMat.color.setHex(t.edge);
    body.edgeMat.opacity = t.edgeOpacity;
  });
  stage.start();

  slider.max = String(Math.round(size.z));
  setSection(Number(slider.value) || 0);
  slider.addEventListener('input', () => setSection(slider.value));
  bindViewButtons(host.parentElement, stage);

  statusEl.hidden = true;
  statusEl.dataset.ready = '1';
  window.__cessna = { setSection, setView: stage.setView };
}

init().catch(err => {
  console.error(err);
  statusEl.dataset.failed = '1';
  statusEl.hidden = false;
  statusEl.textContent = 'The 3D viewer could not start in this browser. The rest of the page is unaffected.';
});
