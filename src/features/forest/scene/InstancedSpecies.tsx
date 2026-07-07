import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame, type ThreeEvent } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import type { ForestTree } from "../types";
import { getSpeciesVisual, allSpeciesUrls } from "../species";
import { ageScale } from "../growth";
import { useForestStore } from "../store";

type Props = {
  trees: ForestTree[];
  quality: "low" | "high";
  windEnabled: boolean;
  /** Camera position for LOD / culling decisions. */
  cameraRef?: { current: THREE.Camera | null };
};

// Preload every species GLB up front so switching species doesn't stutter.
allSpeciesUrls().forEach((u) => useGLTF.preload(u));

/**
 * Extracts trunk + foliage meshes from a Quaternius stylized-nature GLB.
 * Trunks tend to be brown-brushed materials, foliage is green/tinted — we
 * classify by material colour luminance in the green channel.
 */
function extractParts(scene: THREE.Object3D): {
  trunk: { geometry: THREE.BufferGeometry; material: THREE.MeshStandardMaterial } | null;
  foliage: { geometry: THREE.BufferGeometry; material: THREE.MeshStandardMaterial } | null;
} {
  let trunk: { geometry: THREE.BufferGeometry; material: THREE.MeshStandardMaterial } | null = null;
  let foliage: { geometry: THREE.BufferGeometry; material: THREE.MeshStandardMaterial } | null = null;
  scene.updateMatrixWorld(true);
  scene.traverse((child) => {
    const m = child as THREE.Mesh;
    if (!m.isMesh || !m.geometry) return;
    const mat = m.material as THREE.MeshStandardMaterial | THREE.MeshStandardMaterial[];
    const base = Array.isArray(mat) ? mat[0] : mat;
    const col = (base as THREE.MeshStandardMaterial).color ?? new THREE.Color("#888");
    // Bake local transforms into geometry so instance matrices apply cleanly.
    const geom = m.geometry.clone();
    geom.applyMatrix4(m.matrixWorld);
    const isFoliage = col.g > col.r && col.g > col.b * 0.9;
    const material = (base as THREE.MeshStandardMaterial).clone();
    material.flatShading = false;
    material.roughness = 0.9;
    if (isFoliage) {
      if (foliage) {
        // Merge additional foliage geometries by simple concat is not trivial —
        // fall back to first one, which covers all packed models we ship.
        return;
      }
      foliage = { geometry: geom, material };
    } else {
      if (trunk) return;
      trunk = { geometry: geom, material };
    }
  });
  return { trunk, foliage };
}

export function InstancedSpecies({ trees, quality, windEnabled, cameraRef }: Props) {
  const groups = useMemo(() => {
    const map = new Map<string, ForestTree[]>();
    for (const t of trees) {
      const arr = map.get(t.species_slug) ?? [];
      arr.push(t);
      map.set(t.species_slug, arr);
    }
    return Array.from(map.entries());
  }, [trees]);

  return (
    <>
      {groups.map(([slug, list]) => (
        <SpeciesInstances key={slug} slug={slug} trees={list} quality={quality} windEnabled={windEnabled} cameraRef={cameraRef} />
      ))}
    </>
  );
}

