import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import type { ForestData } from "../types";
import { Lighting } from "./Lighting";
import { Ground } from "./Ground";
import { InstancedSpecies } from "./InstancedSpecies";
import { Decorations } from "./Decorations";
import { makePath } from "../seeded";
import { lookRef, useForestStore } from "../store";

export function ForestWalk({
  data, quality, reducedMotion,
}: { data: ForestData; quality: "low" | "high"; reducedMotion: boolean }) {
  const path = useMemo(() => makePath(data.seed), [data.seed]);
  const { camera } = useThree();
  const tRef = useRef(useForestStore.getState().walkProgress);
  const playing = useForestStore((s) => s.walkPlaying);
  const setProgress = useForestStore((s) => s.setWalkProgress);

  // Sync ref when external recenter happens
  useEffect(
    () => useForestStore.subscribe((s) => { tRef.current = s.walkProgress; }),
    [],
  );

  const tmpAhead = useMemo(() => new THREE.Vector3(), []);
  const tmpPos = useMemo(() => new THREE.Vector3(), []);
  const tmpTarget = useMemo(() => new THREE.Vector3(), []);

  useFrame((_, delta) => {
    if (playing && !reducedMotion) {
      tRef.current = (tRef.current + delta * 0.012) % 1;
      // Throttle store writes: every ~quarter second
      if (Math.floor(tRef.current * 400) % 100 === 0) setProgress(tRef.current);
    }
    path.getPointAt(tRef.current, tmpPos);
    path.getPointAt((tRef.current + 0.01) % 1, tmpAhead);
    camera.position.set(tmpPos.x, 1.6, tmpPos.z);

    // base look-ahead direction
    const dx = tmpAhead.x - tmpPos.x;
    const dz = tmpAhead.z - tmpPos.z;
    const baseYaw = Math.atan2(dx, dz);
    const yaw = baseYaw + lookRef.yaw;
    const pitch = lookRef.pitch;

    const lookDist = 4;
    tmpTarget.set(
      camera.position.x + Math.sin(yaw) * Math.cos(pitch) * lookDist,
      1.6 + Math.sin(pitch) * lookDist,
      camera.position.z + Math.cos(yaw) * Math.cos(pitch) * lookDist,
    );
    camera.lookAt(tmpTarget);
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
