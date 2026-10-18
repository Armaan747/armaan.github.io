import { THREE, createStage, bindViewButtons } from './viewer-core.js?v=11';
import { STLLoader } from 'three/addons/STLLoader.js';

// PlanetX lander. Model units are mm, up +Y, width along X, length along Z.
const host = document.getElementById('lander-viewer');
const canvas = document.getElementById('lander-canvas');
const statusEl = document.getElementById('lander-status');

const THEMES = {
  light: { body: 0xc9cdd3, edge: 0x3d444c, edgeOpacity: 0.35 },
  dark:  { body: 0x858c94, edge: 0xdfe3e7, edgeOpacity: 0.22 }
};

async function init() {
  const stage = createStage({
    host, canvas, target: new THREE.Vector3(), fit: {}
  });
  const bodyMat = new THREE.MeshStandardMaterial({ roughness: 0.9, metalness: 0, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 });

  // models/lander.stl is the CAD export reduced from about 1 million to about 200,000 triangles.
  const geo = await new STLLoader().loadAsync('models/lander.stl');
  geo.computeBoundingBox();
  const bb = geo.boundingBox;
  const size = bb.getSize(new THREE.Vector3());
  const center = bb.getCenter(new THREE.Vector3());
  stage.target.copy(center);
  const span = Math.max(size.x, size.z);
  stage.fit = {
    iso: [size.x * 0.65 + size.z * 0.8, size.y * 0.95 + span * 0.6],
    top: [size.x * 1.25, size.z * 1.4],
    side: [size.z * 1.2, size.y * 1.5],
    front: [size.x * 1.2, size.y * 1.5]
  };
  stage.controls.minDistance = size.length() * 0.3;
  stage.controls.maxDistance = size.length() * 4;

  const group = new THREE.Group();
  const body = stage.addBody(geo, bodyMat, group);
  stage.scene.add(group);

  stage.onTheme(dark => {
    const t = dark ? THEMES.dark : THEMES.light;
    bodyMat.color.setHex(t.body);
    body.edgeMat.color.setHex(t.edge);
    body.edgeMat.opacity = t.edgeOpacity;
  });
  stage.start();
  bindViewButtons(host.parentElement, stage);

  statusEl.hidden = true;
  statusEl.dataset.ready = '1';
  window.__lander = { setView: stage.setView };
}

init().catch(err => {
  console.error(err);
  statusEl.dataset.failed = '1';
  statusEl.hidden = false;
  statusEl.textContent = 'The 3D viewer could not start in this browser. The rest of the page is unaffected.';
});
