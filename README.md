# Hydrogen Orbital Explorer (Three.js)

This project provides a self-contained web page for visualizing **real hydrogen atom orbitals** with:

- phase-separated point clouds (positive/negative wavefunction sign)
- phase-separated isosurfaces
- interactive camera controls
- GUI controls for orbital quantum numbers and rendering parameters

## File

- `index_general_orbitals.html` (main app, no build step)

## Run Locally

From this folder:

```bash
python -m http.server
```

Open:

- `http://localhost:8000/index_general_orbitals.html`

## Main Controls

- Quantum numbers: `n`, `l`, `m`
- Visibility:
  - `show point cloud`
  - `show isosurfaces`
  - `show axes`
- Point cloud folder:
  - `point count` (up to 300k)
  - `point size`
  - `point opacity`
  - `splat sharpness`
- Isosurface folder:
  - relative isovalue (`iso rel (R max)`)
  - ray step settings
  - surface opacity
  - light position offsets

## Notes

- The isovalue is set **relative to a numerical maximum of** `|R_nl|`.
- Raymarch box size scales with orbital size from the analytic expectation value:
  - `<r> = 0.5 * (3n^2 - l(l+1))`
  - default half-extent is `3<r>`, with a special case for `n=1`.
- `Help` opens an in-app explanation suitable for physical chemistry students.
- `Export image` saves a PNG without the menu overlays.

## Visualization Technology

### Point cloud (phase-separated splats)

- Points are sampled from a distribution proportional to orbital amplitude and split by sign of the real wavefunction (`psi > 0` vs `psi < 0`).
- Rendering uses GPU point sprites with a Gaussian alpha profile, giving soft “splat” particles instead of hard square pixels.
- Positive and negative phases are drawn with different colors to highlight nodal sign changes.

### Isosurface (volume raymarching)

- The orbital is evaluated analytically in 3D as `psi(r, theta, phi) = R_nl(r) * Y_lm(real)(theta, phi)`.
- For each view ray through a cubic volume, the shader searches for crossings of `abs(psi) - iso = 0` and refines hit points.
- Surface color is chosen from the sign of `psi` at the hit point, and normals are estimated numerically for shaded lighting.
