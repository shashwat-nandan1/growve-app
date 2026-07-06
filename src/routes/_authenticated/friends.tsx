import { createFileRoute, Outlet } from "@tanstack/react-router";

// Layout route for /friends. Actual /friends page is friends.index.tsx.
export const Route = createFileRoute("/_authenticated/friends")({
  component: () => <Outlet />,
});
