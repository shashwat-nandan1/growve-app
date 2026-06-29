import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Settings as SettingsIcon, LogOut } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useProfile } from "@/hooks/useProfile";
import { useAuth } from "@/lib/auth";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export const Route = createFileRoute("/_authenticated/you")({
  head: () => ({ meta: [{ title: "You — Growve" }] }),
  component: YouPage,
});

function YouPage() {
  const profile = useProfile();
  const { user } = useAuth();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [editing, setEditing] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");

  function startEdit() {
    setDisplayName(profile.data?.display_name || "");
    setBio(profile.data?.bio || "");
    setAvatarUrl(profile.data?.avatar_url || "");
    setEditing(true);
  }

  const save = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("profiles").update({
        display_name: displayName.trim() || null,
        bio: bio.trim().slice(0, 280) || null,
        avatar_url: avatarUrl.trim() || null,
      }).eq("id", user!.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["profile"] });
      setEditing(false);
      toast.success("Profile updated.");
    },
    onError: (e: { message: string }) => toast.error(e.message),
  });

  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  if (profile.isLoading) return <AppShell><div className="h-32 animate-pulse rounded-2xl bg-mist" /></AppShell>;
  const p = profile.data;

  return (
    <AppShell>
      <header className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
        <div className="min-w-0">
          <h1 className="font-display text-3xl text-forest truncate">{p?.display_name || p?.username}</h1>
          <p className="text-sm text-muted-foreground">@{p?.username}</p>
        </div>
        <Link to="/settings" className="grove-card grid h-10 w-10 shrink-0 place-items-center rounded-xl">
          <SettingsIcon className="h-4 w-4 text-forest" />
        </Link>
      </header>

      <div className="mt-6 grove-card p-6">
        <div className="flex items-center gap-4">
          {p?.avatar_url ? (
            <img src={p.avatar_url} alt="" className="h-16 w-16 rounded-full object-cover" />
          ) : (
            <div className="grid h-16 w-16 place-items-center rounded-full bg-sage/40 text-xl font-display text-forest">
              {(p?.display_name || p?.username || "?")[0]?.toUpperCase()}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="text-sm text-foreground/90">{p?.bio || <span className="text-muted-foreground italic">No bio yet.</span>}</p>
          </div>
        </div>

        {!editing ? (
          <Button onClick={startEdit} variant="outline" className="mt-5 w-full rounded-xl">Edit profile</Button>
        ) : (
          <form onSubmit={(e) => { e.preventDefault(); save.mutate(); }} className="mt-5 space-y-4">
            <div>
              <Label htmlFor="dn">Display name</Label>
              <Input id="dn" value={displayName} onChange={(e) => setDisplayName(e.target.value)} className="mt-1.5" maxLength={50} />
            </div>
            <div>
              <Label htmlFor="av">Avatar URL</Label>
              <Input id="av" value={avatarUrl} onChange={(e) => setAvatarUrl(e.target.value)} className="mt-1.5" />
            </div>
            <div>
              <Label htmlFor="bio">Bio</Label>
              <Textarea id="bio" value={bio} onChange={(e) => setBio(e.target.value)} maxLength={280} className="mt-1.5" rows={3} />
            </div>
            <div className="flex gap-2">
              <Button type="button" variant="ghost" className="flex-1" onClick={() => setEditing(false)}>Cancel</Button>
              <Button type="submit" disabled={save.isPending} className="flex-1 rounded-xl bg-forest text-parchment hover:bg-forest/90">Save</Button>
            </div>
          </form>
        )}
      </div>

      <Button onClick={signOut} variant="ghost" className="mt-6 w-full text-muted-foreground">
        <LogOut className="mr-2 h-4 w-4" /> Sign out
      </Button>
    </AppShell>
  );
}
