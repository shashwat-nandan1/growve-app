# 3D Model Attribution

All models in this directory are derived from the **Ultimate Stylized Nature
MegaKit** by **Quaternius** (https://quaternius.com/packs/stylizednaturemegakit.html),
released under CC0 1.0. Provenance is retained per Growve's asset policy.

## Pipeline
- Source FBX from the CC0 pack.
- Converted to glTF 2.0 (`.glb`) via Blender 5 (`export_scene.gltf`,
  `export_apply=True`).
- Optimised for mobile web with `gltfpack` (Meshopt quantisation + mesh
  instancing + 15 % simplification). Requires `MeshoptDecoder` at load time.
- Only the meshes actually used by the app were converted; the rest of the
  pack was discarded.

## Species mapping
The Growve species are visually distinct through the choice of source model
and per-species colour/scale tuning at render time (see
`src/features/forest/species.ts`).

| Growve species    | Source model(s)                     |
| ----------------- | ----------------------------------- |
| Oak               | `NormalTree_1`, `NormalTree_3`      |
| Pine              | `PineTree_1`, `PineTree_3`          |
| Birch             | `BirchTree_1`, `BirchTree_3`        |
| Willow            | `NormalTree_3` (broadened, cooler foliage) |
| Japanese maple    | `MapleTree_1`                       |
| Cherry blossom    | `MapleTree_3` (pink foliage tint)   |

## Decoration models
Grass (`Grass_Large`, `Grass_Small`), plants (`Plant_1`, `Plant_Flowers`),
bushes (`Bush_Small`), rocks (`Rock_1`, `Rock_3`), and fallen dead trees
(`DeadTree_1`, `DeadTree_5`) — same source pack, same pipeline.
