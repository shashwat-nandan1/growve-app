import { useMemo, useEffect, useRef } from "react";
import * as THREE from "three";
import { useGLTF } from "@react-three/drei";
import { mulberry32 } from "../seeded";

// Decoration GLBs loaded once and instanced. All CC0 Quaternius.
const DECOR_URLS = {
  grassLarge: "/models/Grass_Large.glb",
  grassSmall: "/models/Grass_Small.glb",
  plant1: "/models/Plant_1.glb",
  plantFlowers: "/models/Plant_Flowers.glb",
  bushSmall: "/models/Bush_Small.glb",
  rock1: "/models/Rock_1.glb",
  rock3: "/models/Rock_3.glb",
  deadTree: "/models/DeadTree_5.glb",
};
Object.values(DECOR_URLS).forEach((u) => useGLTF.preload(u));

function flatten(scene: THREE.Object3D): { geometry: THREE.BufferGeometry; material: THREE.Material } | null {
  scene.updateMatrixWorld(true);
  let out: { geometry: THREE.BufferGeometry; material: THREE.Material } | null = null;
  scene.traverse((c) => {
    const m = c as THREE.Mesh;
    if (!m.isMesh || !m.geometry || out) return;
    const g = m.geometry.clone();
    g.applyMatrix4(m.matrixWorld);
    const base = Array.isArray(m.material) ? m.material[0] : m.material;
    out = { geometry: g, material: (base as THREE.Material).clone() };
  });
  return out;
}

type ScatterItem = { x: number; z: number; s: number; ry: number };

function scatter(n: number, rng: () => number, radius: number, smin: number, smax: number, excludeCenter = 3): ScatterItem[] {
  const out: ScatterItem[] = [];
  for (let i = 0; i < n; i++) {
    const a = rng() * Math.PI * 2;
    const r = excludeCenter + Math.sqrt(rng()) * (radius - excludeCenter);
    out.push({ x: Math.cos(a) * r, z: Math.sin(a) * r, s: smin + rng() * (smax - smin), ry: rng() * Math.PI * 2 });
  }
  return out;
}

function DecorMesh({ url, items }: { url: string; items: ScatterItem[] }) {
  const gltf = useGLTF(url) as unknown as { scene: THREE.Object3D };
  const parts = useMemo(() => flatten(gltf.scene.clone(true)), [gltf]);
  const ref = useRef<THREE.InstancedMesh>(null);
  const tmp = useMemo(() => new THREE.Object3D(), []);

  useEffect(() => {
    const m = ref.current;
    if (!m) return;
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      tmp.position.set(it.x, 0, it.z);
      tmp.rotation.set(0, it.ry, 0);
      tmp.scale.setScalar(it.s);
      tmp.updateMatrix();
      m.setMatrixAt(i, tmp.matrix);
    }
    m.instanceMatrix.needsUpdate = true;
    m.computeBoundingSphere();
  }, [items, tmp, parts]);

  if (!parts || items.length === 0) return null;
  return (
    <instancedMesh
      ref={ref}
      args={[parts.geometry, parts.material, items.length]}
      receiveShadow
    />
  );
}

export function Decorations({ seed, quality }: { seed: number; quality: "low" | "high" }) {
  const rng = useMemo(() => mulberry32((seed || 1) ^ 0xc0ffee), [seed]);
  const counts = quality === "low"
    ? { grass: 60, plants: 20, bushes: 8, rocks: 10, deadTrees: 3 }
    : { grass: 180, plants: 60, bushes: 20, rocks: 24, deadTrees: 6 };

  const grassLarge   = useMemo(() => scatter(counts.grass * 0.6, rng, 30, 0.5, 1.1), [counts.grass, rng]);
  const grassSmall   = useMemo(() => scatter(counts.grass * 0.4, rng, 30, 0.5, 1.0), [counts.grass, rng]);
  const plants       = useMemo(() => scatter(counts.plants * 0.6, rng, 26, 0.4, 0.9), [counts.plants, rng]);
  const plantFlowers = useMemo(() => scatter(counts.plants * 0.4, rng, 26, 0.4, 0.8), [counts.plants, rng]);
  const bushes       = useMemo(() => scatter(counts.bushes, rng, 24, 0.6, 1.1), [counts.bushes, rng]);
  const rocks1       = useMemo(() => scatter(counts.rocks * 0.5, rng, 28, 0.3, 0.8), [counts.rocks, rng]);
  const rocks3       = useMemo(() => scatter(counts.rocks * 0.5, rng, 28, 0.3, 0.7), [counts.rocks, rng]);
  const deadTrees    = useMemo(() => scatter(counts.deadTrees, rng, 32, 0.5, 0.9, 8), [counts.deadTrees, rng]);

  return (
    <group>
      <DecorMesh url={DECOR_URLS.grassLarge} items={grassLarge} />
      <DecorMesh url={DECOR_URLS.grassSmall} items={grassSmall} />
      <DecorMesh url={DECOR_URLS.plant1} items={plants} />
      <DecorMesh url={DECOR_URLS.plantFlowers} items={plantFlowers} />
      <DecorMesh url={DECOR_URLS.bushSmall} items={bushes} />
      <DecorMesh url={DECOR_URLS.rock1} items={rocks1} />
      <DecorMesh url={DECOR_URLS.rock3} items={rocks3} />
      <DecorMesh url={DECOR_URLS.deadTree} items={deadTrees} />
    </group>
  );
}
