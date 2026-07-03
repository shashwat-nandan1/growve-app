import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { UserPlus, Lock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { AppShell } from "@/components/AppShell";
import { ForestMiniPreview } from "@/components/ForestMiniPreview";

export const Route = createFileRoute("/_authenticated/friends")({
  head: () => ({ meta: [{ title: "Friends — Growve" }] }),
  component: FriendsPage,
});

type ProfileLite = {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
  forest_seed: number | null;
  forest_visibility: "public" | "friends" | "private";
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
          "id, requester_id, addressee_id, status, requester:requester_id(id, display_name, avatar_url, forest_seed, forest_visibility), addressee:addressee_id(id, display_name, avatar_url, forest_seed, forest_visibility)"
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
  const visible = profile.forest_visibility !== "private";

  const summary = useQuery({
    queryKey: ["friend-forest-summary", profile.id],
    enabled: visible,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_visible_forest", { _owner_id: profile.id });
      if (error) {
        if (error.message?.includes("forest_not_visible")) return { count: 0, visible: false };
        throw error;
      }
      const rows = (data ?? []) as unknown[];
      return { count: rows.length, visible: true };
    },
    retry: false,
  });

  const canVisit = summary.data?.visible !== false && visible;
  const seed = profile.forest_seed ? Number(profile.forest_seed) % 2147483647 : 1;

  const Wrapper: React.ElementType = canVisit ? "button" : "div";

  return (
    <Wrapper
      onClick={canVisit ? () => navigate({ to: "/forest/$ownerId", params: { ownerId: profile.id } }) : undefined}
      aria-label={canVisit ? `Visit ${profile.display_name ?? "friend"}'s forest` : undefined}
      className={`grove-card block w-full overflow-hidden p-0 text-left ${canVisit ? "transition-transform active:scale-[0.995]" : "opacity-90"}`}
    >
      <div className="flex items-center gap-3 px-4 pt-4">
        <ProfileAvatar url={profile.avatar_url} name={profile.display_name ?? "?"} />
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium text-forest">
            {profile.display_name || "Growve member"}
          </p>
          <p className="truncate text-xs text-muted-foreground">
            {!visible ? (
              <span className="inline-flex items-center gap-1"><Lock className="h-3 w-3" /> Forest is private</span>
            ) : summary.isLoading ? (
              "…"
            ) : summary.data?.visible === false ? (
              <span className="inline-flex items-center gap-1"><Lock className="h-3 w-3" /> Forest unavailable</span>
            ) : (
              <>{summary.data?.count ?? 0} trees · Visit forest</>
            )}
          </p>
        </div>
      </div>
      <div className="mt-3">
        {canVisit ? (
          <ForestMiniPreview
            count={summary.data?.count ?? 0}
            seed={seed}
            height={120}
            emptyLabel="A young forest, still taking root."
            className="rounded-none border-t border-border bg-gradient-to-b from-mist to-parchment"
          />
        ) : (
          <div className="grid h-[120px] place-items-center border-t border-border bg-mist/50 text-sm text-muted-foreground">
            <span className="inline-flex items-center gap-2"><Lock className="h-4 w-4" /> Private grove</span>
          </div>
        )}
      </div>
    </Wrapper>
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

// Silence unused-import warnings while keeping api surface stable
void useQueries;
