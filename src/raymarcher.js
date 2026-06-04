import * as THREE from 'three';

const vertexShader = /* glsl */`
  varying vec3 vWorldPos;
  void main() {
    vec4 world = modelMatrix * vec4(position, 1.0);
    vWorldPos = world.xyz;
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`;

const fragmentShader = /* glsl */`
  precision highp float;
  precision highp int;

  varying vec3 vWorldPos;

  uniform float uIso;
  uniform float uRayStepCount;
  uniform float uStepSize;
  uniform float uSurfaceOpacity;
  uniform float uN;
  uniform float uL;
  uniform float uM;
  uniform vec3 uBoxMin;
  uniform vec3 uBoxMax;
  uniform vec3 uPosColor;
  uniform vec3 uNegColor;
  uniform mat4 uInvModelMatrix;
  uniform mat4 uModelMatrixWorld;
  uniform mat3 uNormalMatrixWorld;
  uniform vec3 uCamRight;
  uniform vec3 uCamUp;
  uniform vec3 uCamForward;
  uniform vec3 uLightWorldPos;

  float fact(int n) {
    float f = 1.0;
    for (int i = 2; i <= 32; i++) {
      if (i > n) break;
      f *= float(i);
    }
    return f;
  }

  float assocLaguerre(int k, int alpha, float x) {
    if (k == 0) return 1.0;
    if (k == 1) return 1.0 + float(alpha) - x;
    float lm2 = 1.0;
    float lm1 = 1.0 + float(alpha) - x;
    float lk = lm1;
    for (int i = 2; i <= 32; i++) {
      if (i > k) break;
      float fi = float(i);
      lk = ((2.0 * fi - 1.0 + float(alpha) - x) * lm1 - (fi - 1.0 + float(alpha)) * lm2) / fi;
      lm2 = lm1;
      lm1 = lk;
    }
    return lk;
  }

  float assocLegendre(int l, int m, float x) {
    float xc = clamp(x, -1.0, 1.0);
    float pmm = 1.0;
    if (m > 0) {
      float somx2 = sqrt(max(0.0, 1.0 - xc * xc));
      float pref = 1.0;
      for (int i = 1; i <= 20; i++) {
        if (i > m) break;
        pmm *= -pref * somx2;
        pref += 2.0;
      }
    }
    if (l == m) return pmm;

    float pmmp1 = xc * float(2 * m + 1) * pmm;
    if (l == m + 1) return pmmp1;

    float pll = pmmp1;
    float pprev = pmm;
    float pcurr = pmmp1;
    for (int ll = 2; ll <= 20; ll++) {
      if (ll <= m + 1) continue;
      if (ll > l) break;
      pll = (float(2 * ll - 1) * xc * pcurr - float(ll + m - 1) * pprev) / float(ll - m);
      pprev = pcurr;
      pcurr = pll;
    }
    return pll;
  }

  float realYlm(int l, int m, float theta, float phi) {
    int ma = abs(m);
    float p = assocLegendre(l, ma, cos(theta));
    float norm = sqrt(((2.0 * float(l) + 1.0) / (4.0 * 3.141592653589793)) * (fact(l - ma) / fact(l + ma)));
    if (m > 0) return 1.4142135623730951 * norm * p * cos(float(ma) * phi);
    if (m < 0) return 1.4142135623730951 * norm * p * sin(float(ma) * phi);
    return norm * p;
  }

  float radialShape(int n, int l, float r) {
    float rho = (2.0 * r) / float(n);
    int k = n - l - 1;
    return exp(-0.5 * rho) * pow(max(rho, 0.0), float(l)) * assocLaguerre(k, 2 * l + 1, rho);
  }

  float psi(vec3 p) {
    int n = int(uN + 0.5);
    int l = int(uL + 0.5);
    int m = int(uM > 0.0 ? floor(uM + 0.5) : ceil(uM - 0.5));

    float r = length(p);
    if (r < 1e-6) {
      if (l > 0) return 0.0;
      return radialShape(n, l, 0.0) * realYlm(l, m, 0.0, 0.0);
    }

    float theta = acos(clamp(p.z / r, -1.0, 1.0));
    float phi = atan(p.y, p.x);
    return radialShape(n, l, r) * realYlm(l, m, theta, phi);
  }

  bool intersectBox(vec3 ro, vec3 rd, vec3 bmin, vec3 bmax, out float tNear, out float tFar) {
    vec3 t0 = (bmin - ro) / rd;
    vec3 t1 = (bmax - ro) / rd;
    vec3 tmin3 = min(t0, t1);
    vec3 tmax3 = max(t0, t1);

    tNear = max(max(tmin3.x, tmin3.y), tmin3.z);
    tFar = min(min(tmax3.x, tmax3.y), tmax3.z);
    return tFar >= max(tNear, 0.0);
  }

  vec3 gradPsi(vec3 p) {
    float e = 0.05;
    float dx = psi(p + vec3(e, 0.0, 0.0)) - psi(p - vec3(e, 0.0, 0.0));
    float dy = psi(p + vec3(0.0, e, 0.0)) - psi(p - vec3(0.0, e, 0.0));
    float dz = psi(p + vec3(0.0, 0.0, e)) - psi(p - vec3(0.0, 0.0, e));
    return vec3(dx, dy, dz);
  }

  void main() {
    vec3 roWorld = cameraPosition;
    vec3 rdWorld = normalize(vWorldPos - roWorld);

    vec3 ro = (uInvModelMatrix * vec4(roWorld, 1.0)).xyz;
    vec3 rd = normalize((uInvModelMatrix * vec4(rdWorld, 0.0)).xyz);
    float tEntry;
    float tExit;
    if (!intersectBox(ro, rd, uBoxMin, uBoxMax, tEntry, tExit)) {
      discard;
    }

    float t = max(tEntry, 0.0) + 1e-3;
    float prevT = t;
    float prevVal = abs(psi(ro + rd * t)) - uIso;

    bool hit = false;
    float hitT = 0.0;

    const int MAX_STEPS = 1024;
    for (int i = 0; i < MAX_STEPS; i++) {
      if (float(i) >= uRayStepCount) break;

      t += uStepSize;
      if (t > tExit) break;

      float val = abs(psi(ro + rd * t)) - uIso;

      if ((prevVal <= 0.0 && val >= 0.0) || (prevVal >= 0.0 && val <= 0.0)) {
        float a = prevT;
        float b = t;
        for (int j = 0; j < 5; j++) {
          float m = 0.5 * (a + b);
          float fm = abs(psi(ro + rd * m)) - uIso;
          float fa = abs(psi(ro + rd * a)) - uIso;
          if (fa * fm <= 0.0) {
            b = m;
          } else {
            a = m;
          }
        }
        hitT = 0.5 * (a + b);
        hit = true;
        break;
      }

      prevT = t;
      prevVal = val;
    }

    if (!hit) {
      discard;
    }

    vec3 pLocal = ro + rd * hitT;
    float psiVal = psi(pLocal);
    vec3 baseColor = psiVal >= 0.0 ? uPosColor : uNegColor;

    vec3 nLocal = normalize(gradPsi(pLocal));
    if (dot(nLocal, rd) > 0.0) nLocal = -nLocal;
    vec3 nWorld = normalize(uNormalMatrixWorld * nLocal);

    vec3 pWorld = (uModelMatrixWorld * vec4(pLocal, 1.0)).xyz;
    vec3 lightDirA = normalize(uLightWorldPos - pWorld);
    vec3 lightDirB = normalize(-lightDirA + 0.25 * uCamUp);
    vec3 viewDir = normalize(roWorld - pWorld);

    float diffA = max(dot(nWorld, lightDirA), 0.0);
    float diffB = 0.35 * max(dot(nWorld, lightDirB), 0.0);
    vec3 halfDir = normalize(lightDirA + viewDir);
    float spec = pow(max(dot(nWorld, halfDir), 0.0), 28.0);

    vec3 color = baseColor * (0.18 + diffA + diffB) + vec3(1.0) * (0.25 * spec);
    gl_FragColor = vec4(color, uSurfaceOpacity);
  }
`;

