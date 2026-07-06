import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type AuthStatus =
  | "initializing"
  | "authenticated"
  | "unauthenticated"
  | "recoverable_error"
  | "error";

type AuthCtx = {
  session: Session | null;
  user: User | null;
  status: AuthStatus;
  /** Retry after a recoverable (network) error. */
  retryAuthentication: () => Promise<void>;
  /** Sign the user out cleanly and redirect to /auth. */
  signOut: () => Promise<void>;
  /** Force session invalidation (e.g. deleted user / bad token) and redirect. */
  invalidateSession: () => Promise<void>;
  /** Back-compat alias — some legacy callers use this name. */
  invalidateSessionAndRedirectToAuth: () => Promise<void>;
  /** Back-compat: legacy `loading` boolean. True while initializing. */
  loading: boolean;
};

const noop = async () => {};

const Ctx = createContext<AuthCtx>({
  session: null,
  user: null,
  status: "initializing",
  retryAuthentication: noop,
  signOut: noop,
  invalidateSession: noop,
  invalidateSessionAndRedirectToAuth: noop,
  loading: true,
});

const INVALID_AUTH_HINTS = [
  "user_not_found",
  "invalid jwt",
  "invalid refresh token",
  "jwt expired",
  "refresh_token_not_found",
  "bad_jwt",
  "user not found",
];

function isInvalidAuthError(err: { message?: string; status?: number } | null | undefined): boolean {
  if (!err) return false;
  if (err.status === 401 || err.status === 403) return true;
  const msg = (err.message || "").toLowerCase();
  return INVALID_AUTH_HINTS.some((h) => msg.includes(h));
}

/** Distinguishes "the network is down" from "the auth server rejected us". */
function isNetworkError(err: unknown): boolean {
  if (!err) return false;
  if (typeof err === "object" && err !== null) {
    const anyErr = err as { message?: string; name?: string };
    const msg = (anyErr.message || "").toLowerCase();
    if (anyErr.name === "TypeError" && msg.includes("fetch")) return true;
    if (msg.includes("network") || msg.includes("fetch failed") || msg.includes("failed to fetch")) return true;
  }
  return false;
}

const BOOTSTRAP_TIMEOUT_MS = 8000;

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error("auth_bootstrap_timeout")), ms);
    p.then((v) => { clearTimeout(t); resolve(v); })
     .catch((e) => { clearTimeout(t); reject(e); });
  });
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient();
  const [session, setSession] = useState<Session | null>(null);
  const [status, setStatus] = useState<AuthStatus>("initializing");
  const lastValidatedRef = useRef(0);
  const bootstrappedRef = useRef(false);

  const clearLocalAuthState = useCallback(async () => {
    try { await qc.cancelQueries(); } catch { /* noop */ }
    qc.clear();
    try { await supabase.auth.signOut(); } catch { /* noop */ }
    // Best-effort forest state reset (dynamic to avoid a hard import cycle at load time).
    try {
      const [storeMod, audioMod] = await Promise.all([
        import("@/features/forest/store"),
        import("@/features/forest/audio"),
      ]);
      storeMod.useForestStore.getState().setSelected(null);
      storeMod.useForestStore.getState().setMode("overview");
      audioMod.forestAudio.dispose();
    } catch { /* noop */ }
  }, [qc]);

  const redirectToAuth = useCallback(() => {
    if (typeof window === "undefined") return;
    if (window.location.pathname === "/auth") return;
    window.location.replace("/auth");
  }, []);

  const invalidateSession = useCallback(async () => {
    await clearLocalAuthState();
    setSession(null);
    setStatus("unauthenticated");
    redirectToAuth();
  }, [clearLocalAuthState, redirectToAuth]);

  const signOut = useCallback(async () => {
    await clearLocalAuthState();
    setSession(null);
    setStatus("unauthenticated");
    redirectToAuth();
  }, [clearLocalAuthState, redirectToAuth]);

  const bootstrap = useCallback(async () => {
    setStatus("initializing");
    try {
      const sessionRes = await withTimeout(supabase.auth.getSession(), BOOTSTRAP_TIMEOUT_MS);
      const cachedSession = sessionRes.data.session;
      if (!cachedSession) {
        setSession(null);
        setStatus("unauthenticated");
        return;
      }
      // Validate against the Auth server.
      try {
        const userRes = await withTimeout(supabase.auth.getUser(), BOOTSTRAP_TIMEOUT_MS);
        if (userRes.data.user) {
          setSession(cachedSession);
          setStatus("authenticated");
          lastValidatedRef.current = Date.now();
          return;
        }
        if (isInvalidAuthError(userRes.error)) {
          await invalidateSession();
          return;
        }
        // Ambiguous — treat as recoverable.
        setSession(cachedSession);
        setStatus("recoverable_error");
      } catch (err) {
        if (isNetworkError(err)) {
          setSession(cachedSession);
          setStatus("recoverable_error");
          return;
        }
        // Unknown — do not delete a potentially valid session.
        setSession(cachedSession);
        setStatus("recoverable_error");
      }
    } catch (err) {
      if (isNetworkError(err) || (err instanceof Error && err.message === "auth_bootstrap_timeout")) {
        setStatus("recoverable_error");
        return;
      }
      setStatus("error");
    }
  }, [invalidateSession]);

  const retryAuthentication = useCallback(async () => {
    await bootstrap();
  }, [bootstrap]);

  // Bootstrap once + subscribe to auth state changes (single listener for the whole app).
  useEffect(() => {
    if (bootstrappedRef.current) return;
    bootstrappedRef.current = true;

    void bootstrap();

    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      if (event === "SIGNED_OUT") {
        setSession(null);
        setStatus("unauthenticated");
        // Cache clearing is handled by signOut(); if this fires from another tab
        // just make sure protected data is not left behind.
        try { qc.clear(); } catch { /* noop */ }
        return;
      }
      if (event === "TOKEN_REFRESHED" || event === "USER_UPDATED") {
        setSession(s);
        lastValidatedRef.current = Date.now();
        // No need to invalidate every query on a token refresh.
        return;
      }
      if (event === "SIGNED_IN") {
        setSession(s);
        setStatus("authenticated");
        lastValidatedRef.current = Date.now();
        return;
      }
      if (event === "INITIAL_SESSION") {
        // Bootstrap owns the initial handling; ignore here to avoid double work.
        return;
      }
    });

    return () => {
      sub.subscription.unsubscribe();
    };
  }, [bootstrap, qc]);

  // Revalidate at most every 5 minutes when the tab regains focus.
  useEffect(() => {
    if (typeof document === "undefined") return;
    const onVis = () => {
      if (document.visibilityState !== "visible") return;
      if (status !== "authenticated") return;
      if (Date.now() - lastValidatedRef.current < 5 * 60 * 1000) return;
      supabase.auth.getUser().then(({ data, error }) => {
        if (data?.user) {
          lastValidatedRef.current = Date.now();
          return;
        }
        if (isInvalidAuthError(error)) void invalidateSession();
      }).catch(() => { /* network — ignore */ });
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [status, invalidateSession]);

  return (
    <Ctx.Provider
      value={{
        session,
        user: session?.user ?? null,
        status,
        retryAuthentication,
        signOut,
        invalidateSession,
        invalidateSessionAndRedirectToAuth: invalidateSession,
        loading: status === "initializing",
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

export const useAuth = () => useContext(Ctx);
