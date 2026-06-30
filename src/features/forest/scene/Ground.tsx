import { useMemo } from "react";
import * as THREE from "three";
import type { CatmullRomCurve3 } from "three";

export function Ground({ path, quality }: { path: CatmullRomCurve3; quality: "low" | "high" }) {
  const pathGeometry = useMemo(() => {
    const segments = quality === "low" ? 80 : 200;
    const tube = new THREE.TubeGeometry(path, segments, 0.7, 6, true);
    // flatten to ground plane: zero out Y on every vertex
    const pos = tube.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) pos.setY(i, 0.01);
    pos.needsUpdate = true;
    tube.computeVertexNormals();
    return tube;
  }, [path, quality]);

  return (
    <group>
      {/* Moss floor */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <circleGeometry args={[60, 48]} />
        <meshStandardMaterial color="#6d8466" roughness={1} />
      </mesh>
      {/* Quiet central clearing — slightly lighter tone */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.005, 0]} receiveShadow>
        <circleGeometry args={[4.5, 32]} />
        <meshStandardMaterial color="#8aa07e" roughness={1} />
      </mesh>
      {/* Winding path */}
      <mesh geometry={pathGeometry} receiveShadow>
        <meshStandardMaterial color="#a89a7e" roughness={1} />
      </mesh>
    </group>
  );
}
