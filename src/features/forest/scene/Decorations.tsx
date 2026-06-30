import { useMemo } from "react";
import * as THREE from "three";
import { mulberry32 } from "../seeded";

// Sparse stones, mushrooms, fallen leaves. Instanced for cheap draw cost.
export function Decorations({ seed, quality }: { seed: number; quality: "low" | "high" }) {
  const counts = quality === "low"
    ? { stones: 20, mushrooms: 12, leaves: 30 }
    : { stones: 40, mushrooms: 28, leaves: 90 };

  const rng = useMemo(() => mulberry32((seed || 1) ^ 0xc0ffee), [seed]);
  const stones = useMemo(() => scatter(counts.stones, rng, 30, 0.15, 0.45), [counts.stones, rng]);
  const mushrooms = useMemo(() => scatter(counts.mushrooms, rng, 18, 0.08, 0.2), [counts.mushrooms, rng]);
  const leafSpots = useMemo(() => scatter(counts.leaves, rng, 28, 0.18, 0.32), [counts.leaves, rng]);

  return (
    <group>
      <Scattered items={stones} color="#9aa099" geometryArgs={{ type: "stone" }} />
      <Scattered items={mushrooms} color="#c89b7a" geometryArgs={{ type: "mushroom" }} />
      <Scattered items={leafSpots} color="#b89a6e" geometryArgs={{ type: "leaf" }} />
    </group>
  );
}

type ScatterItem = { x: number; z: number; s: number; ry: number };

function scatter(n: number, rng: () => number, radius: number, smin: number, smax: number): ScatterItem[] {
  const out: ScatterItem[] = [];
  for (let i = 0; i < n; i++) {
    const a = rng() * Math.PI * 2;
    const r = Math.sqrt(rng()) * radius;
    out.push({ x: Math.cos(a) * r, z: Math.sin(a) * r, s: smin + rng() * (smax - smin), ry: rng() * Math.PI });
  }
  return out;
}

function Scattered({ items, color, geometryArgs }: { items: ScatterItem[]; color: string; geometryArgs: { type: "stone" | "mushroom" | "leaf" } }) {
  const geo = useMemo(() => {
    if (geometryArgs.type === "stone") return new THREE.IcosahedronGeometry(1, 0);
    if (geometryArgs.type === "mushroom") return new THREE.ConeGeometry(0.6, 0.7, 6);
    return new THREE.PlaneGeometry(0.6, 0.6);
  }, [geometryArgs.type]);

  const tmp = useMemo(() => new THREE.Object3D(), []);
  const ref = useMemo(() => ({ current: null as THREE.InstancedMesh | null }), []);

  return (
    <instancedMesh
      ref={(m: THREE.InstancedMesh | null) => {
        ref.current = m;
        if (!m) return;
        for (let i = 0; i < items.length; i++) {
          const it = items[i];
          tmp.position.set(it.x, geometryArgs.type === "leaf" ? 0.02 : it.s / 2, it.z);
          tmp.rotation.set(geometryArgs.type === "leaf" ? -Math.PI / 2 : 0, it.ry, 0);
          tmp.scale.setScalar(it.s);
          tmp.updateMatrix();
          m.setMatrixAt(i, tmp.matrix);
        }
        m.instanceMatrix.needsUpdate = true;
      }}
      args={[geo, undefined, items.length]}
    >
      <meshStandardMaterial color={color} roughness={1} flatShading />
    </instancedMesh>
  );
}
