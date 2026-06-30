import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { ForestExperience } from "@/features/forest";

export const Route = createFileRoute("/_authenticated/forest")({
  head: () => ({ meta: [{ title: "Your forest — Growve" }] }),
  component: ForestPage,
});

function ForestPage() {
  return (
    <AppShell>
      <header>
        <h1 className="font-display text-3xl text-forest">Your forest</h1>
        <p className="mt-1 text-sm text-muted-foreground">A living grove that grows with every tended habit.</p>
      </header>
      <div className="mt-6">
        <ForestExperience />
      </div>
    </AppShell>
  );
}
