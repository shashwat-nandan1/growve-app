import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { UserPlus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { AppShell } from "@/components/AppShell";
import { ForestMiniPreview } from "@/components/ForestMiniPreview";

export const Route = createFileRoute("/_authenticated/friends/")({
  head: () => ({ meta: [{ title: "Friends — Growve" }] }),
  component: FriendsPage,
});

type ProfileLite = {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
  forest_seed: number | null;
};

type FriendshipRow = {
  id: string;
  requester_id: string;
  addressee_id: string;
  status: "accepted";
  requester: ProfileLite | null;
  addressee: ProfileLite | null;
};

function FriendsPage() {
  const { user } = useAuth();

  const friendships = useQuery({
    queryKey: ["friendships-accepted", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("friendships")
        .select(
          "id, requester_id, addressee_id, status, requester:requester_id(id, display_name, avatar_url, forest_seed), addressee:addressee_id(id, display_name, avatar_url, forest_seed)"
        )
        .eq("status", "accepted")
        .or(`requester_id.eq.${user!.id},addressee_id.eq.${user!.id}`);
      if (error) throw error;
      return (data ?? []) as unknown as FriendshipRow[];
    },
  });

  const friends: ProfileLite[] = (friendships.data ?? [])
    .map((f) => (f.requester_id === user!.id ? f.addressee : f.requester))
    .filter((p): p is ProfileLite => !!p);

  return (
    <AppShell>
      <header className="flex items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl text-forest">Friends</h1>
          <p className="mt-1 text-sm text-muted-foreground">Wander each other's forests.</p>
        </div>
        <Link
          to="/friends/add"
          aria-label="Add friends"
          className="grove-card grid h-11 w-11 shrink-0 place-items-center rounded-2xl text-forest"
        >
          <UserPlus className="h-5 w-5" aria-hidden />
        </Link>
      </header>

      <div className="mt-6 space-y-4">
        {friendships.isLoading ? (
          <>
            <SkeletonCard />
            <SkeletonCard />
          </>
        ) : friendships.isError ? (
          <div className="grove-card p-6 text-center text-sm text-muted-foreground">
            Couldn't load your friends. Try again in a moment.
          </div>
        ) : friends.length === 0 ? (
          <div className="grove-card p-8 text-center">
            <p className="font-display text-lg text-forest">A quiet grove</p>
            <p className="mt-2 text-sm text-muted-foreground">
              Forests are quieter alone. Add a friend to visit one another's groves.
            </p>
            <Link
              to="/friends/add"
              className="mt-4 inline-flex items-center gap-1 rounded-full bg-forest px-4 py-2 text-sm text-parchment hover:bg-forest/90"
            >
              <UserPlus className="h-4 w-4" /> Find friends
            </Link>
          </div>
        ) : (
          friends.map((p) => <FriendForestCard key={p.id} profile={p} />)
        )}
      </div>
    </AppShell>
  );
}

function FriendForestCard({ profile }: { profile: ProfileLite }) {
  const navigate = useNavigate();

  const summary = useQuery({
    queryKey: ["friend-forest-summary", profile.id],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_visible_forest", { _owner_id: profile.id });
      if (error) return { count: 0, visible: false as const };
      const rows = (data ?? []) as unknown[];
      return { count: rows.length, visible: true as const };
    },
    retry: false,
  });

  const seed = profile.forest_seed ? Number(profile.forest_seed) % 2147483647 : 1;
  const count = summary.data?.count ?? 0;

  return (
    <button
      type="button"
      onClick={() => navigate({ to: "/forest/$ownerId", params: { ownerId: profile.id } })}
      aria-label={`Visit ${profile.display_name ?? "friend"}'s forest`}
      className="grove-card block w-full overflow-hidden p-0 text-left transition-transform active:scale-[0.995]"
    >
      <div className="flex items-center gap-3 px-4 pt-4">
        <ProfileAvatar url={profile.avatar_url} name={profile.display_name ?? "?"} />
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium text-forest">
            {profile.display_name || "Growve member"}
          </p>
          <p className="truncate text-xs text-muted-foreground">
            {summary.isLoading ? "…" : <>{count} trees · Visit forest</>}
          </p>
        </div>
      </div>
      <div className="mt-3">
        <ForestMiniPreview
          count={count}
          seed={seed}
          height={120}
          emptyLabel="A young forest, still taking root."
          className="rounded-none border-t border-border bg-gradient-to-b from-mist to-parchment"
        />
      </div>
    </button>
  );
}

function ProfileAvatar({ url, name }: { url: string | null; name: string }) {
  if (url) return <img src={url} alt="" className="h-11 w-11 shrink-0 rounded-full object-cover" />;
  return (
    <div className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-sage/40 text-sm font-medium text-forest" aria-hidden>
      {name?.[0]?.toUpperCase() ?? "?"}
    </div>
  );
}

function SkeletonCard() {
  return <div className="grove-card h-40 animate-pulse" />;
}