function SpeciesInstances({
  slug, trees, quality, windEnabled, cameraRef,
}: { slug: string; trees: ForestTree[]; quality: "low" | "high"; windEnabled: boolean; cameraRef?: { current: THREE.Camera | null } }) {
  const visual = getSpeciesVisual(slug);
  const gltfNear = useGLTF(visual.glbUrl) as unknown as { scene: THREE.Object3D };
  const gltfFar  = useGLTF(visual.glbUrlFar ?? visual.glbUrl) as unknown as { scene: THREE.Object3D };

  const partsNear = useMemo(() => extractParts(gltfNear.scene.clone(true)), [gltfNear]);
  const partsFar  = useMemo(() => extractParts(gltfFar.scene.clone(true)), [gltfFar]);

  // Tint materials per species. Cloned already in extractParts.
  useEffect(() => {
    for (const parts of [partsNear, partsFar]) {
      if (parts.foliage && visual.foliageTint) parts.foliage.material.color.set(visual.foliageTint);
      if (parts.trunk && visual.trunkTint)     parts.trunk.material.color.set(visual.trunkTint);
    }
  }, [partsNear, partsFar, visual.foliageTint, visual.trunkTint]);

  // LOD partitioning by distance to camera. Trees inside NEAR_DIST render
  // as `partsNear`; the rest render as `partsFar` (simpler geometry). Any
  // tree beyond FAR_CULL is culled entirely — the fog hides the transition.
  const NEAR_DIST = quality === "low" ? 14 : 22;
  const FAR_CULL  = quality === "low" ? 55 : 90;

  const partitionRef = useRef<{ near: number[]; far: number[] }>({ near: trees.map((_, i) => i), far: [] });
  const lastCamKey = useRef<string>("");

  const trunkNearRef = useRef<THREE.InstancedMesh>(null);
  const foliageNearRef = useRef<THREE.InstancedMesh>(null);
  const trunkFarRef = useRef<THREE.InstancedMesh>(null);
  const foliageFarRef = useRef<THREE.InstancedMesh>(null);

  const tmpObj = useMemo(() => new THREE.Object3D(), []);
  const selected = useForestStore((s) => s.selected);
  const setSelected = useForestStore((s) => s.setSelected);

  const nowRef = useRef(Date.now());

  const writeMatrices = (near: number[], far: number[]) => {
    const meshes = [
      { mesh: trunkNearRef.current, indices: near, isFoliage: false },
      { mesh: foliageNearRef.current, indices: near, isFoliage: true },
      { mesh: trunkFarRef.current, indices: far, isFoliage: false },
      { mesh: foliageFarRef.current, indices: far, isFoliage: true },
    ];
    for (const { mesh, indices, isFoliage } of meshes) {
      if (!mesh) continue;
      mesh.count = indices.length;
      for (let i = 0; i < indices.length; i++) {
        const t = trees[indices[i]];
        const s = ageScale(t.planted_at, t.scale || 1, nowRef.current) * visual.scale;
        tmpObj.position.set(t.position_x, 0, t.position_z);
        tmpObj.rotation.set(0, t.rotation_y, 0);
        tmpObj.scale.setScalar(s);
        if (isFoliage && selected?.id === t.id) {
          // subtle emphasise by slightly larger scale
          tmpObj.scale.setScalar(s * 1.05);
        }
        tmpObj.updateMatrix();
        mesh.setMatrixAt(i, tmpObj.matrix);
      }
      mesh.instanceMatrix.needsUpdate = true;
      mesh.computeBoundingSphere();
    }
  };

  // Initial full write.
  useEffect(() => {
    nowRef.current = Date.now();
    partitionRef.current = { near: trees.map((_, i) => i), far: [] };
    writeMatrices(partitionRef.current.near, partitionRef.current.far);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trees, visual]);

  // Repartition periodically as the camera moves. Throttle to every ~15 frames.
  const frameSkip = useRef(0);
  useFrame(() => {
    if (!cameraRef?.current) return;
    frameSkip.current += 1;
    if (frameSkip.current < 15) return;
    frameSkip.current = 0;
    const cam = cameraRef.current;
    const key = `${Math.round(cam.position.x)}|${Math.round(cam.position.z)}`;
    if (key === lastCamKey.current) return;
    lastCamKey.current = key;
    const near: number[] = [];
    const far: number[] = [];
    for (let i = 0; i < trees.length; i++) {
      const t = trees[i];
      const dx = t.position_x - cam.position.x;
      const dz = t.position_z - cam.position.z;
      const d = Math.hypot(dx, dz);
      if (d > FAR_CULL) continue;
      if (d < NEAR_DIST) near.push(i); else far.push(i);
    }
    partitionRef.current = { near, far };
    writeMatrices(near, far);
  });

  // Gentle vertex-shader-free sway: rotate the foliage InstancedMeshes as a
  // whole around Y with a tiny angle. Since foliage is packed near its own
  // origin after transform bake, this looks like a subtle canopy motion.
  useFrame((state) => {
    if (!windEnabled) return;
    const t = state.clock.elapsedTime;
    for (const m of [foliageNearRef.current, foliageFarRef.current]) {
      if (!m) continue;
      m.rotation.z = Math.sin(t * 0.4) * 0.008;
      m.rotation.x = Math.cos(t * 0.3) * 0.006;
    }
  });

  const onPick = (ev: ThreeEvent<MouseEvent>) => {
    ev.stopPropagation();
    const id = ev.instanceId;
    if (id == null) return;
    const idxList = ev.eventObject.userData.isFar
      ? partitionRef.current.far
      : partitionRef.current.near;
    const treeIdx = idxList[id];
    if (treeIdx == null) return;
    const tree = trees[treeIdx];
    if (tree) setSelected(tree);
  };

  if (trees.length === 0) return null;

  return (
    <group>
      {partsNear.trunk && (
        <instancedMesh
          ref={trunkNearRef}
          args={[partsNear.trunk.geometry, partsNear.trunk.material, trees.length]}
          castShadow={quality === "high"}
          receiveShadow
          onPointerDown={onPick}
          userData={{ isFar: false }}
        />
      )}
      {partsNear.foliage && (
        <instancedMesh
          ref={foliageNearRef}
          args={[partsNear.foliage.geometry, partsNear.foliage.material, trees.length]}
          castShadow={quality === "high"}
          onPointerDown={onPick}
          userData={{ isFar: false }}
        />
      )}
      {partsFar.trunk && (
        <instancedMesh
          ref={trunkFarRef}
          args={[partsFar.trunk.geometry, partsFar.trunk.material, trees.length]}
          receiveShadow
          onPointerDown={onPick}
          userData={{ isFar: true }}
        />
      )}
      {partsFar.foliage && (
        <instancedMesh
          ref={foliageFarRef}
          args={[partsFar.foliage.geometry, partsFar.foliage.material, trees.length]}
          onPointerDown={onPick}
          userData={{ isFar: true }}
        />
      )}
    </group>
  );
}
