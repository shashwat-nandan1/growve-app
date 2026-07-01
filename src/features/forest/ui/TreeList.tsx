import type { ForestTree } from "../types";
import { ageDescription } from "../growth";

/**
 * Accessible text-based list of visible trees — an alternative to the 3D
 * canvas for screen-reader users and reduced-motion contexts.
 */
export function TreeList({ trees, ownerLabel }: { trees: ForestTree[]; ownerLabel?: string }) {
  if (!trees.length) {
    return (
      <p className="mt-4 rounded-2xl border border-border bg-parchment p-6 text-center text-sm text-muted-foreground">
        {ownerLabel ? `${ownerLabel}'s forest is still a clearing.` : "This forest is still a clearing."}
      </p>
    );
  }
  return (
    <section aria-label={ownerLabel ? `${ownerLabel}'s trees` : "Trees in this forest"} className="mt-4">
      <h2 className="sr-only">List of trees</h2>
      <ol className="space-y-2">
        {trees.map((t) => (
          <li key={t.id} className="grove-card p-3">
            <p className="font-display text-forest">{t.species_name}</p>
            <p className="text-xs text-muted-foreground">
              Planted {new Date(t.planted_at).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" })}
              {" · "}
              {ageDescription(t.planted_at)}
            </p>
            <p className={`mt-1 text-sm ${t.habit_name ? "text-moss" : "text-moss/80 italic"}`}>
              {t.habit_name ?? "A quiet promise"}
            </p>
          </li>
        ))}
      </ol>
    </section>
  );
}
