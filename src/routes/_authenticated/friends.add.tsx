import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, Check, X, UserPlus, Search, Ban } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { AppShell } from "@/components/AppShell";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/friends/add")({
  head: () => ({ meta: [{ title: "Add friends — Growve" }] }),
  component: AddFriendsPage,
});

type ProfileLite = {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
};

type FriendshipRow = {
  id: string;
  requester_id: string;
  addressee_id: string;
  status: "pending" | "accepted" | "blocked";
  requester: ProfileLite | null;
  addressee: ProfileLite | null;
};

function AddFriendsPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ProfileLite[]>([]);
  const [searching, setSearching] = useState(false);

  const friendships = useQuery({
    queryKey: ["friendships", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("friendships")
        .select(
          "id, requester_id, addressee_id, status, requester:requester_id(id, display_name, avatar_url), addressee:addressee_id(id, display_name, avatar_url)"
        )
        .or(`requester_id.eq.${user!.id},addressee_id.eq.${user!.id}`);
      if (error) throw error;
      return (data ?? []) as unknown as FriendshipRow[];
    },
  });

  async function search(e: React.FormEvent) {
    e.preventDefault();
    const q = query.trim();
    if (q.length < 2) return;
    setSearching(true);
    const { data, error } = await supabase
      .from("profiles")
      .select("id, display_name, avatar_url")
      .ilike("display_name", `%${q}%`)
      .neq("id", user!.id)
      .limit(20);
    setSearching(false);
    if (error) return toast.error(error.message);
    setResults((data ?? []) as ProfileLite[]);
  }

  const invalidate = () => qc.invalidateQueries({ queryKey: ["friendships"] });

  const sendRequest = useMutation({
    mutationFn: async (addresseeId: string) => {
      const { error } = await supabase.from("friendships").insert({
        requester_id: user!.id, addressee_id: addresseeId,
      });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Request sent."); invalidate(); },
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
    onSuccess: (_data, vars) => { invalidate(); toast(vars.accept ? "Friendship accepted." : "Declined."); },
    onError: (e: { message: string }) => toast.error(friendlyError(e.message)),
  });

  const cancelSent = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("friendships").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { invalidate(); toast("Request cancelled."); },
  });

  const unblock = useMutation({
    mutationFn: async (targetId: string) => {
      const { error } = await supabase.rpc("unblock_user", { _target: targetId });
      if (error) throw error;
    },
    onSuccess: () => { invalidate(); toast("Unblocked."); },
  });

  const all = friendships.data ?? [];
  const pending = all.filter((f) => f.status === "pending" && f.addressee_id === user!.id);
  const outgoing = all.filter((f) => f.status === "pending" && f.requester_id === user!.id);
  const blocked = all.filter((f) => f.status === "blocked" && f.requester_id === user!.id);
  const accepted = all.filter((f) => f.status === "accepted");

  return (
    <AppShell>
      <Link to="/friends" className="inline-flex items-center gap-1 text-sm text-moss hover:underline">
        <ArrowLeft className="h-4 w-4" /> Friends
      </Link>
      <h1 className="mt-3 font-display text-3xl text-forest">Add friends</h1>
      <p className="mt-1 text-sm text-muted-foreground">Search by name to send a gentle request.</p>

      <form onSubmit={search} className="mt-6 flex gap-2" role="search" aria-label="Search Growve members">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name"
            className="pl-9"
            aria-label="Search Growve members by name"
          />
        </div>
        <Button
          type="submit"
          disabled={searching || query.trim().length < 2}
          className="rounded-xl bg-forest text-parchment hover:bg-forest/90"
        >
          Search
        </Button>
      </form>

      {results.length > 0 && (
        <Section title="Search results">
          {results.map((p) => {
            const existing = all.find((f) => f.requester_id === p.id || f.addressee_id === p.id);
            return (
              <div key={p.id} className="grove-card flex items-center gap-3 p-3">
                <ProfileAvatar url={p.avatar_url} name={p.display_name ?? "?"} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-forest">
                    {p.display_name || "Growve member"}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {existing ? friendshipLabel(existing, user!.id) : "Not connected"}
                  </p>
                </div>
                {!existing && (
                  <Button
                    size="sm"
                    onClick={() => sendRequest.mutate(p.id)}
                    className="rounded-full bg-forest text-parchment hover:bg-forest/90 min-h-[36px]"
                    aria-label={`Send friend request to ${p.display_name ?? "member"}`}
                  >
                    <UserPlus className="h-4 w-4" />
                  </Button>
                )}
              </div>
            );
          })}
        </Section>
      )}
      {results.length === 0 && query.trim().length >= 2 && !searching && (
        <p className="mt-4 text-center text-sm text-muted-foreground">No one found by that name.</p>
      )}

      {pending.length > 0 && (
        <Section title="Requests for you">
          {pending.map((f) => {
            const p = f.requester!;
            return (
              <div key={f.id} className="grove-card flex items-center gap-3 p-3">
                <ProfileAvatar url={p.avatar_url} name={p.display_name ?? "?"} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-forest">{p.display_name || "Growve member"}</p>
                  <p className="truncate text-xs text-muted-foreground">wants to be friends</p>
                </div>
                <Button size="sm" onClick={() => respond.mutate({ id: f.id, accept: true })} className="rounded-full bg-forest text-parchment hover:bg-forest/90" aria-label={`Accept request from ${p.display_name ?? "member"}`}>
                  <Check className="h-4 w-4" />
                </Button>
                <Button size="sm" variant="ghost" onClick={() => respond.mutate({ id: f.id, accept: false })} aria-label={`Decline request from ${p.display_name ?? "member"}`}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            );
          })}
        </Section>
      )}

      {outgoing.length > 0 && (
        <Section title="Pending invitations">
          {outgoing.map((f) => {
            const p = f.addressee!;
            return (
              <div key={f.id} className="grove-card flex items-center gap-3 p-3 opacity-90">
                <ProfileAvatar url={p.avatar_url} name={p.display_name ?? "?"} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-forest">{p.display_name || "Growve member"}</p>
                  <p className="truncate text-xs text-muted-foreground">Awaiting response</p>
                </div>
                <Button size="sm" variant="ghost" onClick={() => cancelSent.mutate(f.id)} className="text-muted-foreground">
                  Cancel
                </Button>
              </div>
            );
          })}
        </Section>
      )}

      {accepted.length > 0 && (
        <Section title="Your friends">
          {accepted.map((f) => {
            const p = (f.requester_id === user!.id ? f.addressee : f.requester)!;
            return (
              <div key={f.id} className="grove-card flex items-center gap-3 p-3">
                <ProfileAvatar url={p.avatar_url} name={p.display_name ?? "?"} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-forest">{p.display_name || "Growve member"}</p>
                  <p className="truncate text-xs text-muted-foreground">Friend</p>
                </div>
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
                <ProfileAvatar url={p.avatar_url} name={p.display_name ?? "?"} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-forest">{p.display_name || "Growve member"}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    <Ban className="inline h-3 w-3" /> Blocked
                  </p>
                </div>
                <Button size="sm" variant="ghost" onClick={() => unblock.mutate(p.id)}>Unblock</Button>
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
