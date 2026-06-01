// Hydrogen expectation value in atomic units (a0 = 1):
// <r> = 0.5 * (3 n^2 - l(l+1)).
// We size the raymarch box with half-extent ~= 3 * <r>.
function expectedRadiusHydrogen(n, l) {
  return 0.5 * (3.0 * n * n - l * (l + 1.0));
}

export function computeRaymarchHalfExtent(n, l) {
  const factor = n === 1 ? 6.0 : 3.0;
  return Math.max(6.0, factor * expectedRadiusHydrogen(n, l));
}

export function factorialInt(n) {
  let f = 1;
  for (let i = 2; i <= n; i++) f *= i;
  return f;
}

function assocLaguerre(k, alpha, x) {
  if (k === 0) return 1.0;
  if (k === 1) return 1.0 + alpha - x;

  let lm2 = 1.0;
  let lm1 = 1.0 + alpha - x;
  let lk = lm1;
  for (let i = 2; i <= k; i++) {
    lk = ((2 * i - 1 + alpha - x) * lm1 - (i - 1 + alpha) * lm2) / i;
    lm2 = lm1;
    lm1 = lk;
  }
  return lk;
}

function assocLegendre(l, m, x) {
  if (m < 0 || m > l) return 0.0;
  const xc = Math.max(-1.0, Math.min(1.0, x));

  let pmm = 1.0;
  if (m > 0) {
    const somx2 = Math.sqrt(Math.max(0.0, 1.0 - xc * xc));
    let fact = 1.0;
    for (let i = 1; i <= m; i++) {
      pmm *= -fact * somx2;
      fact += 2.0;
    }
  }
  if (l === m) return pmm;

  const pmmp1 = xc * (2 * m + 1) * pmm;
  if (l === m + 1) return pmmp1;

  let pll = pmmp1;
  let pprev = pmm;
  let pcurr = pmmp1;
  for (let ll = m + 2; ll <= l; ll++) {
    pll = ((2 * ll - 1) * xc * pcurr - (ll + m - 1) * pprev) / (ll - m);
    pprev = pcurr;
    pcurr = pll;
  }
  return pll;
}

function realSphericalHarmonic(l, m, theta, phi) {
  const mAbs = Math.abs(m);
  const ct = Math.cos(theta);
  const p = assocLegendre(l, mAbs, ct);
  const norm = Math.sqrt(
    ((2 * l + 1) / (4 * Math.PI)) *
    (factorialInt(l - mAbs) / factorialInt(l + mAbs))
  );

  if (m > 0) return Math.SQRT2 * norm * p * Math.cos(mAbs * phi);
  if (m < 0) return Math.SQRT2 * norm * p * Math.sin(mAbs * phi);
  return norm * p;
}

function radialShapeHydrogen(n, l, r) {
  const rho = (2.0 * r) / n;
  const k = n - l - 1;
  return Math.exp(-0.5 * rho) * Math.pow(Math.max(rho, 0.0), l) * assocLaguerre(k, 2 * l + 1, rho);
}

export function estimateMaxAbsRadial(n, l) {
  const rMax = Math.max(40.0, 12.0 * n * n);
  const samples = 5000;
  let maxR = 0.0;
  for (let i = 0; i <= samples; i++) {
    const r = rMax * (i / samples);
    const v = Math.abs(radialShapeHydrogen(n, l, r));
    if (v > maxR) maxR = v;
  }
  return Math.max(maxR, 1e-12);
}

export function psiRealHydrogenCartesian(x, y, z, n, l, m) {
  const r = Math.hypot(x, y, z);
  if (r < 1e-8) {
    if (l > 0) return 0.0;
    return radialShapeHydrogen(n, l, 0.0) * realSphericalHarmonic(l, m, 0.0, 0.0);
  }

  const ct = Math.max(-1.0, Math.min(1.0, z / r));
  const theta = Math.acos(ct);
  const phi = Math.atan2(y, x);
  return radialShapeHydrogen(n, l, r) * realSphericalHarmonic(l, m, theta, phi);
}

export function getOrbitalName(n, l, m) {
  const letters = ['s', 'p', 'd', 'f', 'g', 'h', 'i'];
  const letter = letters[l] || `l${l}`;

  if (l === 0) return `${n}s`;
  if (l === 1) {
    if (m === 0) return `${n}p_z`;
    if (m > 0) return `${n}p_x`;
    return `${n}p_y`;
  }
  if (l === 2) {
    if (m === 0) return `${n}d_z2`;
    if (m === 1) return `${n}d_xz`;
    if (m === -1) return `${n}d_yz`;
    if (m === 2) return `${n}d_x2-y2`;
    if (m === -2) return `${n}d_xy`;
  }

  const mPart = m >= 0 ? `+${m}` : `${m}`;
  return `${n}${letter}_m${mPart}`;
}
