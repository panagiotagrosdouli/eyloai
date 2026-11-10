import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { appPath, stripAppBase } from '@/lib/auth/routePaths';
import {
  AUTH_REQUIRED_EVENT,
  isSupabaseConfigured,
  supabase,
} from '@/lib/supabaseClient';
import {
  getSession,
  refreshSession as refreshAuthSession,
  resetPassword as requestPasswordReset,
  signIn as signInWithPassword,
  signInWithMagicLink as startMagicLinkSignIn,
  signInWithOAuth as startOAuthSignIn,
  signOut as signOutSession,
  signUp as registerWithPassword,
  updatePassword as updateAccountPassword,
} from '@/lib/supabase/auth';
import { AppErrorCode, createAppError, mapSupabaseError } from '@/lib/supabase/errors';

const AuthContext = createContext(null);

const loadingState = { status: 'loading', user: null, session: null, error: null };
const SESSION_RESTORE_TIMEOUT_MS = 8000;

function withTimeout(promise, timeoutMs) {
  let timeoutId;
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      timeoutId = window.setTimeout(() => reject(new Error('Authentication startup timed out.')), timeoutMs);
    }),
  ]).finally(() => window.clearTimeout(timeoutId));
}

export const AuthProvider = ({ children }) => {
  const [state, setState] = useState(loadingState);

  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) {
      setState({
        status: 'configuration-error',
        user: null,
        session: null,
        error: createAppError(AppErrorCode.CONFIGURATION),
      });
      return undefined;
    }

    let mounted = true;
    let authEventVersion = 0;
    const setAnonymous = () => {
      if (!mounted) return;
      authEventVersion += 1;
      setState({ status: 'anonymous', user: null, session: null, error: null });
    };

    window.addEventListener(AUTH_REQUIRED_EVENT, setAnonymous);

    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      if (!mounted) return;
      // INITIAL_SESSION may contain locally persisted data. Keep protected
      // routes gated until getUsableSession confirms it with Supabase.
      if (event === 'INITIAL_SESSION') return;
      authEventVersion += 1;

      if (event === 'SIGNED_IN' && typeof window !== 'undefined') {
        try {
          // Remove an old failed EYRA response so it is not shown again after
          // the user has renewed the secure session.
          window.sessionStorage.removeItem('eyra_command_conversation');
          window.sessionStorage.removeItem('eyra_command_conversation_v2');
        } catch {
          // Storage may be unavailable in privacy-restricted browsers.
        }
      }

      setState(session
        ? { status: 'authenticated', user: session.user, session, error: null }
        : { status: 'anonymous', user: null, session: null, error: null });
    });

    const startupVersion = authEventVersion;
    withTimeout(getSession(), SESSION_RESTORE_TIMEOUT_MS).then((result) => {
      if (!mounted || authEventVersion !== startupVersion) return;

      if (!result.ok) {
        setState({ status: 'error', user: null, session: null, error: result.error });
        return;
      }

      const session = result.data;
      setState(session
        ? { status: 'authenticated', user: session.user, session, error: null }
        : { status: 'anonymous', user: null, session: null, error: null });
    }).catch((error) => {
      if (!mounted || authEventVersion !== startupVersion) return;
      setState({
        status: 'error',
        user: null,
        session: null,
        error: createAppError(AppErrorCode.NETWORK, error),
      });
    });

    return () => {
      mounted = false;
      window.removeEventListener(AUTH_REQUIRED_EVENT, setAnonymous);
      listener.subscription.unsubscribe();
    };
  }, []);

  const refreshSession = async () => {
    setState((current) => ({ ...current, status: 'loading', error: null }));
    let result;
    try {
      result = await withTimeout(
        state.session ? refreshAuthSession() : getSession(),
        SESSION_RESTORE_TIMEOUT_MS,
      );
    } catch (error) {
      result = { ok: false, error: createAppError(AppErrorCode.NETWORK, error) };
    }

    if (!result.ok) {
      setState({ status: 'error', user: null, session: null, error: result.error });
      return result;
    }

    const session = result.data;
    setState(session
      ? { status: 'authenticated', user: session.user, session, error: null }
      : { status: 'anonymous', user: null, session: null, error: null });
    return result;
  };

  const signIn = async (email, password) => signInWithPassword(email, password);
  const signUp = async (email, password, metadata) => registerWithPassword(email, password, metadata);
  const signInWithProvider = async (provider, redirectTo) => startOAuthSignIn(provider, redirectTo);
  const signInWithGoogle = async (redirectTo) => signInWithProvider('google', redirectTo);
  const signInWithMagicLink = async (email, redirectTo) => startMagicLinkSignIn(email, redirectTo);
  const resetPassword = async (email, redirectTo) => requestPasswordReset(email, redirectTo);
  const updatePassword = async (password) => updateAccountPassword(password);

  const signOut = async () => {
    const result = await signOutSession();
    if (result.ok) {
      setState({ status: 'anonymous', user: null, session: null, error: null });
    } else {
      setState((current) => ({ ...current, status: 'error', error: result.error }));
    }
    return result;
  };

  const value = useMemo(() => ({
    user: state.user,
    session: state.session,
    status: state.status,
    error: state.error,
    signIn,
    signUp,
    signInWithGoogle,
    signInWithProvider,
    signInWithMagicLink,
    signOut,
    refreshSession,
    resetPassword,
    updatePassword,

    // Temporary compatibility aliases for remaining legacy consumers.
    isAuthenticated: state.status === 'authenticated',
    isLoadingAuth: state.status === 'loading',
    isLoadingPublicSettings: false,
    authError: state.error
      ? { type: state.status === 'configuration-error' ? 'configuration_error' : 'auth_error', message: state.error.message }
      : null,
    authChecked: state.status !== 'loading',
    logout: async (shouldRedirect = true) => {
      const result = await signOut();
      if (result.ok && shouldRedirect) window.location.assign(appPath('/login', import.meta.env.BASE_URL || '/'));
      return result;
    },
    checkUserAuth: refreshSession,
    checkAppState: refreshSession,
    navigateToLogin: () => {
      const baseUrl = import.meta.env.BASE_URL || '/';
      const currentPath = stripAppBase(window.location.pathname, baseUrl);
      const returnTo = `${currentPath}${window.location.search}${window.location.hash}`;
      const loginUrl = appPath('/login', baseUrl);
      const target = returnTo && returnTo !== '/login'
        ? `${loginUrl}?from=${encodeURIComponent(returnTo)}`
        : loginUrl;
      window.location.assign(target);
    },
    isSupabaseConfigured,
    mapSupabaseError,
  }), [state]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};