export function createRaymarcher(scene, params, getOrbitalState, getIsoAbsolute, initialHalfExtent) {
  const uniforms = {
    uIso: { value: getIsoAbsolute() },
    uRayStepCount: { value: params.rayStepCount },
    uStepSize: { value: Math.max(1e-4, params.rayStepRelative * initialHalfExtent) },
    uSurfaceOpacity: { value: params.surfaceOpacity },
    uN: { value: getOrbitalState().n },
    uL: { value: getOrbitalState().l },
    uM: { value: getOrbitalState().m },
    uBoxMin: { value: new THREE.Vector3(-initialHalfExtent, -initialHalfExtent, -initialHalfExtent) },
    uBoxMax: { value: new THREE.Vector3(initialHalfExtent, initialHalfExtent, initialHalfExtent) },
    uPosColor: { value: new THREE.Color(params.positiveColor) },
    uNegColor: { value: new THREE.Color(params.negativeColor) },
    uInvModelMatrix: { value: new THREE.Matrix4() },
    uModelMatrixWorld: { value: new THREE.Matrix4() },
    uNormalMatrixWorld: { value: new THREE.Matrix3() },
    uCamRight: { value: new THREE.Vector3(1, 0, 0) },
    uCamUp: { value: new THREE.Vector3(0, 1, 0) },
    uCamForward: { value: new THREE.Vector3(0, 0, -1) },
    uLightWorldPos: { value: new THREE.Vector3() }
  };

  const material = new THREE.ShaderMaterial({
    uniforms,
    vertexShader,
    fragmentShader,
    transparent: true,
    depthWrite: false,
    depthTest: true,
    side: THREE.DoubleSide
  });

  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(initialHalfExtent * 2.0, initialHalfExtent * 2.0, initialHalfExtent * 2.0),
    material
  );
  mesh.renderOrder = 10;
  mesh.visible = params.showIsosurfaces;
  scene.add(mesh);

  function updateBounds(halfExtent) {
    uniforms.uBoxMin.value.set(-halfExtent, -halfExtent, -halfExtent);
    uniforms.uBoxMax.value.set(halfExtent, halfExtent, halfExtent);

    mesh.geometry.dispose();
    mesh.geometry = new THREE.BoxGeometry(halfExtent * 2.0, halfExtent * 2.0, halfExtent * 2.0);
  }

  function syncUniforms(halfExtent) {
    const { n, l, m } = getOrbitalState();
    uniforms.uIso.value = getIsoAbsolute();
    uniforms.uRayStepCount.value = Math.max(1, params.rayStepCount);
    uniforms.uStepSize.value = Math.max(1e-4, params.rayStepRelative * halfExtent);
    uniforms.uSurfaceOpacity.value = params.surfaceOpacity;
    uniforms.uN.value = n;
    uniforms.uL.value = l;
    uniforms.uM.value = m;
    uniforms.uPosColor.value.set(params.positiveColor);
    uniforms.uNegColor.value.set(params.negativeColor);
  }

  function updateCameraUniforms(camera) {
    const e = camera.matrixWorld.elements;
    uniforms.uCamRight.value.set(e[0], e[1], e[2]).normalize();
    uniforms.uCamUp.value.set(e[4], e[5], e[6]).normalize();
    uniforms.uCamForward.value.set(-e[8], -e[9], -e[10]).normalize();
    uniforms.uLightWorldPos.value.copy(camera.position)
      .addScaledVector(uniforms.uCamRight.value, params.lightOffsetRight)
      .addScaledVector(uniforms.uCamUp.value, params.lightOffsetUp)
      .addScaledVector(uniforms.uCamForward.value, params.lightOffsetForward);

    mesh.updateMatrixWorld();
    uniforms.uModelMatrixWorld.value.copy(mesh.matrixWorld);
    uniforms.uInvModelMatrix.value.copy(mesh.matrixWorld).invert();
    uniforms.uNormalMatrixWorld.value.getNormalMatrix(mesh.matrixWorld);
  }

  function setVisible(visible) {
    mesh.visible = visible;
  }

  return {
    mesh,
    uniforms,
    updateBounds,
    syncUniforms,
    updateCameraUniforms,
    setVisible
  };
}
