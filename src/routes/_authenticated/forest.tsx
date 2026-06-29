import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { AppShell } from "@/components/AppShell";

export const Route = createFileRoute("/_authenticated/forest")({
  head: () => ({ meta: [{ title: "Your forest — Growve" }] }),
  component: ForestPage,
});

type TreeRow = {
  id: string; position_x: number; position_z: number; scale: number;
  planted_at: string;
  tree_species: { name: string; slug: string } | null;
  habit_logs: { habit: { name: string } | null } | null;
};

function ForestPage() {
  const { user } = useAuth();
  const [selected, setSelected] = useState<TreeRow | null>(null);

  const forest = useQuery({
    queryKey: ["forest", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("forest_trees")
        .select("id, position_x, position_z, scale, planted_at, tree_species(name, slug), habit_logs:habit_log_id(habit:habit_id(name))")
        .eq("owner_id", user!.id)
        .order("planted_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as TreeRow[];
    },
  });

  const bounds = useMemo(() => {
    const trees = forest.data ?? [];
    if (!trees.length) return { minX: -25, maxX: 25, minZ: -25, maxZ: 25 };
    const xs = trees.map((t) => t.position_x);
    const zs = trees.map((t) => t.position_z);
    const pad = 6;
    return {
      minX: Math.min(...xs) - pad, maxX: Math.max(...xs) + pad,
      minZ: Math.min(...zs) - pad, maxZ: Math.max(...zs) + pad,
    };
  }, [forest.data]);

  const w = 360, h = 360;
  const sx = (x: number) => ((x - bounds.minX) / (bounds.maxX - bounds.minX || 1)) * w;
  const sz = (z: number) => ((z - bounds.minZ) / (bounds.maxZ - bounds.minZ || 1)) * h;

  return (
    <AppShell>
      <header>
        <h1 className="font-display text-3xl text-forest">Your forest</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {forest.data?.length ?? 0} {forest.data?.length === 1 ? "tree" : "trees"} planted.
        </p>
      </header>

      <div className="mt-6 overflow-hidden rounded-3xl border border-border bg-gradient-to-b from-mist to-parchment shadow-soft">
        {forest.isLoading ? (
          <div className="grid h-[360px] place-items-center">
            <div className="h-2 w-24 animate-pulse rounded-full bg-sage/40" />
          </div>
        ) : forest.data && forest.data.length > 0 ? (
          <svg viewBox={`0 0 ${w} ${h}`} className="block h-[360px] w-full">
            <circle cx={sx(0)} cy={sz(0)} r="14" fill="oklch(0.88 0.02 140)" opacity="0.7" />
            {forest.data.map((t) => (
              <g key={t.id} transform={`translate(${sx(t.position_x)} ${sz(t.position_z)})`} className="cursor-pointer" onClick={() => setSelected(t)}>
                <circle r={6 * t.scale + 2} fill="oklch(0.32 0.045 152)" opacity="0.12" />
                <circle r={5 * t.scale} fill={selected?.id === t.id ? "#18392B" : "#54745B"} />
              </g>
            ))}
          </svg>
        ) : (
          <div className="grid h-[360px] place-items-center px-6 text-center">
            <p className="text-sm text-muted-foreground">
              Your forest is still a clearing.<br />Tend a habit to plant your first tree.
            </p>
          </div>
        )}
      </div>

      {selected && (
        <div className="animate-mist-fade mt-5 grove-card p-5">
          <p className="text-xs uppercase tracking-widest text-muted-foreground">Tree</p>
          <h2 className="mt-1 font-display text-xl text-forest">{selected.tree_species?.name}</h2>
          {selected.habit_logs?.habit?.name && (
            <p className="mt-1 text-sm text-moss">From "{selected.habit_logs.habit.name}"</p>
          )}
          <p className="mt-2 text-xs text-muted-foreground">
            Planted {new Date(selected.planted_at).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" })}
          </p>
        </div>
      )}
    </AppShell>
  );
}
