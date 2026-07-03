import { createFileRoute, Link } from "@tanstack/react-router";
import { useInfiniteQuery } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/history")({
  head: () => ({ meta: [{ title: "Your forest history — Growve" }] }),
  component: HistoryPage,
});

type HistoryRow = {
  id: string;
  planted_at: string;
  habit_log_id: string;
  tree_species: { name: string; slug: string } | null;
  habit_logs: {
    local_date: string;
    habits: { name: string; cadence: "daily" | "weekly" } | null;
  } | null;
};

const PAGE_SIZE = 30;

function HistoryPage() {
  const { user } = useAuth();
  const query = useInfiniteQuery({
    queryKey: ["history", user?.id],
    initialPageParam: 0,
    getNextPageParam: (last: HistoryRow[], all) =>
      last.length < PAGE_SIZE ? undefined : all.length,
    queryFn: async ({ pageParam }) => {
      const from = (pageParam as number) * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;
      const { data, error } = await supabase
        .from("forest_trees")
        .select(
          "id, planted_at, habit_log_id, tree_species(name, slug), habit_logs(local_date, habits(name, cadence))"
        )
        .eq("owner_id", user!.id)
        .order("planted_at", { ascending: false })
        .range(from, to);
      if (error) throw error;
      return (data ?? []) as unknown as HistoryRow[];
    },
  });

  const flat = query.data?.pages.flat() ?? [];
  const grouped = groupByDate(flat);
  const total = flat.length;

  return (
    <AppShell>
      <Link to="/today" className="inline-flex items-center gap-1 text-sm text-moss hover:underline">
        <ArrowLeft className="h-4 w-4" /> Today
      </Link>
      <header className="mt-3">
        <h1 className="font-display text-3xl text-forest">Your forest history</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {query.isLoading ? "Gathering your grove…" : `${total} ${total === 1 ? "tree" : "trees"} planted so far.`}
        </p>
      </header>

      <div className="mt-6 space-y-6">
        {query.isLoading ? (
          <>
            <SkeletonRow />
            <SkeletonRow />
            <SkeletonRow />
          </>
        ) : query.isError ? (
          <div className="grove-card p-6 text-center text-sm text-muted-foreground">
            Couldn't load your history. Try again in a moment.
          </div>
        ) : total === 0 ? (
          <div className="grove-card p-8 text-center">
            <p className="font-display text-lg text-forest">No trees yet</p>
            <p className="mt-2 text-sm text-muted-foreground">
              Tend a habit and the first tree will appear here.
            </p>
            <Link
              to="/today"
              className="mt-4 inline-flex items-center rounded-full bg-forest px-4 py-2 text-sm text-parchment hover:bg-forest/90"
            >
              Back to Today
            </Link>
          </div>
        ) : (
          grouped.map(([date, items]) => (
            <section key={date}>
              <h2 className="mb-2 text-xs uppercase tracking-widest text-muted-foreground">
                {formatDateHeader(date)}
              </h2>
              <div className="space-y-2">
                {items.map((row) => (
                  <HistoryItem key={row.id} row={row} />
                ))}
              </div>
            </section>
          ))
        )}

        {query.hasNextPage && (
          <Button
            variant="outline"
            className="w-full rounded-xl"
            onClick={() => query.fetchNextPage()}
            disabled={query.isFetchingNextPage}
          >
            {query.isFetchingNextPage ? "Loading…" : "Load older"}
          </Button>
        )}
      </div>
    </AppShell>
  );
}

function HistoryItem({ row }: { row: HistoryRow }) {
  const species = row.tree_species?.name ?? "Tree";
  const habitName = row.habit_logs?.habits?.name ?? "A tended habit";
  const cadence = row.habit_logs?.habits?.cadence;
  const when = new Date(row.planted_at);
  return (
    <div className="grove-card flex items-center gap-3 p-3">
      <TreeThumb className="h-10 w-10 shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium text-forest">{species}</p>
        <p className="truncate text-xs text-muted-foreground">
          {habitName}
          {cadence ? <> · {cadence}</> : null}
        </p>
      </div>
      <p className="shrink-0 text-xs text-muted-foreground">
        {when.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}
      </p>
    </div>
  );
}

function TreeThumb({ className = "" }: { className?: string }) {
  return (
    <div className={`grid place-items-center rounded-2xl bg-mist ${className}`} aria-hidden>
      <svg viewBox="0 0 24 24" className="h-6 w-6 text-moss" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 3c-3 4-5 7-5 10a5 5 0 0 0 10 0c0-3-2-6-5-10z" />
        <path d="M12 13v8" />
      </svg>
    </div>
  );
}

function SkeletonRow() {
  return <div className="grove-card h-16 animate-pulse" />;
}

function groupByDate(rows: HistoryRow[]): Array<[string, HistoryRow[]]> {
  const map = new Map<string, HistoryRow[]>();
  for (const r of rows) {
    const d = new Date(r.planted_at);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    const bucket = map.get(key);
    if (bucket) bucket.push(r);
    else map.set(key, [r]);
  }
  return Array.from(map.entries());
}

function formatDateHeader(key: string) {
  const [y, m, d] = key.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  const today = new Date();
  const isToday = date.toDateString() === today.toDateString();
  const yest = new Date(today);
  yest.setDate(today.getDate() - 1);
  const isYest = date.toDateString() === yest.toDateString();
  if (isToday) return "Today";
  if (isYest) return "Yesterday";
  return date.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric", year: date.getFullYear() === today.getFullYear() ? undefined : "numeric" });
}
