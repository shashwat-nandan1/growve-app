import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Check, X, UserPlus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { AppShell } from "@/components/AppShell";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/friends")({
  head: () => ({ meta: [{ title: "Friends — Growve" }] }),
  component: FriendsPage,
});

function FriendsPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Array<{ id: string; username: string; display_name: string | null; avatar_url: string | null }>>([]);

  const friendships = useQuery({
    queryKey: ["friendships", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("friendships")
        .select("id, requester_id, addressee_id, status, requester:requester_id(id, username, display_name, avatar_url), addressee:addressee_id(id, username, display_name, avatar_url)")
        .or(`requester_id.eq.${user!.id},addressee_id.eq.${user!.id}`);
      if (error) throw error;
      return data ?? [];
    },
  });

  async function search(e: React.FormEvent) {
    e.preventDefault();
    if (query.trim().length < 2) return;
    const { data, error } = await supabase
      .from("profiles")
      .select("id, username, display_name, avatar_url")
      .ilike("username", `%${query.trim()}%`)
      .neq("id", user!.id)
      .limit(10);
    if (error) return toast.error(error.message);
    setResults(data ?? []);
  }

  const sendRequest = useMutation({
    mutationFn: async (addresseeId: string) => {
      const { error } = await supabase.from("friendships").insert({
        requester_id: user!.id, addressee_id: addresseeId,
      });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Request sent."); qc.invalidateQueries({ queryKey: ["friendships"] }); },
    onError: (e: { message: string }) => toast.error(e.message),
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
  });

  const pending = (friendships.data ?? []).filter((f) => f.status === "pending" && f.addressee_id === user!.id);
  const accepted = (friendships.data ?? []).filter((f) => f.status === "accepted");
  const outgoing = (friendships.data ?? []).filter((f) => f.status === "pending" && f.requester_id === user!.id);

  return (
    <AppShell>
      <h1 className="font-display text-3xl text-forest">Friends</h1>
      <p className="mt-1 text-sm text-muted-foreground">Wander each other's forests.</p>

      <form onSubmit={search} className="mt-6 flex gap-2">
        <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search username" className="flex-1" />
        <Button type="submit" className="rounded-xl bg-forest text-parchment hover:bg-forest/90">Search</Button>
      </form>

      {results.length > 0 && (
        <div className="mt-4 space-y-2">
          {results.map((p) => (
            <div key={p.id} className="grove-card flex items-center gap-3 p-3">
              <Avatar url={p.avatar_url} name={p.username} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-forest">{p.display_name || p.username}</p>
                <p className="truncate text-xs text-muted-foreground">@{p.username}</p>
              </div>
              <Button size="sm" variant="ghost" onClick={() => sendRequest.mutate(p.id)} className="text-moss">
                <UserPlus className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      )}

      {pending.length > 0 && (
        <Section title="Requests">
          {pending.map((f) => {
            const p = (f as Record<string, unknown> as { requester: { id: string; username: string; display_name: string | null; avatar_url: string | null } }).requester;
            return (
              <div key={f.id} className="grove-card flex items-center gap-3 p-3">
                <Avatar url={p.avatar_url} name={p.username} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-forest">{p.display_name || p.username}</p>
                  <p className="truncate text-xs text-muted-foreground">wants to be friends</p>
                </div>
                <Button size="sm" onClick={() => respond.mutate({ id: f.id, accept: true })} className="rounded-full bg-forest text-parchment"><Check className="h-4 w-4" /></Button>
                <Button size="sm" variant="ghost" onClick={() => respond.mutate({ id: f.id, accept: false })}><X className="h-4 w-4" /></Button>
              </div>
            );
          })}
        </Section>
      )}

      <Section title="Your friends">
        {accepted.length === 0 ? (
          <p className="text-sm text-muted-foreground">No friends yet. Search above to find your circle.</p>
        ) : accepted.map((f) => {
          const other = (f as Record<string, unknown> as { requester_id: string; requester: { id: string; username: string; display_name: string | null; avatar_url: string | null }; addressee: { id: string; username: string; display_name: string | null; avatar_url: string | null } });
          const p = other.requester_id === user!.id ? other.addressee : other.requester;
          return (
            <div key={f.id} className="grove-card flex items-center gap-3 p-3">
              <Avatar url={p.avatar_url} name={p.username} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-forest">{p.display_name || p.username}</p>
                <p className="truncate text-xs text-muted-foreground">@{p.username}</p>
              </div>
            </div>
          );
        })}
      </Section>

      {outgoing.length > 0 && (
        <Section title="Pending invitations">
          {outgoing.map((f) => {
            const p = (f as Record<string, unknown> as { addressee: { username: string; display_name: string | null; avatar_url: string | null } }).addressee;
            return (
              <div key={f.id} className="grove-card flex items-center gap-3 p-3 opacity-70">
                <Avatar url={p.avatar_url} name={p.username} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-forest">{p.display_name || p.username}</p>
                  <p className="truncate text-xs text-muted-foreground">Awaiting response</p>
                </div>
              </div>
            );
          })}
        </Section>
      )}
    </AppShell>
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

function Avatar({ url, name }: { url: string | null; name: string }) {
  if (url) return <img src={url} alt={name} className="h-10 w-10 shrink-0 rounded-full object-cover" />;
  return (
    <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-sage/40 text-sm font-medium text-forest">
      {name?.[0]?.toUpperCase() ?? "?"}
    </div>
  );
}
