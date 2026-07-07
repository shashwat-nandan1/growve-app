// Species visual registry backed by Quaternius Stylized Nature MegaKit GLBs
// (CC0). See public/models/ATTRIBUTION.md. We map each Growve species to a
// source model and apply per-species foliage tint / crown proportions so each
// remains visually distinct.

export type SpeciesVisual = {
  slug: string;
  /** URL of the GLB inside public/models. */
  glbUrl: string;
  /** Optional secondary LOD (simpler model) for far distances. */
  glbUrlFar?: string;
  /** Uniform mesh scale multiplier. Base pack sits around 1 unit trunks. */
  scale: number;
  /** Optional multiplicative colour applied to the foliage material. */
  foliageTint: string | null;
  /** Optional multiplicative colour applied to the trunk material. */
  trunkTint: string | null;
  /** Human display name. */
  displayName: string;
};

const DEFAULT: SpeciesVisual = {
  slug: "default",
  glbUrl: "/models/NormalTree_1.glb",
  glbUrlFar: "/models/NormalTree_3.glb",
  scale: 0.6,
  foliageTint: null,
  trunkTint: null,
  displayName: "Tree",
};

const REGISTRY: Record<string, SpeciesVisual> = {
  oak: {
    slug: "oak", displayName: "Oak",
    glbUrl: "/models/NormalTree_1.glb",
    glbUrlFar: "/models/NormalTree_3.glb",
    scale: 0.7, foliageTint: "#6a8558", trunkTint: null,
  },
  pine: {
    slug: "pine", displayName: "Pine",
    glbUrl: "/models/PineTree_1.glb",
    glbUrlFar: "/models/PineTree_3.glb",
    scale: 0.75, foliageTint: "#3f5f45", trunkTint: null,
  },
  birch: {
    slug: "birch", displayName: "Birch",
    glbUrl: "/models/BirchTree_1.glb",
    glbUrlFar: "/models/BirchTree_3.glb",
    scale: 0.7, foliageTint: "#94ac74", trunkTint: "#e2ddd0",
  },
  willow: {
    slug: "willow", displayName: "Willow",
    glbUrl: "/models/NormalTree_3.glb",
    glbUrlFar: "/models/NormalTree_1.glb",
    scale: 0.8, foliageTint: "#9ab27a", trunkTint: "#7a6247",
  },
  "japanese-maple": {
    slug: "japanese-maple", displayName: "Japanese maple",
    glbUrl: "/models/MapleTree_1.glb",
    glbUrlFar: "/models/MapleTree_3.glb",
    scale: 0.55, foliageTint: "#b04a3a", trunkTint: "#5c3a22",
  },
  "cherry-blossom": {
    slug: "cherry-blossom", displayName: "Cherry blossom",
    glbUrl: "/models/MapleTree_3.glb",
    glbUrlFar: "/models/MapleTree_1.glb",
    scale: 0.65, foliageTint: "#efc2d4", trunkTint: "#5c3a28",
  },
};

export function getSpeciesVisual(slug: string | null | undefined): SpeciesVisual {
  if (!slug) return DEFAULT;
  return REGISTRY[slug] ?? DEFAULT;
}

export function allSpeciesUrls(): string[] {
  const set = new Set<string>();
  set.add(DEFAULT.glbUrl); if (DEFAULT.glbUrlFar) set.add(DEFAULT.glbUrlFar);
  for (const v of Object.values(REGISTRY)) {
    set.add(v.glbUrl);
    if (v.glbUrlFar) set.add(v.glbUrlFar);
  }
  return Array.from(set);
}
