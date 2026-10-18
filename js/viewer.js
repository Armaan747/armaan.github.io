import { THREE, createStage, bindViewButtons } from './viewer-core.js?v=10';
import { STLLoader } from 'three/addons/STLLoader.js';

// Variable-stability UAV. The tail group slides toward -Z by up to STROKE mm.
const STROKE = 200;
const ARM_MIN = 790;          // mm, retracted tail arm (from the paper)
const VHT_MIN = 0.36, VHT_MAX = 0.44;

const host = document.getElementById('viewer');
const canvas = document.getElementById('viewer-canvas');
const statusEl = document.getElementById('viewer-status');
const slider = document.getElementById('ext');
const outExt = document.getElementById('out-ext');
const outArm = document.getElementById('out-arm');
const outVht = document.getElementById('out-vht');

const THEMES = {
  light: { fixed: 0xc9cdd3, tail: 0x9db2d2, edge: 0x3d444c, edgeOpacity: 0.35 },
  dark:  { fixed: 0x858c94, tail: 0x6b8fc2, edge: 0xdfe3e7, edgeOpacity: 0.22 }
};

// Approximate projected size (mm) of the model in each view, used to frame it.
const FIT = { iso: [1850, 1100], top: [2000, 1900], side: [1950, 450], front: [2150, 500] };

let stage, tailGroup;

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
  if (stage) stage.requestRender();
}

async function init() {
  stage = createStage({ host, canvas, target: new THREE.Vector3(0, 20, -300), fit: FIT });

  const common = { roughness: 0.9, metalness: 0, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 };
  const fixedMat = new THREE.MeshStandardMaterial(common);
  const tailMat = new THREE.MeshStandardMaterial({ ...common, side: THREE.DoubleSide });

  const loader = new STLLoader();
  const [fixedGeo, tailGeo] = await Promise.all([
    loader.loadAsync('models/uav_fixed.stl'),
    loader.loadAsync('models/uav_tail.stl')
  ]);
  const fixedGroup = new THREE.Group();
  tailGroup = new THREE.Group();
  const fixedBody = stage.addBody(fixedGeo, fixedMat, fixedGroup);
  const tailBody = stage.addBody(tailGeo, tailMat, tailGroup);
  stage.scene.add(fixedGroup, tailGroup);

  stage.onTheme(dark => {
    const t = dark ? THEMES.dark : THEMES.light;
    fixedMat.color.setHex(t.fixed);
    tailMat.color.setHex(t.tail);
    [fixedBody, tailBody].forEach(b => { b.edgeMat.color.setHex(t.edge); b.edgeMat.opacity = t.edgeOpacity; });
  });
  stage.start();
  setExtension(Number(slider.value) || 0);

  slider.addEventListener('input', () => setExtension(slider.value));
  bindViewButtons(host.parentElement, stage);

  statusEl.hidden = true;
  statusEl.dataset.ready = '1';
  window.__viewer = { setExtension, setView: stage.setView };
  window.__viewerReady = true;
}

init().catch(err => {
  console.error(err);
  statusEl.dataset.failed = '1';
  statusEl.hidden = false;
  statusEl.textContent = 'The 3D viewer could not start in this browser. The rest of the page is unaffected.';
});
