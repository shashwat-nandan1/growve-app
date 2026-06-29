import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Pencil, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/habits/$habitId")({
  head: () => ({ meta: [{ title: "Habit — Growve" }] }),
  component: HabitDetail,
});

function HabitDetail() {
  const { habitId } = Route.useParams();
  const { user } = useAuth();
  const qc = useQueryClient();
  const navigate = useNavigate();

  const habit = useQuery({
    queryKey: ["habit", habitId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("habits")
        .select("*, tree_species(name)")
        .eq("id", habitId).maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const logs = useQuery({
    queryKey: ["habit-logs", habitId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("habit_logs")
        .select("id, local_date, logged_at")
        .eq("habit_id", habitId)
        .order("logged_at", { ascending: false })
        .limit(40);
      if (error) throw error;
      return data ?? [];
    },
  });

  const archive = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("habits").update({ is_archived: true }).eq("id", habitId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["habits"] });
      toast("Habit archived.");
      navigate({ to: "/today" });
    },
  });

  if (habit.isLoading) return <AppShell><div className="h-32 animate-pulse rounded-2xl bg-mist" /></AppShell>;
  if (!habit.data || habit.data.user_id !== user!.id) {
    return <AppShell><p className="text-sm text-muted-foreground">Habit not found.</p></AppShell>;
  }
  const h = habit.data;

  return (
    <AppShell>
      <header className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-widest text-muted-foreground">{h.cadence} · {h.tree_species?.name}</p>
          <h1 className="mt-1 font-display text-3xl text-forest truncate">{h.name}</h1>
          {h.description && <p className="mt-2 text-sm text-foreground/80">{h.description}</p>}
        </div>
        <Link to="/habits/$habitId/edit" params={{ habitId }} className="grove-card grid h-10 w-10 shrink-0 place-items-center rounded-xl">
          <Pencil className="h-4 w-4 text-forest" />
        </Link>
      </header>

      <section className="mt-8">
        <h2 className="mb-3 font-display text-lg text-forest">History</h2>
        {logs.data?.length === 0 ? (
          <p className="text-sm text-muted-foreground">No tends yet.</p>
        ) : (
          <ul className="grove-card divide-y divide-border">
            {logs.data?.map((l) => (
              <li key={l.id} className="flex items-center justify-between px-4 py-3 text-sm">
                <span className="text-forest">{new Date(l.logged_at).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}</span>
                <span className="text-muted-foreground">{new Date(l.logged_at).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <Button onClick={() => { if (confirm("Archive this habit? Your trees stay.")) archive.mutate(); }} variant="ghost" className="mt-8 w-full text-destructive">
        <Trash2 className="mr-2 h-4 w-4" /> Archive habit
      </Button>
    </AppShell>
  );
}
