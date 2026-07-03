import { createFileRoute, Navigate, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { lovable } from "@/integrations/lovable";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/auth")({
  head: () => ({ meta: [{ title: "Sign in — Growve" }] }),
  component: AuthPage,
});

function AuthPage() {
  const { session, loading } = useAuth();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);

  if (loading) return null;
  if (session) return <Navigate to="/today" replace />;

  async function handleGoogle() {
    setBusy(true);
    try {
      const res = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: window.location.origin,
      });
      if (res.error) {
        toast.error("Couldn't sign in with Google. Please try again.");
        setBusy(false);
        return;
      }
      if (res.redirected) return;
      navigate({ to: "/today" });
    } catch {
      toast.error("Something went wrong. Please try again.");
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-background px-5 pb-16 pt-24">
      <div className="mx-auto max-w-md text-center">
        <div className="mx-auto mb-6 grid h-20 w-20 place-items-center rounded-[2rem] bg-forest text-parchment shadow-soft">
          <Leaf />
        </div>
        <h1 className="font-display text-4xl text-forest">Growve</h1>
        <p className="mx-auto mt-3 max-w-xs text-sm text-muted-foreground">
          Quiet habits. A forest that remembers.
          <br />
          One small tree at a time.
        </p>

        <div className="grove-card mt-10 p-6">
          <Button
            onClick={handleGoogle}
            disabled={busy}
            className="w-full rounded-xl bg-forest text-parchment hover:bg-forest/90 min-h-[48px]"
          >
            {busy ? (
              <span className="inline-flex items-center gap-2">
                <span className="h-2 w-2 animate-pulse rounded-full bg-parchment/70" />
                Signing you in…
              </span>
            ) : (
              <span className="inline-flex items-center">
                <GoogleMark /> Continue with Google
              </span>
            )}
          </Button>

          <p className="mt-5 text-xs leading-relaxed text-muted-foreground">
            By continuing, you agree to our gentle handling of your data. We only
            use your Google name and avatar to identify your forest.
          </p>
        </div>
      </div>
    </div>
  );
}

function Leaf() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-9 w-9"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M5 19c10 0 14-6 14-14C9 5 5 11 5 19z" />
      <path d="M5 19c4-6 8-9 12-11" />
    </svg>
  );
}
function GoogleMark() {
  return (
    <svg viewBox="0 0 24 24" className="mr-2 h-4 w-4" aria-hidden>
      <path fill="#4285F4" d="M22.5 12.27c0-.79-.07-1.55-.2-2.27H12v4.3h5.9c-.25 1.37-1.02 2.53-2.18 3.31v2.75h3.52c2.06-1.9 3.26-4.7 3.26-8.09z" />
      <path fill="#34A853" d="M12 23c2.94 0 5.4-.98 7.2-2.64l-3.52-2.75c-.98.66-2.23 1.04-3.68 1.04-2.83 0-5.23-1.91-6.09-4.48H2.27v2.81C4.06 20.53 7.77 23 12 23z" />
      <path fill="#FBBC05" d="M5.91 14.17A6.6 6.6 0 0 1 5.55 12c0-.75.13-1.49.36-2.17V7.02H2.27A11 11 0 0 0 1 12c0 1.78.42 3.46 1.27 4.98l3.64-2.81z" />
      <path fill="#EA4335" d="M12 5.36c1.6 0 3.03.55 4.16 1.62l3.12-3.12C17.4 2.01 14.94 1 12 1 7.77 1 4.06 3.47 2.27 7.02l3.64 2.81C6.77 7.27 9.17 5.36 12 5.36z" />
    </svg>
  );
}
