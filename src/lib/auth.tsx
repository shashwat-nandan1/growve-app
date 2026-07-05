import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

type AuthCtx = {
  session: Session | null;
  user: User | null;
  loading: boolean;
  invalidateSessionAndRedirectToAuth: () => Promise<void>;
};

const Ctx = createContext<AuthCtx>({
  session: null,
  user: null,
  loading: true,
  invalidateSessionAndRedirectToAuth: async () => {},
});

const INVALID_AUTH_HINTS = [
  "user_not_found",
  "invalid jwt",
  "invalid refresh token",
  "jwt expired",
  "refresh_token_not_found",
  "bad_jwt",
];

function looksLikeInvalidSession(err: { message?: string; status?: number } | null | undefined) {
  if (!err) return false;
  const msg = (err.message || "").toLowerCase();
  if (err.status === 401 || err.status === 403) return true;
  return INVALID_AUTH_HINTS.some((h) => msg.includes(h));
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient();
  const [session, setSession] = useState<Session | null>(null);
  const [validated, setValidated] = useState(false);
  const lastCheckRef = useRef(0);

  async function invalidateSessionAndRedirectToAuth() {
    try { await qc.cancelQueries(); } catch { /* noop */ }
    qc.clear();
    try { await supabase.auth.signOut(); } catch { /* noop */ }
    setSession(null);
    setValidated(true);
    if (typeof window !== "undefined" && window.location.pathname !== "/auth") {
      window.location.replace("/auth");
    }
  }

  async function revalidate() {
    lastCheckRef.current = Date.now();
    const { data, error } = await supabase.auth.getUser();
    if (looksLikeInvalidSession(error) || !data?.user) {
      if (error && !looksLikeInvalidSession(error) && data?.user) return;
      // No user or invalid — clear.
      if (!data?.user || looksLikeInvalidSession(error)) {
        await invalidateSessionAndRedirectToAuth();
      }
    }
  }

  useEffect(() => {
    let cancelled = false;

    const { data: sub } = supabase.auth.onAuthStateChange(async (event, s) => {
      setSession(s);
      if (event === "SIGNED_OUT") {
        setValidated(true);
        return;
      }
      if (s) {
        // Validate the token against the Auth server.
        const { data, error } = await supabase.auth.getUser();
        if (cancelled) return;
        if (!data?.user || looksLikeInvalidSession(error)) {
          await invalidateSessionAndRedirectToAuth();
          return;
        }
        lastCheckRef.current = Date.now();
      }
      setValidated(true);
    });

    (async () => {
      const { data } = await supabase.auth.getSession();
      if (cancelled) return;
      setSession(data.session);
      if (!data.session) {
        setValidated(true);
        return;
      }
      const { data: u, error } = await supabase.auth.getUser();
      if (cancelled) return;
      if (!u?.user || looksLikeInvalidSession(error)) {
        await invalidateSessionAndRedirectToAuth();
        return;
      }
      lastCheckRef.current = Date.now();
      setValidated(true);
    })();

    const onVisibility = () => {
      if (document.visibilityState !== "visible") return;
      if (!session) return;
      // Revalidate at most every 5 minutes when tab becomes active.
      if (Date.now() - lastCheckRef.current < 5 * 60 * 1000) return;
      revalidate();
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
      document.removeEventListener("visibilitychange", onVisibility);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Ctx.Provider
      value={{
        session,
        user: session?.user ?? null,
        loading: !validated,
        invalidateSessionAndRedirectToAuth,
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

export const useAuth = () => useContext(Ctx);
