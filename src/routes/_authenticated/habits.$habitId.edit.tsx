import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/habits/$habitId/edit")({
  head: () => ({ meta: [{ title: "Edit habit — Growve" }] }),
  component: EditHabit,
});

function EditHabit() {
  const { habitId } = Route.useParams();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [target, setTarget] = useState(1);
  const [speciesId, setSpeciesId] = useState("");
  const [cadence, setCadence] = useState<"daily" | "weekly">("daily");

  const habit = useQuery({
    queryKey: ["habit", habitId],
    queryFn: async () => {
      const { data, error } = await supabase.from("habits").select("*").eq("id", habitId).maybeSingle();
      if (error) throw error;
      return data;
    },
  });
  const species = useQuery({
    queryKey: ["species"],
    queryFn: async () => (await supabase.from("tree_species").select("*").order("sort_order")).data ?? [],
  });

  useEffect(() => {
    if (habit.data) {
      setName(habit.data.name); setDesc(habit.data.description || "");
      setTarget(habit.data.target_per_period); setSpeciesId(habit.data.tree_species_id);
      setCadence(habit.data.cadence);
    }
  }, [habit.data]);

  const save = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("habits").update({
        name: name.trim(), description: desc.trim() || null,
        cadence, target_per_period: cadence === "weekly" ? Math.max(1, Math.min(7, target)) : 1,
        tree_species_id: speciesId,
      }).eq("id", habitId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["habit", habitId] });
      qc.invalidateQueries({ queryKey: ["habits"] });
      toast.success("Saved.");
      navigate({ to: "/habits/$habitId", params: { habitId } });
    },
  });

  if (habit.isLoading) return <AppShell><div className="h-32 animate-pulse rounded-2xl bg-mist" /></AppShell>;

  return (
    <AppShell>
      <h1 className="font-display text-3xl text-forest">Edit habit</h1>
      <form onSubmit={(e) => { e.preventDefault(); save.mutate(); }} className="mt-6 grove-card space-y-4 p-6">
        <div>
          <Label htmlFor="n">Name</Label>
          <Input id="n" value={name} onChange={(e) => setName(e.target.value)} required className="mt-1.5" />
        </div>
        <div>
          <Label htmlFor="d">Description</Label>
          <Textarea id="d" value={desc} onChange={(e) => setDesc(e.target.value)} rows={2} className="mt-1.5" />
        </div>
        <div>
          <Label>Cadence</Label>
          <div className="mt-1.5 grid grid-cols-2 gap-2">
            {(["daily", "weekly"] as const).map((c) => (
              <button key={c} type="button" onClick={() => setCadence(c)}
                className={`rounded-xl border px-3 py-2.5 text-sm capitalize ${cadence === c ? "border-forest bg-forest text-parchment" : "border-border bg-card"}`}>{c}</button>
            ))}
          </div>
        </div>
        {cadence === "weekly" && (
          <div>
            <Label htmlFor="t">Times per week</Label>
            <Input id="t" type="number" min={1} max={7} value={target} onChange={(e) => setTarget(Number(e.target.value))} className="mt-1.5" />
          </div>
        )}
        <div>
          <Label>Tree species</Label>
          <div className="mt-1.5 grid grid-cols-3 gap-2">
            {species.data?.map((s) => (
              <button key={s.id} type="button" onClick={() => setSpeciesId(s.id)}
                className={`rounded-xl border p-3 text-center text-xs ${speciesId === s.id ? "border-forest bg-mist" : "border-border bg-card"}`}>
                {s.name}
              </button>
            ))}
          </div>
        </div>
        <div className="flex gap-2 pt-2">
          <Button type="button" variant="ghost" className="flex-1" onClick={() => navigate({ to: "/habits/$habitId", params: { habitId } })}>Cancel</Button>
          <Button type="submit" disabled={save.isPending} className="flex-1 rounded-xl bg-forest text-parchment hover:bg-forest/90">Save</Button>
        </div>
      </form>
    </AppShell>
  );
}
