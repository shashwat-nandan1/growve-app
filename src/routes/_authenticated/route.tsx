import { createFileRoute, Outlet, Navigate, useLocation } from "@tanstack/react-router";
import { useEffect, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  component: AuthGate,
});

function AuthGate() {
  const { status, user, retryAuthentication, signOut } = useAuth();
  const qc = useQueryClient();
  const location = useLocation();
  const tzSyncedRef = useRef<string | null>(null);

  // Fetch profile — self-heal via ensure_profile RPC when missing.
  const profile = useQuery({
    queryKey: ["profile", user?.id],
    enabled: status === "authenticated" && !!user,
    retry: (failureCount, err) => {
      const msg = (err as Error)?.message?.toLowerCase() || "";
      if (msg.includes("jwt") || msg.includes("unauthorized")) return false;
      return failureCount < 2;
    },
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user!.id)
        .maybeSingle();
      if (error) throw error;
      if (data) return data;
      const { data: created, error: rpcErr } = await supabase.rpc("ensure_profile");
      if (rpcErr) throw rpcErr;
      return created as unknown as NonNullable<typeof data>;
    },
  });

  // Silently sync device timezone to profile when it differs — side effect in an effect, not render.
  useEffect(() => {
    if (status !== "authenticated" || !user || !profile.data) return;
    let tz = "UTC";
    try {
      const detected = Intl.DateTimeFormat().resolvedOptions().timeZone;
      if (detected && detected.length > 0) tz = detected;
    } catch { /* noop */ }
    if (tz === profile.data.timezone) return;
    if (tzSyncedRef.current === tz) return;
    tzSyncedRef.current = tz;
    supabase.from("profiles").update({ timezone: tz }).eq("id", user.id).then(() => {
      qc.invalidateQueries({ queryKey: ["profile"] });
      qc.invalidateQueries({ queryKey: ["logs-cycle"] });
    });
  }, [status, user, profile.data, qc]);

  if (status === "initializing") {
    return <LoadingScreen />;
  }

  if (status === "recoverable_error" || status === "error") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="max-w-md text-center">
          <h1 className="font-display text-2xl text-forest">A breeze blew us off course</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            We couldn't confirm your session. Check your connection and try again.
          </p>
          <div className="mt-6 flex justify-center gap-2">
            <Button
              onClick={() => { void retryAuthentication(); }}
              className="rounded-xl bg-forest text-parchment hover:bg-forest/90"
            >
              Retry
            </Button>
            <Button variant="ghost" onClick={() => { void signOut(); }}>Sign out</Button>
          </div>
        </div>
      </div>
    );
  }

  if (status === "unauthenticated") {
    return <Navigate to="/auth" replace />;
  }

  // Authenticated below here.
  if (profile.isLoading) return <LoadingScreen />;

  if (profile.isError || !profile.data) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="max-w-md text-center">
          <h1 className="font-display text-2xl text-forest">Your profile is being prepared</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Something interrupted setup. Try again or sign out and back in.
          </p>
          <div className="mt-6 flex justify-center gap-2">
            <Button
              onClick={() => qc.invalidateQueries({ queryKey: ["profile"] })}
              className="rounded-xl bg-forest text-parchment hover:bg-forest/90"
            >
              Retry
            </Button>
            <Button variant="ghost" onClick={() => { void signOut(); }}>Sign out</Button>
          </div>
        </div>
      </div>
    );
  }

  const path = location.pathname;
  const needsOnboarding = !profile.data.onboarding_completed_at;
  if (needsOnboarding && !path.startsWith("/onboarding")) {
    return <Navigate to="/onboarding" replace />;
  }
  if (!needsOnboarding && path.startsWith("/onboarding")) {
    return <Navigate to="/today" replace />;
  }

  return <Outlet />;
}

function LoadingScreen() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="h-2 w-24 animate-pulse rounded-full bg-sage/40" />
    </div>
  );
}
