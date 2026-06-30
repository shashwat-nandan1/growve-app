// Species visual registry. GLB asset slots are placeholders for future swap-in.
// Until a GLB exists, the renderer falls back to a procedural low-poly tree
// using the trunk/foliage palette below.

export type SpeciesVisual = {
  slug: string;
  trunkColor: string;
  foliageColor: string;
  foliageShape: "cone" | "sphere" | "ovoid";
  trunkHeight: number;   // base, multiplied by tree scale
  trunkRadius: number;
  foliageRadius: number;
  foliageHeight: number;
  /** Future: path to a Draco/KTX2-compressed GLB. null → use procedural mesh. */
  glbUrl: string | null;
};

const DEFAULT: SpeciesVisual = {
  slug: "default",
  trunkColor: "#755B45",
  foliageColor: "#54745B",
  foliageShape: "cone",
  trunkHeight: 1.4,
  trunkRadius: 0.18,
  foliageRadius: 1.1,
  foliageHeight: 2.2,
  glbUrl: null,
};

const REGISTRY: Record<string, SpeciesVisual> = {
  oak:           { slug: "oak",           trunkColor: "#6B4A2E", foliageColor: "#4F6B47", foliageShape: "sphere", trunkHeight: 1.6, trunkRadius: 0.22, foliageRadius: 1.4, foliageHeight: 1.6, glbUrl: null },
  pine:          { slug: "pine",          trunkColor: "#5A3F2A", foliageColor: "#2F5A3F", foliageShape: "cone",   trunkHeight: 1.2, trunkRadius: 0.16, foliageRadius: 1.0, foliageHeight: 2.8, glbUrl: null },
  birch:         { slug: "birch",         trunkColor: "#D9D2C3", foliageColor: "#7E9A6A", foliageShape: "ovoid",  trunkHeight: 1.8, trunkRadius: 0.14, foliageRadius: 0.9, foliageHeight: 2.0, glbUrl: null },
  willow:        { slug: "willow",        trunkColor: "#6E5A3F", foliageColor: "#8AA176", foliageShape: "sphere", trunkHeight: 1.4, trunkRadius: 0.18, foliageRadius: 1.6, foliageHeight: 1.4, glbUrl: null },
  "japanese-maple": { slug: "japanese-maple", trunkColor: "#5C3A22", foliageColor: "#A14A3A", foliageShape: "sphere", trunkHeight: 1.2, trunkRadius: 0.16, foliageRadius: 1.2, foliageHeight: 1.4, glbUrl: null },
  "cherry-blossom": { slug: "cherry-blossom", trunkColor: "#5C3A28", foliageColor: "#F0C2D4", foliageShape: "sphere", trunkHeight: 1.4, trunkRadius: 0.18, foliageRadius: 1.3, foliageHeight: 1.4, glbUrl: null },
};

export function getSpeciesVisual(slug: string | null | undefined): SpeciesVisual {
  if (!slug) return DEFAULT;
  return REGISTRY[slug] ?? DEFAULT;
}
