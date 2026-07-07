import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import type { ForestData } from "../types";
import { Lighting } from "./Lighting";
import { Ground } from "./Ground";
import { InstancedSpecies } from "./InstancedSpecies";
import { Decorations } from "./Decorations";
import { makePath } from "../seeded";
import { lookRef, moveRef, useForestStore } from "../store";
import { forestAudio } from "../audio";

const WORLD_RADIUS = 34;      // Camera cannot leave this circle.
const COLLISION_RADIUS = 0.9; // Camera keeps ≥ this distance from any trunk.
const MAX_SPEED = 2.4;        // Metres/sec on the ground plane.
const ACCEL = 6.0;
const DAMPING = 4.0;

// Simple spatial hash for O(1) trunk collision lookups.
type Hash = Map<string, { x: number; z: number }[]>;
const CELL = 3;
function keyFor(x: number, z: number) {
  return `${Math.floor(x / CELL)},${Math.floor(z / CELL)}`;
}
function buildHash(trees: { position_x: number; position_z: number }[]): Hash {
  const h: Hash = new Map();
  for (const t of trees) {
    const k = keyFor(t.position_x, t.position_z);
    const arr = h.get(k) ?? [];
    arr.push({ x: t.position_x, z: t.position_z });
    h.set(k, arr);
  }
  return h;
}

