import * as THREE from 'three';

function createAxisLabel(text) {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 92px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, canvas.width * 0.5, canvas.height * 0.5 + 2);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.generateMipmaps = false;

  const mat = new THREE.SpriteMaterial({
    map: tex,
    transparent: true,
    depthTest: false,
    depthWrite: false
  });

  const sprite = new THREE.Sprite(mat);
  sprite.scale.set(1.45, 1.45, 1.0);
  sprite.renderOrder = 11;
  return sprite;
}

export function addAxesToScene(scene, axisLength = 8.0, axisLabelOffset = 0.9) {
  const axisGeom = new THREE.BufferGeometry();
  axisGeom.setAttribute(
    'position',
    new THREE.BufferAttribute(
      new Float32Array([
        0, 0, 0, axisLength, 0, 0,
        0, 0, 0, 0, axisLength, 0,
        0, 0, 0, 0, 0, axisLength
      ]),
      3
    )
  );
  const axisMat = new THREE.LineBasicMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.95,
    depthTest: false
  });
  const axisLines = new THREE.LineSegments(axisGeom, axisMat);
  axisLines.renderOrder = 10;
  scene.add(axisLines);

  const xLabel = createAxisLabel('x');
  xLabel.position.set(axisLength + axisLabelOffset, 0, 0);
  scene.add(xLabel);

  const yLabel = createAxisLabel('y');
  yLabel.position.set(0, axisLength + axisLabelOffset, 0);
  scene.add(yLabel);

  const zLabel = createAxisLabel('z');
  zLabel.position.set(0, 0, axisLength + axisLabelOffset);
  scene.add(zLabel);

  return {
    setVisible(visible) {
      axisLines.visible = visible;
      xLabel.visible = visible;
      yLabel.visible = visible;
      zLabel.visible = visible;
    }
  };
}
