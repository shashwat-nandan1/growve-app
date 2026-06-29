import { createFileRoute, Outlet, Navigate } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";
import { useProfile } from "@/hooks/useProfile";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  component: AuthGate,
});

function AuthGate() {
  const { session, loading } = useAuth();
  const profile = useProfile();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-2 w-24 animate-pulse rounded-full bg-sage/40" />
      </div>
    );
  }
  if (!session) return <Navigate to="/auth" replace />;

  // Wait for profile then check username
  if (profile.isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-2 w-24 animate-pulse rounded-full bg-sage/40" />
      </div>
    );
  }
  const needsOnboarding = !profile.data?.username;
  if (needsOnboarding && typeof window !== "undefined" && !window.location.pathname.startsWith("/onboarding")) {
    return <Navigate to="/onboarding" replace />;
  }

  return <Outlet />;
}
