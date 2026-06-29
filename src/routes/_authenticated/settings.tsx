import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useProfile } from "@/hooks/useProfile";
import { useAuth } from "@/lib/auth";
import { AppShell } from "@/components/AppShell";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({ meta: [{ title: "Settings — Growve" }] }),
  component: SettingsPage,
});

function SettingsPage() {
  const profile = useProfile();
  const { user } = useAuth();
  const qc = useQueryClient();
  const [visibility, setVisibility] = useState<"private" | "friends" | "public">("friends");
  const [sound, setSound] = useState(true);
  const [reduced, setReduced] = useState(false);
  const [timezone, setTimezone] = useState("UTC");

  useEffect(() => {
    if (profile.data) {
      setVisibility(profile.data.forest_visibility);
      setSound(profile.data.sound_enabled);
      setReduced(profile.data.reduced_motion);
      setTimezone(profile.data.timezone);
    }
  }, [profile.data]);

  const save = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("profiles").update({
        forest_visibility: visibility, sound_enabled: sound, reduced_motion: reduced, timezone,
      }).eq("id", user!.id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["profile"] }); toast.success("Saved."); },
    onError: (e: { message: string }) => toast.error(e.message),
  });

  return (
    <AppShell>
      <h1 className="font-display text-3xl text-forest">Settings</h1>

      <section className="mt-6 grove-card p-6 space-y-5">
        <div>
          <Label>Forest visibility</Label>
          <div className="mt-2 grid grid-cols-3 gap-2">
            {(["private", "friends", "public"] as const).map((v) => (
              <button key={v} type="button" onClick={() => setVisibility(v)}
                className={`rounded-xl border px-3 py-2 text-sm capitalize ${visibility === v ? "border-forest bg-forest text-parchment" : "border-border bg-card"}`}>
                {v}
              </button>
            ))}
          </div>
        </div>

        <Row label="Sound" desc="Subtle audio cues on tend.">
          <Switch checked={sound} onCheckedChange={setSound} />
        </Row>
        <Row label="Reduced motion" desc="Calmer transitions and animations.">
          <Switch checked={reduced} onCheckedChange={setReduced} />
        </Row>
        <div>
          <Label htmlFor="tz">Timezone</Label>
          <Input id="tz" value={timezone} onChange={(e) => setTimezone(e.target.value)} className="mt-1.5" />
          <button type="button" className="mt-2 text-xs text-moss hover:underline"
            onClick={() => setTimezone(Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC")}>
            Use device timezone
          </button>
        </div>
        <Button onClick={() => save.mutate()} disabled={save.isPending} className="w-full rounded-xl bg-forest text-parchment hover:bg-forest/90">
          Save settings
        </Button>
      </section>
    </AppShell>
  );
}

function Row({ label, desc, children }: { label: string; desc: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="min-w-0">
        <p className="font-medium text-forest">{label}</p>
        <p className="text-xs text-muted-foreground">{desc}</p>
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}
