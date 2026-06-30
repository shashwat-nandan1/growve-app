import { useMemo, useState } from "react";
import type { ForestTree } from "./types";
import { Plaque } from "./ui/Plaque";

export function Fallback2D({ trees, reason }: { trees: ForestTree[]; reason?: string }) {
  const [selected, setSelected] = useState<ForestTree | null>(null);

  const bounds = useMemo(() => {
    if (!trees.length) return { minX: -25, maxX: 25, minZ: -25, maxZ: 25 };
    const xs = trees.map((t) => t.position_x);
    const zs = trees.map((t) => t.position_z);
    const pad = 6;
    return {
      minX: Math.min(...xs) - pad, maxX: Math.max(...xs) + pad,
      minZ: Math.min(...zs) - pad, maxZ: Math.max(...zs) + pad,
    };
  }, [trees]);

  const w = 360, h = 360;
  const sx = (x: number) => ((x - bounds.minX) / (bounds.maxX - bounds.minX || 1)) * w;
  const sz = (z: number) => ((z - bounds.minZ) / (bounds.maxZ - bounds.minZ || 1)) * h;

  return (
    <div className="relative">
      <div className="overflow-hidden rounded-3xl border border-border bg-gradient-to-b from-mist to-parchment shadow-soft">
        {trees.length === 0 ? (
          <div className="grid h-[360px] place-items-center px-6 text-center">
            <p className="text-sm text-muted-foreground">
              Your forest is still a clearing.<br />Tend a habit to plant your first tree.
            </p>
          </div>
        ) : (
          <svg viewBox={`0 0 ${w} ${h}`} className="block h-[360px] w-full">
            <circle cx={sx(0)} cy={sz(0)} r="14" fill="oklch(0.88 0.02 140)" opacity="0.7" />
            {trees.map((t) => (
              <g key={t.id} transform={`translate(${sx(t.position_x)} ${sz(t.position_z)})`} className="cursor-pointer" onClick={() => setSelected(t)}>
                <circle r={6 * (t.scale || 1) + 2} fill="oklch(0.32 0.045 152)" opacity="0.12" />
                <circle r={5 * (t.scale || 1)} fill={selected?.id === t.id ? "#18392B" : "#54745B"} />
              </g>
            ))}
          </svg>
        )}
      </div>
      {reason && <p className="mt-2 text-center text-xs text-muted-foreground">{reason}</p>}
      <div className="relative">
        {selected && <Plaque tree={selected} onClose={() => setSelected(null)} />}
      </div>
    </div>
  );
}
