import * as THREE from 'three';
import { TrackballControls } from 'three/addons/controls/TrackballControls.js';
import {
  computeRaymarchHalfExtent,
  estimateMaxAbsRadial,
  getOrbitalName
} from './orbitalMath.js';
import { createPointCloudLayer } from './pointCloud.js';
import { createRaymarcher } from './raymarcher.js';
import { addAxesToScene } from './sceneAxes.js';
import { createGui, exportImagePng, setupHelpModal } from './ui.js';

const params = {
  n: 2,
  l: 1,
  m: 0,
  showPointCloud: true,
  showIsosurfaces: true,
  showAxes: true,
  isoRelative: 0.11,
  orbitalName: '2p_x',
  pointCount: 200000,
  pointSize: 4.0,
  pointOpacity: 0.3,
  splatSharpness: 18.0,
  rayStepCount: 640,
  rayStepRelative: 0.025,
  surfaceOpacity: 0.55,
  lightOffsetRight: -20.0,
  lightOffsetUp: 18.0,
  lightOffsetForward: 8.0,
  positiveColor: '#3fa0ff',
  negativeColor: '#ff6347'
};

const app = document.getElementById('app');
const helpButton = document.getElementById('helpButton');
const exportButton = document.getElementById('exportButton');
const helpModal = document.getElementById('helpModal');
const helpCloseButton = document.getElementById('helpCloseButton');

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x06080d);

const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 500.0);
camera.position.set(24, 18, 24);

const renderer = new THREE.WebGLRenderer({
  antialias: true,
  alpha: false,
  preserveDrawingBuffer: true
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
app.appendChild(renderer.domElement);

const controls = new TrackballControls(camera, renderer.domElement);
controls.target.set(0, 0, 0);
controls.rotateSpeed = 3.0;
controls.zoomSpeed = 1.2;
controls.panSpeed = 0.8;
controls.dynamicDampingFactor = 0.12;
controls.minDistance = 12.0;
controls.maxDistance = 140.0;

const orbitalState = { n: 2, l: 1, m: 0 };
let currentVolumeHalfExtent = computeRaymarchHalfExtent(orbitalState.n, orbitalState.l);
let maxAbsRadial = 1.0;
let isoAbsolute = params.isoRelative * maxAbsRadial;

function getOrbitalState() {
  return orbitalState;
}

function getIsoAbsolute() {
  return isoAbsolute;
}

function clampOrbitalState() {
  const n = Math.max(1, Math.min(10, Math.round(params.n)));
  const l = Math.max(0, Math.min(n - 1, Math.round(params.l)));
  const m = Math.max(-l, Math.min(l, Math.round(params.m)));

  params.n = n;
  params.l = l;
  params.m = m;
  orbitalState.n = n;
  orbitalState.l = l;
  orbitalState.m = m;
}

function updateOrbitalName() {
  params.orbitalName = getOrbitalName(orbitalState.n, orbitalState.l, orbitalState.m);
}

function updateIsoAbsoluteFromRadialMax() {
  maxAbsRadial = estimateMaxAbsRadial(orbitalState.n, orbitalState.l);
  isoAbsolute = params.isoRelative * maxAbsRadial;
}

const axes = addAxesToScene(scene);
const pointCloud = createPointCloudLayer(scene, params, getOrbitalState);
const raymarcher = createRaymarcher(
  scene,
  params,
  getOrbitalState,
  getIsoAbsolute,
  currentVolumeHalfExtent
);

function updateSpatialScaleAndCamera(reframeCamera = true) {
  currentVolumeHalfExtent = computeRaymarchHalfExtent(orbitalState.n, orbitalState.l);
  raymarcher.updateBounds(currentVolumeHalfExtent);

  if (!reframeCamera) return;

  const viewDir = new THREE.Vector3().copy(camera.position).sub(controls.target);
  if (viewDir.lengthSq() < 1e-8) viewDir.set(1.0, 0.75, 1.0);
  viewDir.normalize();

  const desiredDistance = Math.max(14.0, 2.35 * currentVolumeHalfExtent);
  camera.position.copy(controls.target).addScaledVector(viewDir, desiredDistance);

  controls.minDistance = Math.max(3.0, 0.45 * currentVolumeHalfExtent);
  controls.maxDistance = Math.max(80.0, 12.0 * currentVolumeHalfExtent);
  camera.near = Math.max(0.05, 0.01 * currentVolumeHalfExtent);
  camera.far = Math.max(500.0, 25.0 * currentVolumeHalfExtent);
  camera.updateProjectionMatrix();
}

function syncRaymarcher() {
  raymarcher.syncUniforms(currentVolumeHalfExtent);
}

function applyOrbitalChange() {
  clampOrbitalState();
  updateOrbitalName();
  updateSpatialScaleAndCamera(true);
  updateIsoAbsoluteFromRadialMax();
  pointCloud.rebuild(params.pointCount);
  pointCloud.syncMaterials();
  syncRaymarcher();
}

clampOrbitalState();
updateOrbitalName();
updateSpatialScaleAndCamera(true);
updateIsoAbsoluteFromRadialMax();
pointCloud.rebuild(params.pointCount);
pointCloud.syncMaterials();
syncRaymarcher();
axes.setVisible(params.showAxes);

const { openHelpModal, closeHelpModal } = setupHelpModal({
  helpButton,
  helpModal,
  helpCloseButton
});

const gui = createGui({
  params,
  helpButton,
  exportButton,
  callbacks: {
    onOrbitalChange: applyOrbitalChange,
    onShowPointCloud: (visible) => pointCloud.setVisible(visible),
    onShowIsosurfaces: (visible) => raymarcher.setVisible(visible),
    onShowAxes: (visible) => axes.setVisible(visible),
    onIsoRelativeChange: () => {
      isoAbsolute = params.isoRelative * maxAbsRadial;
      syncRaymarcher();
    },
    onPointCountChange: (value) => {
      params.pointCount = Math.floor(value);
      pointCloud.rebuild(params.pointCount);
      pointCloud.syncMaterials();
    },
    onPointMaterialChange: () => pointCloud.syncMaterials(),
    onRaymarchChange: syncRaymarcher,
    onColorChange: () => {
      pointCloud.syncMaterials();
      syncRaymarcher();
    }
  }
});

exportButton.addEventListener('click', () => {
  exportImagePng({
    gui,
    helpModal,
    openHelpModal,
    closeHelpModal,
    renderer,
    scene,
    camera,
    orbitalState
  });
});

function onResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  controls.handleResize();
}
window.addEventListener('resize', onResize);

function animate() {
  requestAnimationFrame(animate);
  controls.update();
  raymarcher.updateCameraUniforms(camera);
  renderer.render(scene, camera);
}

animate();

console.info('Hydrogen orbital explorer ready. Serve with: python -m http.server');
