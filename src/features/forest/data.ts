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
  tree_species: { name: string; slug: string } | null;
  habit_logs: { habit: { name: string } | null } | null;
};

export function useForestData(ownerId: string | undefined, seed: number | undefined) {
  return useQuery({
    queryKey: ["forest-3d", ownerId],
    enabled: !!ownerId,
    queryFn: async (): Promise<ForestData> => {
      const { data, error } = await supabase
        .from("forest_trees")
        .select(
          "id, position_x, position_z, rotation_y, scale, planted_at, tree_species_id, tree_species(name, slug), habit_logs:habit_log_id(habit:habit_id(name))",
        )
        .eq("owner_id", ownerId!)
        .order("planted_at", { ascending: true });
      if (error) throw error;
      const rows = (data ?? []) as unknown as Row[];
      const trees: ForestTree[] = rows.map((r) => ({
        id: r.id,
        position_x: r.position_x,
        position_z: r.position_z,
        rotation_y: r.rotation_y ?? 0,
        scale: r.scale ?? 1,
        planted_at: r.planted_at,
        tree_species_id: r.tree_species_id,
        species_slug: r.tree_species?.slug ?? "default",
        species_name: r.tree_species?.name ?? "Tree",
        habit_name: r.habit_logs?.habit?.name ?? null,
      }));
      return { trees, seed: seed ?? 1, ownerId: ownerId! };
    },
  });
}
