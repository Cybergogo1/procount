import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { Session, User } from '@supabase/supabase-js';

import { supabase } from '@/lib/supabase';

type AuthContextValue = {
  /** Null until the initial session has been resolved from storage. */
  session: Session | null;
  user: User | null;
  /** True while the persisted session is still being restored at startup. */
  initializing: boolean;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

/**
 * Resolves and tracks the Supabase auth session (brief Section 6). Exposes
 * `initializing` so the root layout can hold the splash until we know whether
 * the user is signed in, avoiding an auth-screen flash for returning users.
 *
 * Day-one users never see a login screen (client request): if there's no
 * stored session we transparently create an anonymous one, so the full backend
 * (storage, sync, export) works behind the scenes tied to that account. A real
 * login can later be layered on top by upgrading the anonymous user in place —
 * the groundwork for the enterprise/master-user roadmap.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [initializing, setInitializing] = useState(true);

  useEffect(() => {
    let mounted = true;

    const bootstrap = async () => {
      const { data } = await supabase.auth.getSession();
      if (!mounted) return;

      if (data.session) {
        setSession(data.session);
      } else {
        // No stored session — provision an invisible anonymous account so the
        // user drops straight into the app. onAuthStateChange delivers the new
        // session; we tolerate failure (e.g. offline) and retry on next launch.
        const { data: anon } = await supabase.auth.signInAnonymously();
        if (!mounted) return;
        setSession(anon.session ?? null);
      }
    };

    bootstrap()
      .catch(() => {
        // Swallow — a missing session just means the gate keeps showing splash;
        // the next launch (or reconnect) retries the anonymous sign-in.
      })
      .finally(() => {
        if (mounted) setInitializing(false);
      });

    const { data: subscription } = supabase.auth.onAuthStateChange(
      (_event, nextSession) => {
        setSession(nextSession);
      },
    );

    return () => {
      mounted = false;
      subscription.subscription.unsubscribe();
    };
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({ session, user: session?.user ?? null, initializing }),
    [session, initializing],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
}
