import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { ForestExperience } from "@/features/forest";

export const Route = createFileRoute("/_authenticated/forest/$ownerId")({
  head: () => ({ meta: [{ title: "A friend's forest — Growve" }] }),
  component: VisitForestPage,
});

function VisitForestPage() {
  const { ownerId } = Route.useParams();
  const profileQ = useQuery({
    queryKey: ["profile-by-id", ownerId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, display_name")
        .eq("id", ownerId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const label = profileQ.data?.display_name || "Friend";

  return (
    <AppShell>
      <Link to="/friends" className="inline-flex items-center gap-1 text-sm text-moss hover:underline">
        <ArrowLeft className="h-4 w-4" /> Friends
      </Link>
      <header className="mt-3">
        <h1 className="font-display text-3xl text-forest">{label}'s forest</h1>
        <p className="mt-1 text-sm text-muted-foreground">A quiet visit — walk softly and read the plaques.</p>
      </header>
      <div className="mt-6">
        {profileQ.isLoading ? (
          <div className="h-[360px] animate-pulse rounded-3xl bg-mist" />
        ) : profileQ.data ? (
          <ForestExperience ownerId={profileQ.data.id} ownerLabel={label} />
        ) : (
          <div className="grove-card p-8 text-center text-sm text-muted-foreground">
            This forest isn't available.
          </div>
        )}
      </div>
    </AppShell>
  );
}
