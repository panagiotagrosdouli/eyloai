import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
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

export const AuthProvider = ({ children }) => {
  const [state, setState] = useState(loadingState);
  // Every auth event invalidates older manual refresh results as well as bootstrap results.
  const authVersion = useRef(0);

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
    // The first session lookup and auth subscription race during startup. An
    // auth event is newer than that lookup, so never let a late initial
    // response overwrite a sign-in, refresh, or sign-out event.
    let authEventVersion = 0;
    const setAnonymous = () => {
      if (!mounted) return;
      authVersion.current += 1;
      authEventVersion += 1;
      setState({ status: 'anonymous', user: null, session: null, error: null });
    };

    window.addEventListener(AUTH_REQUIRED_EVENT, setAnonymous);

    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      if (!mounted) return;
      // INITIAL_SESSION reads persisted browser storage, not verified account
      // state. Keep protected routes closed until getSession validates it.
      // Do not suppress the in-flight validation by counting this as a newer event.
      if (event === 'INITIAL_SESSION') {
        if (!session) setAnonymous();
        return;
      }
      authEventVersion += 1;
      authVersion.current += 1;

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

    getSession().then((result) => {
      if (!mounted || authEventVersion > 0) return;

      if (!result.ok) {
        setState({ status: 'error', user: null, session: null, error: result.error });
        return;
      }

      const session = result.data;
      setState(session
        ? { status: 'authenticated', user: session.user, session, error: null }
        : { status: 'anonymous', user: null, session: null, error: null });
    }).catch((error) => {
      if (!mounted || authEventVersion > 0) return;
      setState({ status: 'error', user: null, session: null, error: mapSupabaseError(error) });
    });

    return () => {
      mounted = false;
      window.removeEventListener(AUTH_REQUIRED_EVENT, setAnonymous);
      listener.subscription.unsubscribe();
    };
  }, []);

  const refreshSession = async () => {
    const startedAtVersion = authVersion.current;
    setState((current) => ({ ...current, status: 'loading', error: null }));
    const result = await refreshAuthSession();

    // SIGNED_IN, SIGNED_OUT and TOKEN_REFRESHED events are authoritative. A late
    // manual refresh must not overwrite a newer event (especially sign-out).
    if (authVersion.current !== startedAtVersion) return result;

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