export function ForestWalk({
  data, quality, reducedMotion, cameraRef,
}: {
  data: ForestData;
  quality: "low" | "high";
  reducedMotion: boolean;
  cameraRef?: { current: THREE.Camera | null };
}) {
  const path = useMemo(() => makePath(data.seed), [data.seed]);
  const { camera } = useThree();
  const autoWander = useForestStore((s) => s.walkPlaying);
  const autoT = useRef(useForestStore.getState().walkProgress);

  // Track velocity separately from position for smooth accel / damping.
  const vel = useRef({ x: 0, z: 0 });
  const posInit = useRef(false);

  // Expose the camera to parents that need it (LOD, HUD).
  useEffect(() => {
    if (cameraRef) cameraRef.current = camera;
  }, [cameraRef, camera]);

  useEffect(
    () => useForestStore.subscribe((s) => { autoT.current = s.walkProgress; }),
    [],
  );

  const trunks = useMemo(() => buildHash(data.trees), [data.trees]);

  const tmpAhead = useMemo(() => new THREE.Vector3(), []);
  const tmpPos = useMemo(() => new THREE.Vector3(), []);
  const tmpTarget = useMemo(() => new THREE.Vector3(), []);

  useFrame((_, deltaRaw) => {
    const delta = Math.min(deltaRaw, 0.1); // Clamp huge deltas after tab switch.

    // Initialise player position at path start on first frame.
    if (!posInit.current) {
      path.getPointAt(0, tmpPos);
      camera.position.set(tmpPos.x, 1.6, tmpPos.z);
      posInit.current = true;
    }

    // Compute look yaw from drag deltas (already applied by controls).
    const yaw = lookRef.yaw;
    const pitch = lookRef.pitch;

    // Movement input (joystick + keyboard). If auto-wander is on and there's
    // no user input, follow the path.
    const inputX = moveRef.x;
    const inputZ = moveRef.z;
    const hasInput = Math.hypot(inputX, inputZ) > 0.02;

    if (autoWander && !hasInput && !reducedMotion) {
      autoT.current = (autoT.current + delta * 0.012) % 1;
      if (Math.floor(autoT.current * 400) % 100 === 0) {
        useForestStore.getState().setWalkProgress(autoT.current);
      }
      path.getPointAt(autoT.current, tmpPos);
      path.getPointAt((autoT.current + 0.01) % 1, tmpAhead);
      // Move smoothly toward path target rather than teleporting.
      const dx = tmpPos.x - camera.position.x;
      const dz = tmpPos.z - camera.position.z;
      const d = Math.hypot(dx, dz);
      if (d > 0.001) {
      const stepDist = Math.min(d, MAX_SPEED * 0.6 * delta);
        camera.position.x += (dx / d) * stepDist;
        camera.position.z += (dz / d) * stepDist;
      }
      vel.current.x = 0;
      vel.current.z = 0;
      const baseYaw = Math.atan2(tmpAhead.x - tmpPos.x, tmpAhead.z - tmpPos.z);
      applyLook(camera, baseYaw + yaw, pitch, tmpTarget);
      forestAudio.onMotion(MAX_SPEED * 0.6, delta);
      return;
    }

    // Free roam: yaw-relative WASD/joystick.
    // Local input (x = strafe right, z = forward). Convert to world using yaw.
    const cosY = Math.cos(yaw);
    const sinY = Math.sin(yaw);
    // In three.js, camera looks toward -Z locally; our yaw treats +Z as forward
    // (see applyLook below). Forward vector: (sin(yaw), 0, cos(yaw)).
    // Right vector: (cos(yaw), 0, -sin(yaw)).
    const wx = inputX * cosY + inputZ * sinY;
    const wz = -inputX * sinY + inputZ * cosY;

    const targetVX = wx * MAX_SPEED;
    const targetVZ = wz * MAX_SPEED;
    // Accelerate toward target, damp when no input.
    if (hasInput) {
      vel.current.x += (targetVX - vel.current.x) * Math.min(1, ACCEL * delta);
      vel.current.z += (targetVZ - vel.current.z) * Math.min(1, ACCEL * delta);
    } else {
      vel.current.x -= vel.current.x * Math.min(1, DAMPING * delta);
      vel.current.z -= vel.current.z * Math.min(1, DAMPING * delta);
    }

    // Attempt XZ move with collision resolve.
    const nextX = camera.position.x + vel.current.x * delta;
    const nextZ = camera.position.z + vel.current.z * delta;
    const { x: rx, z: rz, hitTrunk } = resolve(trunks, nextX, nextZ);
    camera.position.x = rx;
    camera.position.y = 1.6;
    camera.position.z = rz;

    const speed = Math.hypot(vel.current.x, vel.current.z);
    if (speed > 0.4) forestAudio.onMotion(speed, delta);
    if (hitTrunk && speed > 0.6) {
      forestAudio.playRustle(0.3);
      // Absorb velocity along the collision normal.
      vel.current.x *= 0.3;
      vel.current.z *= 0.3;
    }

    applyLook(camera, yaw, pitch, tmpTarget);
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

function applyLook(camera: THREE.Camera, yaw: number, pitch: number, tmp: THREE.Vector3) {
  const dist = 4;
  tmp.set(
    camera.position.x + Math.sin(yaw) * Math.cos(pitch) * dist,
    1.6 + Math.sin(pitch) * dist,
    camera.position.z + Math.cos(yaw) * Math.cos(pitch) * dist,
  );
  camera.lookAt(tmp);
}

function resolve(hash: Hash, x: number, z: number): { x: number; z: number; hitTrunk: boolean } {
  // World bounds (soft circular).
  const distC = Math.hypot(x, z);
  let hit = false;
  if (distC > WORLD_RADIUS) {
    x = (x / distC) * WORLD_RADIUS;
    z = (z / distC) * WORLD_RADIUS;
    hit = true;
  }
  // Trunk collisions from neighbouring cells.
  const cx = Math.floor(x / CELL);
  const cz = Math.floor(z / CELL);
  for (let dx = -1; dx <= 1; dx++) {
    for (let dz = -1; dz <= 1; dz++) {
      const list = hash.get(`${cx + dx},${cz + dz}`);
      if (!list) continue;
      for (const t of list) {
        const ex = x - t.x;
        const ez = z - t.z;
        const d = Math.hypot(ex, ez);
        if (d < COLLISION_RADIUS && d > 0.0001) {
          // Push out along the normal.
          const push = COLLISION_RADIUS - d;
          x += (ex / d) * push;
          z += (ez / d) * push;
          hit = true;
        }
      }
    }
  }
  return { x, z, hitTrunk: hit };
}
