import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ForestExperience } from "@/features/forest";

export const Route = createFileRoute("/_authenticated/forest/$ownerId")({
  head: () => ({ meta: [{ title: "A friend's forest — Growve" }] }),
  component: VisitForestPage,
});

function VisitForestPage() {
  const { ownerId } = Route.useParams();
  const navigate = useNavigate();
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

  if (profileQ.isLoading) {
    return (
      <div className="fixed inset-0 z-40 grid place-items-center bg-[#dde3da]">
        <div className="h-2 w-24 animate-pulse rounded-full bg-sage/60" />
      </div>
    );
  }

  return (
    <ForestExperience
      ownerId={ownerId}
      ownerLabel={label}
      startInWalkMode
      onExit={() => navigate({ to: "/friends" })}
    />
  );
}
