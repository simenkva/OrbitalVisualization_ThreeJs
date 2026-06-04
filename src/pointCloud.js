import * as THREE from 'three';
import { generateOrbitalSamples } from './sampling.js';

function makePointCloudMaterial(params, baseColor) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uSize: { value: params.pointSize },
      uOpacity: { value: params.pointOpacity },
      uSharpness: { value: params.splatSharpness },
      uColor: { value: new THREE.Color(baseColor) }
    },
    vertexShader: /* glsl */`
      uniform float uSize;
      void main() {
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = uSize;
      }
    `,
    fragmentShader: /* glsl */`
      uniform float uOpacity;
      uniform float uSharpness;
      uniform vec3 uColor;

      void main() {
        vec2 p = gl_PointCoord - vec2(0.5);
        float rr = dot(p, p);
        float alpha = uOpacity * exp(-uSharpness * rr);
        if (alpha < 0.002) discard;
        gl_FragColor = vec4(uColor, alpha);
      }
    `,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    depthTest: false
  });
}

export function createPointCloudLayer(scene, params, getOrbitalState) {
  const group = new THREE.Group();
  scene.add(group);

  let posPoints = null;
  let negPoints = null;
  let posMaterial = null;
  let negMaterial = null;

  function disposeCurrent() {
    if (posPoints) {
      group.remove(posPoints);
      posPoints.geometry.dispose();
      posMaterial.dispose();
      posPoints = null;
      posMaterial = null;
    }
    if (negPoints) {
      group.remove(negPoints);
      negPoints.geometry.dispose();
      negMaterial.dispose();
      negPoints = null;
      negMaterial = null;
    }
  }

  function rebuild(totalCount = params.pointCount) {
    disposeCurrent();
    const { n, l, m } = getOrbitalState();
    const samples = generateOrbitalSamples(totalCount, n, l, m);

    const posGeom = new THREE.BufferGeometry();
    posGeom.setAttribute('position', new THREE.BufferAttribute(samples.positive, 3));
    posMaterial = makePointCloudMaterial(params, params.positiveColor);
    posPoints = new THREE.Points(posGeom, posMaterial);
    posPoints.renderOrder = 20;

    const negGeom = new THREE.BufferGeometry();
    negGeom.setAttribute('position', new THREE.BufferAttribute(samples.negative, 3));
    negMaterial = makePointCloudMaterial(params, params.negativeColor);
    negPoints = new THREE.Points(negGeom, negMaterial);
    negPoints.renderOrder = 20;

    group.add(posPoints, negPoints);
    group.visible = params.showPointCloud;
  }

  function syncMaterials() {
    if (!posMaterial || !negMaterial) return;

    posMaterial.uniforms.uSize.value = params.pointSize;
    negMaterial.uniforms.uSize.value = params.pointSize;
    posMaterial.uniforms.uOpacity.value = params.pointOpacity;
    negMaterial.uniforms.uOpacity.value = params.pointOpacity;
    posMaterial.uniforms.uSharpness.value = params.splatSharpness;
    negMaterial.uniforms.uSharpness.value = params.splatSharpness;
    posMaterial.uniforms.uColor.value.set(params.positiveColor);
    negMaterial.uniforms.uColor.value.set(params.negativeColor);
  }

  function setVisible(visible) {
    group.visible = visible;
  }

  return {
    group,
    rebuild,
    syncMaterials,
    setVisible
  };
}
