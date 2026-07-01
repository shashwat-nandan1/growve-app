import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Check, X, UserPlus, Search, Ban, UserMinus, ArrowUpRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { AppShell } from "@/components/AppShell";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/friends")({
  head: () => ({ meta: [{ title: "Friends — Growve" }] }),
  component: FriendsPage,
});

type ProfileLite = { id: string; username: string | null; display_name: string | null; avatar_url: string | null };
type FriendshipRow = {
  id: string;
  requester_id: string;
  addressee_id: string;
  status: "pending" | "accepted" | "blocked";
  requester: ProfileLite | null;
  addressee: ProfileLite | null;
};

function FriendsPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ProfileLite[]>([]);

  const friendships = useQuery({
    queryKey: ["friendships", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("friendships")
        .select("id, requester_id, addressee_id, status, requester:requester_id(id, username, display_name, avatar_url), addressee:addressee_id(id, username, display_name, avatar_url)")
        .or(`requester_id.eq.${user!.id},addressee_id.eq.${user!.id}`);
      if (error) throw error;
      return (data ?? []) as unknown as FriendshipRow[];
    },
  });

  async function search(e: React.FormEvent) {
    e.preventDefault();
    const q = query.trim();
    if (q.length < 2) return;
    const { data, error } = await supabase
      .from("profiles")
      .select("id, username, display_name, avatar_url")
      .ilike("username", `%${q}%`)
      .neq("id", user!.id)
      .limit(10);
    if (error) return toast.error(error.message);
    setResults((data ?? []) as ProfileLite[]);
  }

  const sendRequest = useMutation({
    mutationFn: async (addresseeId: string) => {
      const { error } = await supabase.from("friendships").insert({
        requester_id: user!.id, addressee_id: addresseeId,
      });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Request sent."); qc.invalidateQueries({ queryKey: ["friendships"] }); },
    onError: (e: { message: string }) => toast.error(friendlyError(e.message)),
  });

  const respond = useMutation({
    mutationFn: async ({ id, accept }: { id: string; accept: boolean }) => {
      if (accept) {
        const { error } = await supabase.from("friendships").update({ status: "accepted", responded_at: new Date().toISOString() }).eq("id", id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("friendships").delete().eq("id", id);
        if (error) throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["friendships"] }),
    onError: (e: { message: string }) => toast.error(friendlyError(e.message)),
  });

  const removeFriend = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("friendships").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast("Friendship ended gently."); qc.invalidateQueries({ queryKey: ["friendships"] }); },
    onError: (e: { message: string }) => toast.error(friendlyError(e.message)),
  });

  const unblock = useMutation({
    mutationFn: async (targetId: string) => {
      const { error } = await supabase.rpc("unblock_user", { _target: targetId });
      if (error) throw error;
    },
    onSuccess: () => { toast("Unblocked."); qc.invalidateQueries({ queryKey: ["friendships"] }); },
    onError: (e: { message: string }) => toast.error(friendlyError(e.message)),
  });

  const all = friendships.data ?? [];
  const pending = all.filter((f) => f.status === "pending" && f.addressee_id === user!.id);
  const accepted = all.filter((f) => f.status === "accepted");
  const outgoing = all.filter((f) => f.status === "pending" && f.requester_id === user!.id);
  const blocked = all.filter((f) => f.status === "blocked" && f.requester_id === user!.id);

  return (
    <AppShell>
      <h1 className="font-display text-3xl text-forest">Friends</h1>
      <p className="mt-1 text-sm text-muted-foreground">Wander each other's forests.</p>

      <form onSubmit={search} className="mt-6 flex gap-2" role="search" aria-label="Find friends by username">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search username"
            className="pl-9"
            aria-label="Username to search"
          />
        </div>
        <Button type="submit" className="rounded-xl bg-forest text-parchment hover:bg-forest/90">Search</Button>
      </form>

      {results.length > 0 && (
        <Section title="Search results">
          {results.map((p) => {
            const existing = all.find((f) => (f.requester_id === p.id || f.addressee_id === p.id));
            return (
              <div key={p.id} className="grove-card flex items-center gap-3 p-3">
                <ProfileAvatar url={p.avatar_url} name={p.username ?? "?"} />
                <button
                  type="button"
                  onClick={() => p.username && navigate({ to: "/u/$username", params: { username: p.username } })}
                  className="min-w-0 flex-1 text-left"
                >
                  <p className="truncate text-sm font-medium text-forest">{p.display_name || p.username}</p>
                  <p className="truncate text-xs text-muted-foreground">@{p.username}</p>
                </button>
                {existing ? (
                  <span className="text-xs text-muted-foreground italic">{friendshipLabel(existing, user!.id)}</span>
                ) : (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => sendRequest.mutate(p.id)}
                    className="text-moss"
                    aria-label={`Send friend request to ${p.username ?? "user"}`}
                  >
                    <UserPlus className="h-4 w-4" />
                  </Button>
                )}
              </div>
            );
          })}
        </Section>
      )}

      {pending.length > 0 && (
        <Section title="Requests for you">
          {pending.map((f) => {
            const p = f.requester!;
            return (
              <div key={f.id} className="grove-card flex items-center gap-3 p-3">
                <ProfileAvatar url={p.avatar_url} name={p.username ?? "?"} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-forest">{p.display_name || p.username}</p>
                  <p className="truncate text-xs text-muted-foreground">wants to be friends</p>
                </div>
                <Button
                  size="sm"
                  onClick={() => respond.mutate({ id: f.id, accept: true })}
                  className="rounded-full bg-forest text-parchment hover:bg-forest/90"
                  aria-label={`Accept request from ${p.username ?? "user"}`}
                >
                  <Check className="h-4 w-4" />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => respond.mutate({ id: f.id, accept: false })}
                  aria-label={`Decline request from ${p.username ?? "user"}`}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            );
          })}
        </Section>
      )}

      <Section title="Your friends">
        {accepted.length === 0 ? (
          <p className="text-sm text-muted-foreground">No friends yet. Search above to find your circle.</p>
        ) : (
          accepted.map((f) => {
            const p = f.requester_id === user!.id ? f.addressee! : f.requester!;
            return <FriendCard key={f.id} friendship={f} profile={p} onRemove={() => removeFriend.mutate(f.id)} />;
          })
        )}
      </Section>

      {outgoing.length > 0 && (
        <Section title="Pending invitations">
          {outgoing.map((f) => {
            const p = f.addressee!;
            return (
              <div key={f.id} className="grove-card flex items-center gap-3 p-3 opacity-80">
                <ProfileAvatar url={p.avatar_url} name={p.username ?? "?"} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-forest">{p.display_name || p.username}</p>
                  <p className="truncate text-xs text-muted-foreground">Awaiting response</p>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => removeFriend.mutate(f.id)}
                  className="text-muted-foreground"
                  aria-label={`Cancel request to ${p.username ?? "user"}`}
                >
                  Cancel
                </Button>
              </div>
            );
          })}
        </Section>
      )}

      {blocked.length > 0 && (
        <Section title="Blocked">
          {blocked.map((f) => {
            const p = f.addressee!;
            return (
              <div key={f.id} className="grove-card flex items-center gap-3 p-3">
                <ProfileAvatar url={p.avatar_url} name={p.username ?? "?"} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-forest">{p.display_name || p.username}</p>
                  <p className="truncate text-xs text-muted-foreground">Blocked · they can't see your forest</p>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => unblock.mutate(p.id)}
                  aria-label={`Unblock ${p.username ?? "user"}`}
                >
                  Unblock
                </Button>
              </div>
            );
          })}
        </Section>
      )}
    </AppShell>
  );
}

