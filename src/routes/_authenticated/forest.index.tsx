import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ForestExperience } from "@/features/forest";

export const Route = createFileRoute("/_authenticated/forest/")({
  head: () => ({ meta: [{ title: "Your forest — Growve" }] }),
  component: ForestPage,
});

function ForestPage() {
  const navigate = useNavigate();
  return (
    <ForestExperience
      startInWalkMode
      onExit={() => navigate({ to: "/today" })}
    />
  );
}
