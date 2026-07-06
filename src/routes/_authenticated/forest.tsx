import { createFileRoute, Outlet } from "@tanstack/react-router";

// Layout route for /forest. The signed-in user's forest is at forest.index.tsx,
// and a friend's forest is at forest.$ownerId.tsx.
export const Route = createFileRoute("/_authenticated/forest")({
  component: () => <Outlet />,
});
