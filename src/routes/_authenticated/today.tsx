import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Check, Trees as TreesIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useProfile } from "@/hooks/useProfile";
import { AppShell } from "@/components/AppShell";
import { ForestMiniPreview } from "@/components/ForestMiniPreview";
import { Button } from "@/components/ui/button";
import { greeting, localDateInTz, weekStart } from "@/lib/date";

export const Route = createFileRoute("/_authenticated/today")({
  head: () => ({ meta: [{ title: "Today — Growve" }] }),
  component: TodayPage,
});

type HabitRow = {
  id: string; name: string; cadence: "daily" | "weekly"; target_per_period: number;
  tree_species_id: string; is_archived: boolean;
  tree_species: { name: string; slug: string } | null;
};

function TodayPage() {
  const { user } = useAuth();
  const profile = useProfile();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const tz = profile.data?.timezone || "UTC";
  const today = useMemo(() => localDateInTz(tz), [tz]);
  const wkStart = useMemo(() => weekStart(today), [today]);

  const habits = useQuery({
    queryKey: ["habits", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("habits")
        .select("id, name, cadence, target_per_period, tree_species_id, is_archived, tree_species(name, slug)")
        .eq("user_id", user!.id)
        .eq("is_archived", false)
        .order("created_at");
      if (error) throw error;
      return (data ?? []) as unknown as HabitRow[];
    },
  });

  const logs = useQuery({
    queryKey: ["logs-cycle", user?.id, today, wkStart],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("habit_logs")
        .select("id, habit_id, cycle_start, local_date")
        .eq("user_id", user!.id)
        .or(`local_date.eq.${today},cycle_start.eq.${wkStart}`);
      if (error) throw error;
      return data ?? [];
    },
  });

  const treeCount = useQuery({
    queryKey: ["tree-count", user?.id],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("forest_trees")
        .select("id", { count: "exact", head: true })
        .eq("owner_id", user!.id);
      if (error) throw error;
      return count ?? 0;
    },
  });

  const tend = useMutation({
    mutationFn: async (habit: HabitRow) => {
      const cri = crypto.randomUUID();
      const { data, error } = await supabase.rpc("log_habit_completion", {
        _habit_id: habit.id,
        _client_request_id: cri,
        _local_date: today,
      });
      if (error) throw error;
      return { result: data as { log: { id: string }; tree: { id: string } }, habit };
    },
    onSuccess: ({ result, habit }) => {
      qc.invalidateQueries({ queryKey: ["logs-cycle"] });
      qc.invalidateQueries({ queryKey: ["tree-count"] });
      qc.invalidateQueries({ queryKey: ["forest"] });
      qc.invalidateQueries({ queryKey: ["forest-3d"] });
      toast.success(`A ${habit.tree_species?.name ?? "tree"} has taken root in your forest.`, {
        action: { label: "Undo", onClick: () => undo.mutate(result.log.id) },
        duration: 6000,
      });
    },
    onError: (err: { message?: string; code?: string }) => {
      const msg = err.message || "Couldn't log right now.";
      if (msg.includes("Already completed")) toast("Already tended today.");
      else if (msg.includes("Weekly target")) toast("Weekly goal reached. Rest is also growth.");
      else toast.error(msg);
    },
  });

  const undo = useMutation({
    mutationFn: async (logId: string) => {
      const { error } = await supabase.rpc("undo_habit_log", { _log_id: logId });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["logs-cycle"] });
      qc.invalidateQueries({ queryKey: ["tree-count"] });
      qc.invalidateQueries({ queryKey: ["forest"] });
      qc.invalidateQueries({ queryKey: ["forest-3d"] });
      toast("Removed.");
    },
  });

  const dailyHabits = habits.data?.filter((h) => h.cadence === "daily") ?? [];
  const weeklyHabits = habits.data?.filter((h) => h.cadence === "weekly") ?? [];
  const countLogs = (habitId: string, cadence: "daily" | "weekly") => {
    if (!logs.data) return 0;
    return logs.data.filter((l) =>
      l.habit_id === habitId &&
      (cadence === "daily" ? l.local_date === today : l.cycle_start === wkStart)
    ).length;
  };

  const trees = treeCount.data ?? 0;

  return (
    <AppShell>
      <header className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-4">
        <div className="min-w-0">
          <p className="text-sm text-muted-foreground">{greeting()},</p>
          <h1 className="truncate font-display text-3xl text-forest">
            {profile.data?.display_name || "Growve member"}
          </h1>
        </div>
        <Link
          to="/history"
          aria-label={`View planting history, ${trees} trees`}
          className="grove-card flex shrink-0 items-center gap-2 rounded-2xl px-3 py-2 text-sm text-forest min-h-[44px]"
        >
          <TreesIcon className="h-4 w-4" aria-hidden />
          <span className="font-medium">{trees}</span>
          <span className="text-xs text-muted-foreground">trees</span>
        </Link>
      </header>

      <button
        type="button"
        onClick={() => navigate({ to: "/forest" })}
        aria-label="Open your forest"
        className="mt-6 block w-full text-left transition-transform active:scale-[0.995]"
      >
        <ForestMiniPreview
          count={trees}
          seed={profile.data?.forest_seed ? Number(profile.data.forest_seed) % 2147483647 : 1}
          height={180}
          emptyLabel="Your forest waits. Tend a habit to plant your first tree."
        />
        <p className="mt-2 text-center text-xs text-muted-foreground">Tap to wander your forest</p>
      </button>

      <section className="mt-8">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg text-forest">Daily</h2>
          <Link to="/habits/new" className="inline-flex items-center gap-1 text-sm text-moss hover:underline">
            <Plus className="h-4 w-4" /> New
          </Link>
        </div>
        <div className="mt-3 space-y-3">
          {habits.isLoading ? (
            <SkeletonCard />
          ) : dailyHabits.length === 0 ? (
            <EmptyHabit message="No daily habits yet." />
          ) : (
            dailyHabits.map((h) => (
              <HabitRow
                key={h.id}
                habit={h}
                done={countLogs(h.id, "daily") >= 1}
                progress={countLogs(h.id, "daily")}
                target={1}
                onTend={() => tend.mutate(h)}
                disabled={tend.isPending}
              />
            ))
          )}
        </div>
      </section>

      <section className="mt-8">
        <h2 className="font-display text-lg text-forest">Weekly</h2>
        <div className="mt-3 space-y-3">
          {weeklyHabits.length === 0 ? (
            <EmptyHabit message="No weekly habits yet." />
          ) : (
            weeklyHabits.map((h) => {
              const c = countLogs(h.id, "weekly");
              return (
                <HabitRow
                  key={h.id}
                  habit={h}
                  done={c >= h.target_per_period}
                  progress={c}
                  target={h.target_per_period}
                  onTend={() => tend.mutate(h)}
                  disabled={tend.isPending}
                />
              );
            })
          )}
        </div>
      </section>
    </AppShell>
  );
}

