import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useProfile } from "@/hooks/useProfile";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/_authenticated/onboarding")({
  head: () => ({ meta: [{ title: "Plant your first habit — Growve" }] }),
  component: Onboarding,
});

function Onboarding() {
  const { user } = useAuth();
  const profile = useProfile();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [habitName, setHabitName] = useState("");
  const [speciesId, setSpeciesId] = useState<string>("");
  const [cadence, setCadence] = useState<"daily" | "weekly">("daily");
  const [target, setTarget] = useState(3);
  const [visibility, setVisibility] = useState<"public" | "private">("public");

  const species = useQuery({
    queryKey: ["species"],
    queryFn: async () => {
      const { data, error } = await supabase.from("tree_species").select("*").order("sort_order");
      if (error) throw error;
      return data ?? [];
    },
  });

  async function completeOnboarding() {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
    await supabase
      .from("profiles")
      .update({ onboarding_completed_at: new Date().toISOString(), timezone: tz })
      .eq("id", user!.id);
    await qc.invalidateQueries({ queryKey: ["profile"] });
  }

  const savingHabit = useMutation({
    mutationFn: async () => {
      if (!habitName.trim()) throw new Error("Give your habit a name.");
      if (!speciesId) throw new Error("Choose a tree species.");
      const { error } = await supabase.from("habits").insert({
        user_id: user!.id,
        name: habitName.trim(),
        cadence,
        target_per_period: cadence === "weekly" ? Math.max(1, Math.min(7, target)) : 1,
        tree_species_id: speciesId,
        visibility,
      });
      if (error) throw error;
      await completeOnboarding();
    },
    onSuccess: () => {
      toast.success("Your first seed is planted.");
      navigate({ to: "/today", replace: true });
    },
    onError: (e: { message?: string }) => toast.error(e.message || "Couldn't save."),
  });

  const skipping = useMutation({
    mutationFn: completeOnboarding,
    onSuccess: () => navigate({ to: "/today", replace: true }),
    onError: (e: { message?: string }) => toast.error(e.message || "Couldn't continue."),
  });

  const firstName = (profile.data?.display_name || "there").split(" ")[0];

  return (
    <div className="min-h-screen bg-background px-5 pb-16 pt-12">
      <div className="mx-auto max-w-md">
        <p className="text-xs uppercase tracking-widest text-muted-foreground">Welcome, {firstName}</p>
        <h1 className="mt-2 font-display text-3xl text-forest">Plant a first habit</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Small and steady. Every time you tend it, a tree grows in your forest.
        </p>

        <form
          onSubmit={(e) => { e.preventDefault(); savingHabit.mutate(); }}
          className="mt-8 grove-card space-y-4 p-6"
        >
          <div>
            <Label htmlFor="hn">Habit</Label>
            <Input id="hn" value={habitName} onChange={(e) => setHabitName(e.target.value)} placeholder="Morning walk" className="mt-1.5" required />
          </div>
          <div>
            <Label>Cadence</Label>
            <div className="mt-1.5 grid grid-cols-2 gap-2">
              {(["daily", "weekly"] as const).map((c) => (
                <button
                  type="button"
                  key={c}
                  onClick={() => setCadence(c)}
                  className={`rounded-xl border px-3 py-2.5 text-sm capitalize transition-colors ${cadence === c ? "border-forest bg-forest text-parchment" : "border-border bg-card text-foreground"}`}
                >
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
                <button
                  type="button"
                  key={s.id}
                  onClick={() => setSpeciesId(s.id)}
                  className={`rounded-xl border p-3 text-center text-xs transition-colors ${speciesId === s.id ? "border-forest bg-mist" : "border-border bg-card"}`}
                >
                  <TreeGlyph className="mx-auto mb-1 h-7 w-7 text-moss" />
                  {s.name}
                </button>
              ))}
            </div>
          </div>
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
            <Button
              type="button"
              variant="ghost"
              onClick={() => skipping.mutate()}
              disabled={skipping.isPending || savingHabit.isPending}
              className="flex-1"
            >
              Skip for now
            </Button>
            <Button
              type="submit"
              disabled={savingHabit.isPending || skipping.isPending}
              className="flex-1 rounded-xl bg-forest text-parchment hover:bg-forest/90"
            >
              Plant it
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

function TreeGlyph({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3c-3 4-5 7-5 10a5 5 0 0 0 10 0c0-3-2-6-5-10z" />
      <path d="M12 13v8" />
    </svg>
  );
}
