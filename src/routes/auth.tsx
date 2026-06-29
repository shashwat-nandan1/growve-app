import { createFileRoute, Navigate, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/auth")({
  head: () => ({ meta: [{ title: "Sign in — Growve" }] }),
  component: AuthPage,
});

const emailSchema = z.string().trim().email("Enter a valid email");
const passwordSchema = z.string().min(8, "At least 8 characters");

function AuthPage() {
  const { session, loading } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup" | "reset">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  if (loading) return null;
  if (session) return <Navigate to="/today" replace />;

  async function handleEmail(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const em = emailSchema.parse(email);
      if (mode === "reset") {
        const { error } = await supabase.auth.resetPasswordForEmail(em, {
          redirectTo: `${window.location.origin}/reset-password`,
        });
        if (error) throw error;
        toast.success("Check your email for a reset link.");
        setMode("signin");
        return;
      }
      const pw = passwordSchema.parse(password);
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email: em,
          password: pw,
          options: { emailRedirectTo: window.location.origin },
        });
        if (error) throw error;
        toast.success("Welcome to Growve. You're signed in.");
        navigate({ to: "/today" });
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email: em, password: pw });
        if (error) throw error;
        navigate({ to: "/today" });
      }
    } catch (err) {
      const msg = err instanceof z.ZodError ? err.issues[0]?.message : (err as Error).message;
      toast.error(msg || "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  async function handleGoogle() {
    setBusy(true);
    const res = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    if (res.error) {
      toast.error("Couldn't sign in with Google.");
      setBusy(false);
      return;
    }
    if (res.redirected) return;
    navigate({ to: "/today" });
  }

  return (
    <div className="min-h-screen bg-background px-5 pb-16 pt-16">
      <div className="mx-auto max-w-md">
        <div className="mb-10 text-center">
          <div className="mx-auto mb-5 grid h-16 w-16 place-items-center rounded-3xl bg-forest text-parchment shadow-soft">
            <Leaf />
          </div>
          <h1 className="font-display text-3xl text-forest">Growve</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Quiet habits. A forest that remembers.
          </p>
        </div>

        <div className="grove-card p-6">
          <form onSubmit={handleEmail} className="space-y-4">
            <div>
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="mt-1.5" />
            </div>
            {mode !== "reset" && (
              <div>
                <Label htmlFor="password">Password</Label>
                <Input id="password" type="password" autoComplete={mode === "signup" ? "new-password" : "current-password"} required value={password} onChange={(e) => setPassword(e.target.value)} className="mt-1.5" />
              </div>
            )}
            <Button type="submit" disabled={busy} className="w-full rounded-xl bg-forest text-parchment hover:bg-forest/90">
              {mode === "signup" ? "Plant my first seed" : mode === "reset" ? "Send reset link" : "Sign in"}
            </Button>
          </form>

          {mode !== "reset" && (
            <>
              <div className="my-5 flex items-center gap-3 text-xs uppercase tracking-wider text-muted-foreground">
                <div className="h-px flex-1 bg-border" /> or <div className="h-px flex-1 bg-border" />
              </div>
              <Button variant="outline" onClick={handleGoogle} disabled={busy} className="w-full rounded-xl border-border bg-card">
                <GoogleMark /> Continue with Google
              </Button>
            </>
          )}

          <div className="mt-6 space-y-2 text-center text-sm">
            {mode === "signin" && (
              <>
                <button className="text-moss hover:underline" onClick={() => setMode("signup")}>New here? Create an account</button>
                <div><button className="text-muted-foreground hover:underline" onClick={() => setMode("reset")}>Forgot password?</button></div>
              </>
            )}
            {mode === "signup" && (
              <button className="text-moss hover:underline" onClick={() => setMode("signin")}>Already have an account? Sign in</button>
            )}
            {mode === "reset" && (
              <button className="text-moss hover:underline" onClick={() => setMode("signin")}>Back to sign in</button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Leaf() {
  return (
    <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 19c10 0 14-6 14-14C9 5 5 11 5 19z" />
      <path d="M5 19c4-6 8-9 12-11" />
    </svg>
  );
}
function GoogleMark() {
  return (
    <svg viewBox="0 0 24 24" className="mr-2 h-4 w-4" aria-hidden>
      <path fill="#4285F4" d="M22.5 12.27c0-.79-.07-1.55-.2-2.27H12v4.3h5.9c-.25 1.37-1.02 2.53-2.18 3.31v2.75h3.52c2.06-1.9 3.26-4.7 3.26-8.09z"/>
      <path fill="#34A853" d="M12 23c2.94 0 5.4-.98 7.2-2.64l-3.52-2.75c-.98.66-2.23 1.04-3.68 1.04-2.83 0-5.23-1.91-6.09-4.48H2.27v2.81C4.06 20.53 7.77 23 12 23z"/>
      <path fill="#FBBC05" d="M5.91 14.17A6.6 6.6 0 0 1 5.55 12c0-.75.13-1.49.36-2.17V7.02H2.27A11 11 0 0 0 1 12c0 1.78.42 3.46 1.27 4.98l3.64-2.81z"/>
      <path fill="#EA4335" d="M12 5.36c1.6 0 3.03.55 4.16 1.62l3.12-3.12C17.4 2.01 14.94 1 12 1 7.77 1 4.06 3.47 2.27 7.02l3.64 2.81C6.77 7.27 9.17 5.36 12 5.36z"/>
    </svg>
  );
}