function HabitRow({ habit, done, progress, target, onTend, disabled }: {
  habit: HabitRow; done: boolean; progress: number; target: number;
  onTend: () => void; disabled: boolean;
}) {
  return (
    <div className="grove-card flex items-center gap-3 p-4">
      <Link to="/habits/$habitId" params={{ habitId: habit.id }} className="min-w-0 flex-1">
        <p className="truncate font-medium text-forest">{habit.name}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {habit.cadence === "daily" ? (done ? "Tended today" : "Today") : `${progress} / ${target} this week`}
        </p>
      </Link>
      <Button
        onClick={onTend}
        disabled={disabled || done}
        size="sm"
        className={`shrink-0 rounded-full px-4 min-h-[40px] ${done ? "bg-sage text-forest hover:bg-sage" : "bg-forest text-parchment hover:bg-forest/90"}`}
      >
        {done ? <Check className="h-4 w-4" /> : "Tend"}
      </Button>
    </div>
  );
}

function EmptyHabit({ message }: { message: string }) {
  return (
    <div className="grove-card p-6 text-center">
      <p className="text-sm text-muted-foreground">{message}</p>
      <Link to="/habits/new" className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-moss hover:underline">
        <Plus className="h-4 w-4" /> Plant a habit
      </Link>
    </div>
  );
}

function SkeletonCard() {
  return <div className="grove-card h-20 animate-pulse" />;
}
