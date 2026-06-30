export type ForestTree = {
  id: string;
  position_x: number;
  position_z: number;
  rotation_y: number;
  scale: number;
  planted_at: string;
  tree_species_id: string;
  species_slug: string;
  species_name: string;
  habit_name: string | null;
};

export type ForestData = {
  trees: ForestTree[];
  seed: number;
  ownerId: string;
};

export type QualityMode = "auto" | "low" | "high";
