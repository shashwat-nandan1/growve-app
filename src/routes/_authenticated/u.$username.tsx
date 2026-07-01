import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowLeft, Trees as TreesIcon, UserPlus, Check, X, Ban, UserMinus } from "lucide-react";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/u/$username")({
  head: ({ params }) => ({ meta: [{ title: `@${params.username} — Growve` }] }),
  component: ProfilePage,
});

type Profile = {
  id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  forest_visibility: "private" | "friends" | "public";
};

type Friendship = {
  id: string;
  requester_id: string;
  addressee_id: string;
  status: "pending" | "accepted" | "blocked";
};

function ProfilePage() {
  const { username } = Route.useParams();
  const { user } = useAuth();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [confirmBlock, setConfirmBlock] = useState(false);

  const profileQ = useQuery({
    queryKey: ["profile-by-username", username],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, username, display_name, avatar_url, bio, forest_visibility")
        .eq("username", username)
        .maybeSingle();
      if (error) throw error;
      return data as Profile | null;
    },
  });

  const p = profileQ.data;
  const isSelf = p?.id === user?.id;

  const friendshipQ = useQuery({
    queryKey: ["friendship-with", p?.id, user?.id],
    enabled: !!p?.id && !isSelf,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("friendships")
        .select("id, requester_id, addressee_id, status")
        .or(
          `and(requester_id.eq.${user!.id},addressee_id.eq.${p!.id}),and(requester_id.eq.${p!.id},addressee_id.eq.${user!.id})`,
        );
      if (error) throw error;
      return (data ?? []) as Friendship[];
    },
  });

  const treeCountQ = useQuery({
    queryKey: ["visit-tree-count", p?.id],
    enabled: !!p?.id,
    queryFn: async () => {
      const { count } = await supabase.from("forest_trees").select("id", { count: "exact", head: true }).eq("owner_id", p!.id);
      return count ?? 0;
    },
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["friendship-with", p?.id, user?.id] });
    qc.invalidateQueries({ queryKey: ["friendships"] });
  };

  const sendRequest = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("friendships").insert({ requester_id: user!.id, addressee_id: p!.id });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Request sent."); invalidate(); },
    onError: (e: { message: string }) => toast.error(e.message),
  });

  const accept = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("friendships").update({ status: "accepted", responded_at: new Date().toISOString() }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { invalidate(); toast("Friendship accepted."); },
    onError: (e: { message: string }) => toast.error(e.message),
  });

  const removeOrCancel = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("friendships").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { invalidate(); setConfirmRemove(false); },
    onError: (e: { message: string }) => toast.error(e.message),
  });

  const block = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc("block_user", { _target: p!.id });
      if (error) throw error;
    },
    onSuccess: () => { invalidate(); setConfirmBlock(false); toast("Blocked."); },
    onError: (e: { message: string }) => toast.error(e.message),
  });

  const unblock = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc("unblock_user", { _target: p!.id });
      if (error) throw error;
    },
    onSuccess: () => { invalidate(); toast("Unblocked."); },
    onError: (e: { message: string }) => toast.error(e.message),
  });

  if (profileQ.isLoading) return <AppShell><div className="h-40 animate-pulse rounded-2xl bg-mist" /></AppShell>;

  if (!p) {
    return (
      <AppShell>
        <BackLink />
        <div className="grove-card mt-6 p-8 text-center">
          <p className="font-display text-lg text-forest">No one here by that name</p>
          <p className="mt-2 text-sm text-muted-foreground">The path to @{username} seems overgrown.</p>
        </div>
      </AppShell>
    );
  }

  const rel = friendshipQ.data ?? [];
  const active = rel[0];
  const iBlocked = rel.some((f) => f.status === "blocked" && f.requester_id === user!.id);
  const theyBlocked = rel.some((f) => f.status === "blocked" && f.requester_id === p.id);
  const isFriend = rel.some((f) => f.status === "accepted");
  const pendingFromMe = rel.find((f) => f.status === "pending" && f.requester_id === user!.id);
  const pendingToMe = rel.find((f) => f.status === "pending" && f.addressee_id === user!.id);

  const canVisit =
    !theyBlocked && !iBlocked && (
      isSelf ||
      p.forest_visibility === "public" ||
      (p.forest_visibility === "friends" && isFriend)
    );

  const visibilityCopy =
    p.forest_visibility === "public" ? "Their forest is open to all Growve wanderers."
      : p.forest_visibility === "friends" ? "Their forest is open to friends."
      : "Their forest is private.";

  return (
    <AppShell>
      <BackLink />
      <div className="mt-4 flex items-center gap-4">
        {p.avatar_url ? (
          <img src={p.avatar_url} alt="" className="h-20 w-20 rounded-full object-cover" />
        ) : (
          <div className="grid h-20 w-20 place-items-center rounded-full bg-sage/40 font-display text-2xl text-forest" aria-hidden>
            {(p.display_name || p.username || "?")[0]?.toUpperCase()}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <h1 className="truncate font-display text-2xl text-forest">{p.display_name || p.username}</h1>
          <p className="truncate text-sm text-muted-foreground">@{p.username}</p>
          <p className="mt-1 text-xs text-muted-foreground">{treeCountQ.data ?? "…"} trees planted</p>
        </div>
      </div>

      {p.bio && <p className="mt-4 text-sm text-foreground/90">{p.bio}</p>}

      <p className="mt-4 text-xs text-muted-foreground italic">{visibilityCopy}</p>

      {!isSelf && (
        <div className="mt-6 space-y-3">
          {theyBlocked ? (
            <div className="grove-card p-4 text-center text-sm text-muted-foreground">
              You cannot connect with this person.
            </div>
          ) : iBlocked ? (
            <Button variant="outline" className="w-full rounded-xl" onClick={() => unblock.mutate()}>
              Unblock @{p.username}
            </Button>
          ) : (
            <>
              {canVisit && (
                <Button
                  onClick={() => p.username && navigate({ to: "/u/$username/forest", params: { username: p.username } })}
                  className="w-full rounded-xl bg-forest text-parchment hover:bg-forest/90"
                >
                  <TreesIcon className="mr-2 h-4 w-4" /> Enter their forest
                </Button>
              )}

              {pendingToMe ? (
                <div className="flex gap-2">
                  <Button className="flex-1 rounded-xl bg-forest text-parchment hover:bg-forest/90" onClick={() => accept.mutate(pendingToMe.id)}>
                    <Check className="mr-2 h-4 w-4" /> Accept request
                  </Button>
                  <Button variant="ghost" className="flex-1" onClick={() => removeOrCancel.mutate(pendingToMe.id)}>
                    <X className="mr-2 h-4 w-4" /> Decline
                  </Button>
                </div>
              ) : pendingFromMe ? (
                <Button variant="outline" className="w-full rounded-xl" onClick={() => removeOrCancel.mutate(pendingFromMe.id)}>
                  Cancel request
                </Button>
              ) : isFriend ? (
                confirmRemove ? (
                  <div className="grove-card flex items-center justify-between gap-2 p-3">
                    <span className="text-sm text-muted-foreground">End this friendship?</span>
                    <div className="flex gap-2">
                      <Button size="sm" variant="ghost" onClick={() => setConfirmRemove(false)}>Keep</Button>
                      <Button size="sm" className="rounded-full bg-forest text-parchment hover:bg-forest/90" onClick={() => active && removeOrCancel.mutate(active.id)}>Remove</Button>
                    </div>
                  </div>
                ) : (
                  <Button variant="outline" className="w-full rounded-xl" onClick={() => setConfirmRemove(true)}>
                    <UserMinus className="mr-2 h-4 w-4" /> Remove friend
                  </Button>
                )
              ) : (
                <Button className="w-full rounded-xl bg-forest text-parchment hover:bg-forest/90" onClick={() => sendRequest.mutate()}>
                  <UserPlus className="mr-2 h-4 w-4" /> Send friend request
                </Button>
              )}

              {confirmBlock ? (
                <div className="grove-card flex items-center justify-between gap-2 p-3">
                  <span className="text-sm text-muted-foreground">Block @{p.username}?</span>
                  <div className="flex gap-2">
                    <Button size="sm" variant="ghost" onClick={() => setConfirmBlock(false)}>Cancel</Button>
                    <Button size="sm" className="rounded-full bg-forest text-parchment hover:bg-forest/90" onClick={() => block.mutate()}>Block</Button>
                  </div>
                </div>
              ) : (
                <Button variant="ghost" className="w-full text-muted-foreground" onClick={() => setConfirmBlock(true)}>
                  <Ban className="mr-2 h-4 w-4" /> Block
                </Button>
              )}
            </>
          )}
        </div>
      )}

      {isSelf && (
        <Link to="/you" className="mt-6 block text-center text-sm text-moss hover:underline">
          This is you — edit your profile
        </Link>
      )}
    </AppShell>
  );
}

function BackLink() {
  return (
    <Link to="/friends" className="inline-flex items-center gap-1 text-sm text-moss hover:underline">
      <ArrowLeft className="h-4 w-4" /> Friends
    </Link>
  );
}