function friendshipLabel(f: FriendshipRow, uid: string): string {
  if (f.status === "accepted") return "Friend";
  if (f.status === "blocked") return f.requester_id === uid ? "Blocked" : "Unavailable";
  return f.requester_id === uid ? "Request sent" : "Awaiting your reply";
}

function friendlyError(message: string): string {
  if (message.includes("duplicate") || message.includes("unique")) return "You already have a connection with this person.";
  if (message.includes("block")) return "This request can't be sent right now.";
  return message;
}

function FriendCard({ friendship, profile, onRemove }: { friendship: FriendshipRow; profile: ProfileLite; onRemove: () => void }) {
  const [confirmRemove, setConfirmRemove] = useState(false);
  const summary = useQuery({
    queryKey: ["friend-forest-summary", profile.id],
    queryFn: async () => {
      const [countRes, lastRes] = await Promise.all([
        supabase.from("forest_trees").select("id", { count: "exact", head: true }).eq("owner_id", profile.id),
        supabase.from("forest_trees").select("planted_at").eq("owner_id", profile.id).order("planted_at", { ascending: false }).limit(1).maybeSingle(),
      ]);
      return {
        count: countRes.count ?? 0,
        lastPlanted: (lastRes.data?.planted_at as string | undefined) ?? null,
      };
    },
  });

  return (
    <div className="grove-card p-3">
      <div className="flex items-center gap-3">
        <ProfileAvatar url={profile.avatar_url} name={profile.username ?? "?"} />
        <Link
          to="/u/$username"
          params={{ username: profile.username ?? "" }}
          className="min-w-0 flex-1"
        >
          <p className="truncate text-sm font-medium text-forest">{profile.display_name || profile.username}</p>
          <p className="truncate text-xs text-muted-foreground">
            {summary.data?.count ?? "…"} trees
            {summary.data?.lastPlanted && (
              <> · last tended {new Date(summary.data.lastPlanted).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</>
            )}
          </p>
        </Link>
        {profile.username && (
          <Link
            to="/u/$username/forest"
            params={{ username: profile.username }}
            className="inline-flex items-center gap-1 rounded-full bg-sage/30 px-3 py-1 text-xs text-forest hover:bg-sage/50"
            aria-label={`Visit ${profile.username}'s forest`}
          >
            Visit <ArrowUpRight className="h-3 w-3" />
          </Link>
        )}
      </div>
      <div className="mt-2 flex justify-end gap-1 text-xs">
        {!confirmRemove ? (
          <Button
            size="sm"
            variant="ghost"
            className="text-muted-foreground"
            onClick={() => setConfirmRemove(true)}
            aria-label={`Remove ${profile.username ?? "friend"}`}
          >
            <UserMinus className="mr-1 h-3.5 w-3.5" /> Remove
          </Button>
        ) : (
          <>
            <span className="self-center text-muted-foreground">End this friendship?</span>
            <Button size="sm" variant="ghost" onClick={() => setConfirmRemove(false)}>Keep</Button>
            <Button size="sm" onClick={() => { onRemove(); setConfirmRemove(false); }} className="rounded-full bg-forest text-parchment hover:bg-forest/90">Remove</Button>
          </>
        )}
        <BlockButton targetId={profile.id} label={profile.username ?? "user"} onDone={() => void 0} friendshipId={friendship.id} />
      </div>
    </div>
  );
}

function BlockButton({ targetId, label }: { targetId: string; label: string; onDone: () => void; friendshipId?: string }) {
  const qc = useQueryClient();
  const [confirming, setConfirming] = useState(false);
  const block = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc("block_user", { _target: targetId });
      if (error) throw error;
    },
    onSuccess: () => {
      toast("Blocked. They can no longer visit your forest.");
      qc.invalidateQueries({ queryKey: ["friendships"] });
    },
    onError: (e: { message: string }) => toast.error(e.message),
  });
  if (!confirming) {
    return (
      <Button size="sm" variant="ghost" className="text-muted-foreground" onClick={() => setConfirming(true)} aria-label={`Block ${label}`}>
        <Ban className="mr-1 h-3.5 w-3.5" /> Block
      </Button>
    );
  }
  return (
    <>
      <span className="self-center text-muted-foreground">Block?</span>
      <Button size="sm" variant="ghost" onClick={() => setConfirming(false)}>Cancel</Button>
      <Button size="sm" onClick={() => { block.mutate(); setConfirming(false); }} className="rounded-full bg-forest text-parchment hover:bg-forest/90">Confirm</Button>
    </>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-8">
      <h2 className="mb-3 font-display text-lg text-forest">{title}</h2>
      <div className="space-y-2">{children}</div>
    </section>
  );
}

function ProfileAvatar({ url, name }: { url: string | null; name: string }) {
  if (url) return <img src={url} alt="" className="h-10 w-10 shrink-0 rounded-full object-cover" />;
  return (
    <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-sage/40 text-sm font-medium text-forest" aria-hidden>
      {name?.[0]?.toUpperCase() ?? "?"}
    </div>
  );
}
