import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame, type ThreeEvent } from "@react-three/fiber";
import type { ForestTree } from "../types";
import { getSpeciesVisual } from "../species";
import { ageScale } from "../growth";
import { useForestStore } from "../store";

type Props = {
  trees: ForestTree[];
  quality: "low" | "high";
  windEnabled: boolean;
};

// Render one InstancedMesh pair (trunk + foliage) per species.
export function InstancedSpecies({ trees, quality, windEnabled }: Props) {
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
        <SpeciesInstances key={slug} slug={slug} trees={list} quality={quality} windEnabled={windEnabled} />
      ))}
    </>
  );
}

function SpeciesInstances({
  slug, trees, quality, windEnabled,
}: { slug: string; trees: ForestTree[]; quality: "low" | "high"; windEnabled: boolean }) {
  const visual = getSpeciesVisual(slug);
  const trunkRef = useRef<THREE.InstancedMesh>(null!);
  const foliageRef = useRef<THREE.InstancedMesh>(null!);
  const tmpObj = useMemo(() => new THREE.Object3D(), []);
  const tmpColor = useMemo(() => new THREE.Color(), []);
  const selected = useForestStore((s) => s.selected);
  const setSelected = useForestStore((s) => s.setSelected);

  // Foliage geometry per species shape
  const foliageGeometry = useMemo(() => {
    const detail = quality === "low" ? 0 : 1;
    if (visual.foliageShape === "cone") return new THREE.ConeGeometry(visual.foliageRadius, visual.foliageHeight, quality === "low" ? 6 : 8);
    if (visual.foliageShape === "ovoid") {
      const g = new THREE.SphereGeometry(visual.foliageRadius, quality === "low" ? 6 : 10, quality === "low" ? 4 : 8);
      g.scale(1, visual.foliageHeight / (visual.foliageRadius * 2), 1);
      return g;
    }
    return new THREE.IcosahedronGeometry(visual.foliageRadius, detail);
  }, [visual, quality]);

  const trunkGeometry = useMemo(
    () => new THREE.CylinderGeometry(visual.trunkRadius * 0.8, visual.trunkRadius, visual.trunkHeight, quality === "low" ? 5 : 7),
    [visual, quality],
  );

  // Initial matrix + color writes
  useEffect(() => {
    if (!trunkRef.current || !foliageRef.current) return;
    const now = Date.now();
    for (let i = 0; i < trees.length; i++) {
      const t = trees[i];
      const s = ageScale(t.planted_at, t.scale || 1, now);

      // trunk
      tmpObj.position.set(t.position_x, (visual.trunkHeight * s) / 2, t.position_z);
      tmpObj.rotation.set(0, t.rotation_y, 0);
      tmpObj.scale.set(s, s, s);
      tmpObj.updateMatrix();
      trunkRef.current.setMatrixAt(i, tmpObj.matrix);
      trunkRef.current.setColorAt?.(i, tmpColor.set(visual.trunkColor));

      // foliage
      tmpObj.position.set(
        t.position_x,
        visual.trunkHeight * s + (visual.foliageHeight * s) / 2 - 0.1,
        t.position_z,
      );
      tmpObj.updateMatrix();
      foliageRef.current.setMatrixAt(i, tmpObj.matrix);
      foliageRef.current.setColorAt?.(i, tmpColor.set(visual.foliageColor));
    }
    trunkRef.current.instanceMatrix.needsUpdate = true;
    foliageRef.current.instanceMatrix.needsUpdate = true;
    if (trunkRef.current.instanceColor) trunkRef.current.instanceColor.needsUpdate = true;
    if (foliageRef.current.instanceColor) foliageRef.current.instanceColor.needsUpdate = true;
    trunkRef.current.computeBoundingSphere();
    foliageRef.current.computeBoundingSphere();
  }, [trees, visual, tmpObj, tmpColor]);

  // Highlight selected via color tint (subtle, no game outline)
  useEffect(() => {
    const mesh = foliageRef.current;
    if (!mesh) return;
    for (let i = 0; i < trees.length; i++) {
      const t = trees[i];
      const isSel = selected?.id === t.id;
      tmpColor.set(visual.foliageColor);
      if (isSel) tmpColor.lerp(new THREE.Color("#ffffff"), 0.18);
      mesh.setColorAt?.(i, tmpColor);
    }
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [selected, trees, visual, tmpColor]);

  // Subtle wind sway on the foliage instanced mesh as a whole.
  useFrame((state) => {
    if (!windEnabled || !foliageRef.current) return;
    const t = state.clock.elapsedTime;
    foliageRef.current.rotation.z = Math.sin(t * 0.4) * 0.012;
    foliageRef.current.rotation.x = Math.cos(t * 0.3) * 0.008;
  });

  const onPick = (ev: ThreeEvent<MouseEvent>) => {
    ev.stopPropagation();
    const id = ev.instanceId;
    if (id == null) return;
    const tree = trees[id];
    if (tree) setSelected(tree);
  };

  if (trees.length === 0) return null;

  return (
    <group>
      <instancedMesh
        ref={trunkRef}
        args={[trunkGeometry, undefined, trees.length]}
        castShadow={quality === "high"}
        receiveShadow
        onClick={onPick}
      >
        <meshStandardMaterial vertexColors roughness={1} />
      </instancedMesh>
      <instancedMesh
        ref={foliageRef}
        args={[foliageGeometry, undefined, trees.length]}
        castShadow={quality === "high"}
        onClick={onPick}
      >
        <meshStandardMaterial vertexColors roughness={0.85} flatShading />
      </instancedMesh>
    </group>
  );
}
