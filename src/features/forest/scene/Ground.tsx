import { useMemo } from "react";
import * as THREE from "three";
import type { CatmullRomCurve3 } from "three";

// Ground uses simple large radial gradients baked as vertex colours so we
// avoid shipping ground textures. Path is a flattened tube for a subtle
// trail through the canopy.
export function Ground({ path, quality }: { path: CatmullRomCurve3; quality: "low" | "high" }) {
  const pathGeometry = useMemo(() => {
    const segments = quality === "low" ? 80 : 200;
    const tube = new THREE.TubeGeometry(path, segments, 0.7, 6, true);
    const pos = tube.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) pos.setY(i, 0.02);
    pos.needsUpdate = true;
    tube.computeVertexNormals();
    return tube;
  }, [path, quality]);

  const floorGeometry = useMemo(() => {
    const g = new THREE.CircleGeometry(60, quality === "low" ? 48 : 96);
    // Add radial vertex colour so the centre is lighter, edges darker — reads
    // as a warm clearing without needing textures.
    const colors = new Float32Array(g.attributes.position.count * 3);
    const centre = new THREE.Color("#8aa07e");
    const rim = new THREE.Color("#5f7658");
    const pos = g.attributes.position as THREE.BufferAttribute;
    const tmp = new THREE.Color();
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const y = pos.getY(i); // pre-rotation, this is Z in world.
      const d = Math.min(1, Math.hypot(x, y) / 60);
      tmp.copy(centre).lerp(rim, d);
      colors[i * 3] = tmp.r;
      colors[i * 3 + 1] = tmp.g;
      colors[i * 3 + 2] = tmp.b;
    }
    g.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    return g;
  }, [quality]);

  return (
    <group>
      <mesh geometry={floorGeometry} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <meshStandardMaterial vertexColors roughness={1} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]} receiveShadow>
        <circleGeometry args={[4.5, 32]} />
        <meshStandardMaterial color="#9ab490" roughness={1} />
      </mesh>
      <mesh geometry={pathGeometry} receiveShadow>
        <meshStandardMaterial color="#a89a7e" roughness={1} />
      </mesh>
    </group>
  );
}
