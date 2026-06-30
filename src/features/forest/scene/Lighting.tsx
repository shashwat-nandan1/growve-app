import { useThree } from "@react-three/fiber";
import { useEffect } from "react";
import * as THREE from "three";
import { fogDistance } from "../performance";

export function Lighting({ quality }: { quality: "low" | "high" }) {
  const { scene } = useThree();
  useEffect(() => {
    const [near, far] = fogDistance(quality);
    scene.fog = new THREE.Fog("#cfd9cf", near, far);
    scene.background = new THREE.Color("#dde3da");
    return () => {
      scene.fog = null;
    };
  }, [scene, quality]);

  return (
    <>
      <hemisphereLight args={["#e7ece6", "#54745B", 0.65]} />
      <directionalLight
        position={[12, 18, 8]}
        intensity={1.0}
        color="#fff1d6"
        castShadow={quality === "high"}
        shadow-mapSize-width={quality === "high" ? 1024 : 256}
        shadow-mapSize-height={quality === "high" ? 1024 : 256}
        shadow-camera-far={50}
        shadow-camera-left={-25}
        shadow-camera-right={25}
        shadow-camera-top={25}
        shadow-camera-bottom={-25}
      />
      <ambientLight intensity={0.18} color="#c8d4c4" />
    </>
  );
}
