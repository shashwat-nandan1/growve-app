import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { AppShell } from "@/components/AppShell";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/habits/new")({
  head: () => ({ meta: [{ title: "New habit — Growve" }] }),
  component: NewHabit,
});

function NewHabit() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [cadence, setCadence] = useState<"daily" | "weekly">("daily");
  const [target, setTarget] = useState(3);
  const [speciesId, setSpeciesId] = useState("");

  const species = useQuery({
    queryKey: ["species"],
    queryFn: async () => {
      const { data, error } = await supabase.from("tree_species").select("*").order("sort_order");
      if (error) throw error;
      return data ?? [];
    },
  });

  const save = useMutation({
    mutationFn: async () => {
      if (!name.trim()) throw new Error("Name is required.");
      if (!speciesId) throw new Error("Choose a tree species.");
      const { error } = await supabase.from("habits").insert({
        user_id: user!.id,
        name: name.trim(),
        description: desc.trim() || null,
        cadence,
        target_per_period: cadence === "weekly" ? Math.max(1, Math.min(7, target)) : 1,
        tree_species_id: speciesId,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["habits"] });
      toast.success("Habit added.");
      navigate({ to: "/today" });
    },
    onError: (e: { message: string }) => toast.error(e.message),
  });

  return (
    <AppShell>
      <h1 className="font-display text-3xl text-forest">New habit</h1>
      <form onSubmit={(e) => { e.preventDefault(); save.mutate(); }} className="mt-6 grove-card space-y-4 p-6">
        <div>
          <Label htmlFor="n">Name</Label>
          <Input id="n" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} required className="mt-1.5" />
        </div>
        <div>
          <Label htmlFor="d">Description (optional)</Label>
          <Textarea id="d" value={desc} onChange={(e) => setDesc(e.target.value)} maxLength={280} rows={2} className="mt-1.5" />
        </div>
        <div>
          <Label>Cadence</Label>
          <div className="mt-1.5 grid grid-cols-2 gap-2">
            {(["daily", "weekly"] as const).map((c) => (
              <button type="button" key={c} onClick={() => setCadence(c)}
                className={`rounded-xl border px-3 py-2.5 text-sm capitalize ${cadence === c ? "border-forest bg-forest text-parchment" : "border-border bg-card"}`}>
                {c}
              </button>
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
              <button type="button" key={s.id} onClick={() => setSpeciesId(s.id)}
                className={`rounded-xl border p-3 text-center text-xs ${speciesId === s.id ? "border-forest bg-mist" : "border-border bg-card"}`}>
                <svg viewBox="0 0 24 24" className="mx-auto mb-1 h-7 w-7 text-moss" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 3c-3 4-5 7-5 10a5 5 0 0 0 10 0c0-3-2-6-5-10z" /><path d="M12 13v8" />
                </svg>
                {s.name}
              </button>
            ))}
          </div>
        </div>
        <div className="flex gap-2 pt-2">
          <Button type="button" variant="ghost" className="flex-1" onClick={() => navigate({ to: "/today" })}>Cancel</Button>
          <Button type="submit" disabled={save.isPending} className="flex-1 rounded-xl bg-forest text-parchment hover:bg-forest/90">Plant it</Button>
        </div>
      </form>
    </AppShell>
  );
}
