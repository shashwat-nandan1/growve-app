import * as THREE from "three";

// Deterministic mulberry32 PRNG.
export function mulberry32(seed: number) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Build a stable closed-ish winding path from the user's forest_seed.
// Returns a CatmullRom curve in the XZ plane, suitable for camera travel.
export function makePath(seed: number, radius = 18, points = 8): THREE.CatmullRomCurve3 {
  const rng = mulberry32(seed || 1);
  const pts: THREE.Vector3[] = [];
  for (let i = 0; i < points; i++) {
    const angle = (i / points) * Math.PI * 2;
    const r = radius * (0.55 + rng() * 0.55);
    const jitter = (rng() - 0.5) * (Math.PI / points) * 0.8;
    const x = Math.cos(angle + jitter) * r;
    const z = Math.sin(angle + jitter) * r;
    pts.push(new THREE.Vector3(x, 0, z));
  }
  return new THREE.CatmullRomCurve3(pts, true, "centripetal", 0.5);
}
