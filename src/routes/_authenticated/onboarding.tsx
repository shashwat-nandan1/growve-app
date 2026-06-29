import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/_authenticated/onboarding")({
  head: () => ({ meta: [{ title: "Welcome — Growve" }] }),
  component: Onboarding,
});

const usernameSchema = z.string().trim().min(3, "At least 3 characters").max(24, "At most 24").regex(/^[a-zA-Z0-9_]+$/, "Letters, numbers, underscore");

function Onboarding() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState<1 | 2>(1);
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [busy, setBusy] = useState(false);
  const [habitName, setHabitName] = useState("");
  const [speciesId, setSpeciesId] = useState<string>("");
  const [cadence, setCadence] = useState<"daily" | "weekly">("daily");
  const [target, setTarget] = useState(3);

  const species = useQuery({
    queryKey: ["species"],
    queryFn: async () => {
      const { data, error } = await supabase.from("tree_species").select("*").order("sort_order");
      if (error) throw error;
      return data ?? [];
    },
  });

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const u = usernameSchema.parse(username);
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
      const { error } = await supabase.from("profiles").update({
        username: u,
        display_name: displayName.trim() || u,
        timezone: tz,
      }).eq("id", user!.id);
      if (error) {
        if (error.code === "23505") throw new Error("That username is taken.");
        throw error;
      }
      setStep(2);
    } catch (err) {
      const msg = err instanceof z.ZodError ? err.issues[0]?.message : (err as Error).message;
      toast.error(msg || "Couldn't save.");
    } finally {
      setBusy(false);
    }
  }

  async function saveHabit(e: React.FormEvent) {
    e.preventDefault();
    if (!habitName.trim()) return toast.error("Give your habit a name.");
    if (!speciesId) return toast.error("Choose a tree species.");
    setBusy(true);
    const { error } = await supabase.from("habits").insert({
      user_id: user!.id,
      name: habitName.trim(),
      cadence,
      target_per_period: cadence === "weekly" ? Math.max(1, Math.min(7, target)) : 1,
      tree_species_id: speciesId,
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Your first seed is ready.");
    navigate({ to: "/today" });
  }

  async function skipHabit() {
    navigate({ to: "/today" });
  }

  return (
    <div className="min-h-screen bg-background px-5 pb-16 pt-12">
      <div className="mx-auto max-w-md">
        <p className="text-xs uppercase tracking-widest text-muted-foreground">Step {step} of 2</p>
        <h1 className="mt-2 font-display text-3xl text-forest">
          {step === 1 ? "Choose your name" : "Plant a first habit"}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {step === 1
            ? "This is how friends will find your forest."
            : "Small and steady. You can change it anytime."}
        </p>

        <div className="mt-8 grove-card p-6">
          {step === 1 ? (
            <form onSubmit={saveProfile} className="space-y-4">
              <div>
                <Label htmlFor="u">Username</Label>
                <Input id="u" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="mossy_oak" className="mt-1.5" required />
              </div>
              <div>
                <Label htmlFor="dn">Display name (optional)</Label>
                <Input id="dn" value={displayName} onChange={(e) => setDisplayName(e.target.value)} className="mt-1.5" />
              </div>
              <Button type="submit" disabled={busy} className="w-full rounded-xl bg-forest text-parchment hover:bg-forest/90">Continue</Button>
            </form>
          ) : (
            <form onSubmit={saveHabit} className="space-y-4">
              <div>
                <Label htmlFor="hn">Habit</Label>
                <Input id="hn" value={habitName} onChange={(e) => setHabitName(e.target.value)} placeholder="Morning walk" className="mt-1.5" required />
              </div>
              <div>
                <Label>Cadence</Label>
                <div className="mt-1.5 grid grid-cols-2 gap-2">
                  {(["daily", "weekly"] as const).map((c) => (
                    <button type="button" key={c} onClick={() => setCadence(c)}
                      className={`rounded-xl border px-3 py-2.5 text-sm capitalize transition-colors ${cadence === c ? "border-forest bg-forest text-parchment" : "border-border bg-card text-foreground"}`}>
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
                      className={`rounded-xl border p-3 text-center text-xs transition-colors ${speciesId === s.id ? "border-forest bg-mist" : "border-border bg-card"}`}>
                      <TreeGlyph className="mx-auto mb-1 h-7 w-7 text-moss" />
                      {s.name}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex gap-2">
                <Button type="button" variant="ghost" onClick={skipHabit} className="flex-1">Skip</Button>
                <Button type="submit" disabled={busy} className="flex-1 rounded-xl bg-forest text-parchment hover:bg-forest/90">Plant it</Button>
              </div>
            </form>
          )}
        </div>
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
