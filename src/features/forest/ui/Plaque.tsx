import type { ForestTree } from "../types";
import { ageDescription } from "../growth";

export function Plaque({ tree, onClose }: { tree: ForestTree; onClose: () => void }) {
  return (
    <div
      className="animate-mist-fade pointer-events-auto absolute inset-x-0 bottom-0 z-10 px-4 pb-6"
      role="dialog"
      aria-label={`${tree.species_name} details`}
    >
      <div className="mx-auto max-w-md rounded-3xl border border-border bg-[color-mix(in_oklch,var(--color-parchment)_88%,transparent)] p-5 shadow-lift backdrop-blur-md">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs uppercase tracking-widest text-muted-foreground">
              {ageDescription(tree.planted_at)}
            </p>
            <h2 className="mt-0.5 truncate font-display text-xl text-forest">{tree.species_name}</h2>
            {tree.habit_name && (
              <p className="mt-1 truncate text-sm text-moss">From "{tree.habit_name}"</p>
            )}
            <p className="mt-2 text-xs text-muted-foreground">
              Planted {new Date(tree.planted_at).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" })}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-full px-3 py-1 text-xs text-moss hover:bg-mist"
            aria-label="Close"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
