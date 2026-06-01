import { psiRealHydrogenCartesian } from './orbitalMath.js';

function sampleStandardNormal() {
  const u1 = Math.max(Math.random(), 1e-12);
  const u2 = Math.random();
  return Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
}

// Generic |psi| sampling for arbitrary real hydrogen orbitals:
// We use a Metropolis random walk in 3D with target density proportional to |psi|.
// Positive and negative phase are then separated by sign(psi) at each accepted sample.
export function generateOrbitalSamples(totalCount, n, l, m) {
  const pos = [];
  const neg = [];
  const targetCount = Math.max(1000, Math.floor(totalCount));
  const stepSigma = Math.max(0.8, 0.50 * n * n);
  const safetyMaxRadius = Math.max(120.0, 12.0 * n * n);

  let cx = (Math.random() * 2.0 - 1.0) * 0.5;
  let cy = (Math.random() * 2.0 - 1.0) * 0.5;
  let cz = (Math.random() * 2.0 - 1.0) * 0.5;
  let cAbs = Math.abs(psiRealHydrogenCartesian(cx, cy, cz, n, l, m)) + 1e-14;

  const burnIn = 2500;
  const thin = 2;
  const maxIterations = burnIn + targetCount * 200;
  let savedSteps = 0;

  for (let iter = 0; iter < maxIterations; iter++) {
    const nx = cx + stepSigma * sampleStandardNormal();
    const ny = cy + stepSigma * sampleStandardNormal();
    const nz = cz + stepSigma * sampleStandardNormal();
    const nr = Math.hypot(nx, ny, nz);
    // Do not clip to the render volume or any tight sphere; that distorts the
    // orbital cloud. Keep only a very loose safety bound for random-walk stability.
    if (nr < safetyMaxRadius) {
      const nAbs = Math.abs(psiRealHydrogenCartesian(nx, ny, nz, n, l, m)) + 1e-14;
      const ratio = nAbs / cAbs;
      if (ratio >= 1.0 || Math.random() < ratio) {
        cx = nx;
        cy = ny;
        cz = nz;
        cAbs = nAbs;
      }
    }

    if (iter < burnIn) continue;
    savedSteps++;
    if (savedSteps % thin !== 0) continue;

    const psi = psiRealHydrogenCartesian(cx, cy, cz, n, l, m);
    if (psi >= 0.0) {
      pos.push(cx, cy, cz);
    } else {
      neg.push(cx, cy, cz);
    }

    if ((pos.length + neg.length) / 3 >= targetCount) break;
  }

  return {
    positive: new Float32Array(pos),
    negative: new Float32Array(neg)
  };
}
