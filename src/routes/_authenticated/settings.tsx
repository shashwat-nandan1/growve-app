import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { LogOut } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useProfile } from "@/hooks/useProfile";
import { useAuth } from "@/lib/auth";
import { AppShell } from "@/components/AppShell";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({ meta: [{ title: "Settings — Growve" }] }),
  component: SettingsPage,
});

function SettingsPage() {
  const profile = useProfile();
  const { user } = useAuth();
  const qc = useQueryClient();
  const navigate = useNavigate();

  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [visibility, setVisibility] = useState<"private" | "friends" | "public">("friends");
  const [sound, setSound] = useState(true);
  const [reduced, setReduced] = useState(false);
  const [timezone, setTimezone] = useState("UTC");

  useEffect(() => {
    if (profile.data) {
      setDisplayName(profile.data.display_name || "");
      setBio(profile.data.bio || "");
      setVisibility(profile.data.forest_visibility);
      setSound(profile.data.sound_enabled);
      setReduced(profile.data.reduced_motion);
      setTimezone(profile.data.timezone);
    }
  }, [profile.data]);

  const save = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("profiles").update({
        display_name: displayName.trim() || "Growve member",
        bio: bio.trim().slice(0, 280) || null,
        forest_visibility: visibility,
        sound_enabled: sound,
        reduced_motion: reduced,
        timezone,
      }).eq("id", user!.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["profile"] });
      toast.success("Saved.");
    },
    onError: (e: { message: string }) => toast.error(e.message),
  });

  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  const p = profile.data;

  return (
    <AppShell>
      <h1 className="font-display text-3xl text-forest">Settings</h1>

      <section className="mt-6 grove-card space-y-5 p-6">
        <h2 className="font-display text-lg text-forest">Profile</h2>
        <div className="flex items-center gap-4">
          {p?.avatar_url ? (
            <img src={p.avatar_url} alt="" className="h-16 w-16 rounded-full object-cover" />
          ) : (
            <div className="grid h-16 w-16 place-items-center rounded-full bg-sage/40 text-xl font-display text-forest">
              {(displayName || "?")[0]?.toUpperCase()}
            </div>
          )}
          <p className="text-xs text-muted-foreground">
            Avatar comes from your Google account.
          </p>
        </div>
        <div>
          <Label htmlFor="dn">Display name</Label>
          <Input
            id="dn"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            className="mt-1.5"
            maxLength={50}
          />
        </div>
        <div>
          <Label htmlFor="bio">Bio</Label>
          <Textarea
            id="bio"
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            maxLength={280}
            rows={3}
            className="mt-1.5"
            placeholder="A quiet line about your practice."
          />
        </div>
      </section>

      <section className="mt-6 grove-card space-y-5 p-6">
        <h2 className="font-display text-lg text-forest">Privacy</h2>
        <div>
          <Label>Forest visibility</Label>
          <div className="mt-2 grid grid-cols-3 gap-2">
            {(["private", "friends", "public"] as const).map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setVisibility(v)}
                className={`rounded-xl border px-3 py-2 text-sm capitalize ${visibility === v ? "border-forest bg-forest text-parchment" : "border-border bg-card"}`}
              >
                {v}
              </button>
            ))}
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Habits marked private always show as "A quiet promise" on plaques, even to friends.
          </p>
        </div>
      </section>

      <section className="mt-6 grove-card space-y-5 p-6">
        <h2 className="font-display text-lg text-forest">Forest & experience</h2>
        <Row label="Sound" desc="Subtle audio cues on tend.">
          <Switch checked={sound} onCheckedChange={setSound} />
        </Row>
        <Row label="Reduced motion" desc="Calmer transitions and animations.">
          <Switch checked={reduced} onCheckedChange={setReduced} />
        </Row>
        <div>
          <Label htmlFor="tz">Timezone</Label>
          <Input id="tz" value={timezone} onChange={(e) => setTimezone(e.target.value)} className="mt-1.5" />
          <button
            type="button"
            className="mt-2 text-xs text-moss hover:underline"
            onClick={() => setTimezone(Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC")}
          >
            Use device timezone
          </button>
        </div>
      </section>

      <Button
        onClick={() => save.mutate()}
        disabled={save.isPending}
        className="mt-6 w-full rounded-xl bg-forest text-parchment hover:bg-forest/90 min-h-[48px]"
      >
        Save settings
      </Button>

      <section className="mt-8 grove-card p-6">
        <h2 className="font-display text-lg text-forest">Account</h2>
        <p className="mt-2 text-xs text-muted-foreground">
          Signed in with Google as {p?.display_name || "Growve member"}.
        </p>
        <Button
          onClick={signOut}
          variant="ghost"
          className="mt-4 w-full text-muted-foreground min-h-[44px]"
        >
          <LogOut className="mr-2 h-4 w-4" /> Sign out
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
