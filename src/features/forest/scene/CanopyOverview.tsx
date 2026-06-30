import { useFrame, useThree } from "@react-three/fiber";
import { useRef } from "react";
import * as THREE from "three";
import type { ForestData } from "../types";
import { Lighting } from "./Lighting";
import { Ground } from "./Ground";
import { InstancedSpecies } from "./InstancedSpecies";
import { Decorations } from "./Decorations";
import { makePath } from "../seeded";

export function CanopyOverview({
  data, quality, reducedMotion,
}: { data: ForestData; quality: "low" | "high"; reducedMotion: boolean }) {
  const path = useRef(makePath(data.seed)).current;
  const { camera } = useThree();
  const angle = useRef(0);

  useFrame((_, delta) => {
    if (reducedMotion) {
      camera.position.set(20, 16, 20);
      camera.lookAt(0, 1, 0);
      return;
    }
    angle.current += delta * 0.05; // slow drift
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
      <InstancedSpecies trees={data.trees} quality={quality} windEnabled={!reducedMotion} />
      <Decorations seed={data.seed} quality={quality} />
    </>
  );
}

// Camera fallback: ensure perspective camera positioned correctly on first frame.
export function setupOverviewCamera(camera: THREE.PerspectiveCamera) {
  camera.position.set(20, 16, 20);
  camera.lookAt(0, 1, 0);
}
