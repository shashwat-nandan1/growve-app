import { createFileRoute, Outlet, Navigate } from "@tanstack/react-router";
import { useEffect, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  component: AuthGate,
});

function AuthGate() {
  const { session, loading, user, invalidateSessionAndRedirectToAuth } = useAuth();
  const qc = useQueryClient();
  const tzSyncedRef = useRef<string | null>(null);

  // Fetch profile — self-heal via ensure_profile RPC when missing.
  const profile = useQuery({
    queryKey: ["profile", user?.id],
    enabled: !!user,
    retry: 1,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user!.id)
        .maybeSingle();
      if (error) throw error;
      if (data) return data;
      // Missing profile — call idempotent bootstrap.
      const { data: created, error: rpcErr } = await supabase.rpc("ensure_profile");
      if (rpcErr) throw rpcErr;
      return created as typeof data;
    },
  });

  // Silently sync device timezone to profile when it differs.
  useEffect(() => {
    if (!user || !profile.data) return;
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
  }, [user, profile.data, qc]);

  if (loading || (session && profile.isLoading)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-2 w-24 animate-pulse rounded-full bg-sage/40" />
      </div>
    );
  }
  if (!session) return <Navigate to="/auth" replace />;

  // If profile bootstrap failed definitively, clear session.
  if (profile.isError || !profile.data) {
    invalidateSessionAndRedirectToAuth();
    return null;
  }

  const path = typeof window !== "undefined" ? window.location.pathname : "";
  const needsOnboarding = !profile.data.onboarding_completed_at;
  if (needsOnboarding && !path.startsWith("/onboarding")) {
    return <Navigate to="/onboarding" replace />;
  }
  if (!needsOnboarding && path.startsWith("/onboarding")) {
    return <Navigate to="/today" replace />;
  }

  return <Outlet />;
}
