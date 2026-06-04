import GUI from 'lil-gui';

function saveBlob(blob, fileName) {
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(url);
}

export function setupHelpModal({ helpButton, helpModal, helpCloseButton }) {
  function openHelpModal() {
    helpModal.classList.add('open');
  }

  function closeHelpModal() {
    helpModal.classList.remove('open');
  }

  helpButton.addEventListener('click', openHelpModal);
  helpCloseButton.addEventListener('click', closeHelpModal);
  helpModal.addEventListener('click', (event) => {
    if (event.target === helpModal) closeHelpModal();
  });
  window.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') closeHelpModal();
  });

  return {
    openHelpModal,
    closeHelpModal
  };
}

export function exportImagePng({
  gui,
  helpModal,
  openHelpModal,
  closeHelpModal,
  renderer,
  scene,
  camera,
  orbitalState
}) {
  const menuDisplay = gui.domElement.style.display;
  const helpWasOpen = helpModal.classList.contains('open');

  gui.domElement.style.display = 'none';
  closeHelpModal();

  renderer.render(scene, camera);
  const fileName = `hydrogen_orbital_n${orbitalState.n}_l${orbitalState.l}_m${orbitalState.m}.png`;

  function restoreUi() {
    gui.domElement.style.display = menuDisplay;
    if (helpWasOpen) openHelpModal();
  }

  if (renderer.domElement.toBlob) {
    renderer.domElement.toBlob((blob) => {
      if (blob) saveBlob(blob, fileName);
      restoreUi();
    }, 'image/png');
    return;
  }

  const a = document.createElement('a');
  a.href = renderer.domElement.toDataURL('image/png');
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  restoreUi();
}

export function createGui({
  params,
  helpButton,
  exportButton,
  callbacks
}) {
  const gui = new GUI({ title: 'Hydrogen n,l,m Controls' });

  const qFolder = gui.addFolder('quantum numbers');
  const nCtrl = qFolder.add(params, 'n', 1, 10, 1).name('n');
  const lCtrl = qFolder.add(params, 'l', 0, 5, 1).name('l');
  const mCtrl = qFolder.add(params, 'm', -5, 5, 1).name('m');
  const orbitalNameCtrl = qFolder.add(params, 'orbitalName').name('Orbital name');
  orbitalNameCtrl.disable();

  function applyOrbitalChange() {
    callbacks.onOrbitalChange();
    nCtrl.updateDisplay();
    lCtrl.updateDisplay();
    mCtrl.updateDisplay();
    orbitalNameCtrl.updateDisplay();
  }

  nCtrl.onChange(applyOrbitalChange);
  lCtrl.onChange(applyOrbitalChange);
  mCtrl.onChange(applyOrbitalChange);

  gui.add(params, 'showPointCloud').name('show point cloud').onChange(callbacks.onShowPointCloud);
  gui.add(params, 'showIsosurfaces').name('show isosurfaces').onChange(callbacks.onShowIsosurfaces);
  gui.add(params, 'showAxes').name('show axes').onChange(callbacks.onShowAxes);

  const isoFolder = gui.addFolder('isosurface');
  isoFolder.close();
  isoFolder.add(params, 'isoRelative', 0.0, 0.3, 0.001).name('isoparameter').onChange(callbacks.onIsoRelativeChange);

  const pointFolder = gui.addFolder('point cloud');
  pointFolder.close();
  pointFolder.add(params, 'pointCount', 1000, 300000, 1000).name('point count').onFinishChange(callbacks.onPointCountChange);
  pointFolder.add(params, 'pointSize', 2.0, 48.0, 0.1).name('point size').onChange(callbacks.onPointMaterialChange);
  pointFolder.add(params, 'pointOpacity', 0.01, 1.0, 0.01).name('point opacity').onChange(callbacks.onPointMaterialChange);
  pointFolder.add(params, 'splatSharpness', 1.0, 80.0, 0.1).name('splat sharpness').onChange(callbacks.onPointMaterialChange);

  isoFolder.add(params, 'rayStepCount', 16, 1024, 1).name('ray step count').onChange(callbacks.onRaymarchChange);
  isoFolder.add(params, 'rayStepRelative', 0.0005, 0.05, 0.0001).name('ray step rel').onChange(callbacks.onRaymarchChange);
  isoFolder.add(params, 'surfaceOpacity', 0.02, 1.0, 0.01).name('surface opacity').onChange(callbacks.onRaymarchChange);
  isoFolder.add(params, 'lightOffsetRight', -60.0, 60.0, 0.1).name('light right');
  isoFolder.add(params, 'lightOffsetUp', -60.0, 60.0, 0.1).name('light up');
  isoFolder.add(params, 'lightOffsetForward', -60.0, 60.0, 0.1).name('light forward');

  gui.addColor(params, 'positiveColor').name('positive color').onChange(callbacks.onColorChange);
  gui.addColor(params, 'negativeColor').name('negative color').onChange(callbacks.onColorChange);

  gui.domElement.appendChild(helpButton);
  gui.domElement.appendChild(exportButton);

  return gui;
}
