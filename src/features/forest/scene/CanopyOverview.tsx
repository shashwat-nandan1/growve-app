import { useFrame, useThree } from "@react-three/fiber";
import { useRef, useEffect } from "react";
import * as THREE from "three";
import type { ForestData } from "../types";
import { Lighting } from "./Lighting";
import { Ground } from "./Ground";
import { InstancedSpecies } from "./InstancedSpecies";
import { Decorations } from "./Decorations";
import { makePath } from "../seeded";

/**
 * Slow-drifting canopy overview used on Today and inside the immersive
 * overview mode. Uses the same GLB-backed rendering as the walk view, just
 * from a fixed cinematic camera height with autorotation and no audio.
 */
export function CanopyOverview({
  data, quality, reducedMotion,
}: { data: ForestData; quality: "low" | "high"; reducedMotion: boolean }) {
  const path = useRef(makePath(data.seed)).current;
  const { camera } = useThree();
  const angle = useRef(0);
  const cameraRef = useRef<THREE.Camera | null>(camera);

  useEffect(() => { cameraRef.current = camera; }, [camera]);

  useFrame((_, delta) => {
    if (reducedMotion) {
      camera.position.set(20, 16, 20);
      camera.lookAt(0, 1, 0);
      return;
    }
    angle.current += delta * 0.05;
    const r = 24;
    camera.position.x = Math.cos(angle.current) * r;
    camera.position.z = Math.sin(angle.current) * r;
    camera.position.y = 14;
    camera.lookAt(0, 1, 0);
  });

  return (
    <>
      <Lighting quality={quality} />
      <Ground path={path} quality={quality} />
      <InstancedSpecies trees={data.trees} quality={quality} windEnabled={!reducedMotion} cameraRef={cameraRef} />
      <Decorations seed={data.seed} quality={quality} />
    </>
  );
}
