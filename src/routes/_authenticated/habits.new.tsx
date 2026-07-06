import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/habits/new")({
  head: () => ({ meta: [{ title: "New habit — Growve" }] }),
  component: NewHabit,
});

function NewHabit() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [cadence, setCadence] = useState<"daily" | "weekly">("daily");
  const [target, setTarget] = useState(3);
  const [visibility, setVisibility] = useState<"public" | "private">("public");

  const save = useMutation({
    mutationFn: async () => {
      if (!name.trim()) throw new Error("Name is required.");
      const { data, error } = await supabase.rpc("create_habit_with_auto_tree", {
        _name: name.trim(),
        _cadence: cadence,
        _target: cadence === "weekly" ? Math.max(1, Math.min(7, target)) : 1,
        _visibility: visibility,
        _start_date: new Date().toISOString().slice(0, 10),
      });
      if (error) throw error;
      return data as { species?: { name?: string } };
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["habits"] });
      const speciesName = data?.species?.name;
      toast.success(
        speciesName
          ? `Your ${name.trim()} habit will grow as a ${speciesName.toLowerCase()}.`
          : "Habit added."
      );
      navigate({ to: "/today" });
    },
    onError: (e: { message: string }) => toast.error(e.message),
  });

  return (
    <AppShell>
      <h1 className="font-display text-3xl text-forest">New habit</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Each habit grows its own kind of tree. Yours will be revealed when it takes root.
      </p>
      <form onSubmit={(e) => { e.preventDefault(); save.mutate(); }} className="mt-6 grove-card space-y-4 p-6">
        <div>
          <Label htmlFor="n">Name</Label>
          <Input id="n" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} required className="mt-1.5" />
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
          <Label>Plaque visibility</Label>
          <div className="mt-1.5 grid grid-cols-2 gap-2">
            {(["public", "private"] as const).map((v) => (
              <button
                type="button"
                key={v}
                onClick={() => setVisibility(v)}
                className={`rounded-xl border px-3 py-2.5 text-sm capitalize ${visibility === v ? "border-forest bg-forest text-parchment" : "border-border bg-card"}`}
              >
                {v}
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
