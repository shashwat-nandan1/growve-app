import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { ForestData, ForestTree } from "./types";

type Row = {
  id: string;
  position_x: number;
  position_z: number;
  rotation_y: number;
  scale: number;
  planted_at: string;
  tree_species_id: string;
  species_slug: string | null;
  species_name: string | null;
  habit_name: string | null;
};

export type ForestLoadError = "forest_not_visible" | "unknown";

export function useForestData(ownerId: string | undefined) {
  return useQuery<ForestData, Error & { code?: ForestLoadError }>({
    queryKey: ["forest-3d", ownerId],
    enabled: !!ownerId,
    retry: false,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_visible_forest", { _owner_id: ownerId! });
      if (error) {
        const err = new Error(error.message) as Error & { code?: ForestLoadError };
        err.code = error.message?.includes("forest_not_visible") ? "forest_not_visible" : "unknown";
        throw err;
      }
      const rows = (data ?? []) as unknown as Row[];
      const trees: ForestTree[] = rows.map((r) => ({
        id: r.id,
        position_x: r.position_x,
        position_z: r.position_z,
        rotation_y: r.rotation_y ?? 0,
        scale: r.scale ?? 1,
        planted_at: r.planted_at,
        tree_species_id: r.tree_species_id,
        species_slug: r.species_slug ?? "default",
        species_name: r.species_name ?? "Tree",
        habit_name: r.habit_name ?? null,
      }));
      return { trees, seed: 1, ownerId: ownerId! };
    },
  });
}
