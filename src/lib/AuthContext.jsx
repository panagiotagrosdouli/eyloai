import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { appPath, stripAppBase } from '@/lib/auth/routePaths';
import { environment } from '@/lib/config/env';
import { shouldApplyAuthResult } from '@/lib/auth/authOperation';
import { shouldClearPrivateCache } from '@/lib/auth/privateSessionBoundary';
import { bindRadarBrowserCache, clearRadarBrowserCache } from '@/lib/auth/privateRadarCache.mjs';
import { queryClientInstance } from '@/lib/query-client';
import { AppErrorCode, createAppError, mapSupabaseError } from '@/lib/supabase/errors';

const AuthContext = createContext(null);

function clearPrivateSessionData() {
  queryClientInstance.clear();
  try {
    clearRadarBrowserCache(window.localStorage);
  } catch {
    // Restricted browser storage should not block signing out.
  }
  try {
    window.sessionStorage.removeItem('eyra_command_conversation');
    window.sessionStorage.removeItem('eyra_command_conversation_v2');
  } catch {
    // Some browsers restrict storage access.
  }
}

function setPrivateRadarCacheOwner(userId) {
  try {
    bindRadarBrowserCache(window.localStorage, userId);
  } catch {
    // Browsers may disable localStorage; Supabase remains the source of truth.
  }
}

const idleState = { status: 'idle', user: null, session: null, error: null };
const SESSION_RESTORE_TIMEOUT_MS = 8000;
const AUTH_RUNTIME_LOAD_TIMEOUT_MS = 8000;

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
  const [state, setState] = useState(idleState);
  const runtimeRef = useRef(null);
  const runtimePromiseRef = useRef(null);
  const initializePromiseRef = useRef(null);
  const authEventVersionRef = useRef(0);
  const activeUserIdRef = useRef(null);
  const cleanupAuthRef = useRef(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      cleanupAuthRef.current?.();
      cleanupAuthRef.current = null;
    };
  }, []);

  const loadAuthRuntime = useCallback(async () => {
    if (!runtimeRef.current) {
      if (!runtimePromiseRef.current) {
        runtimePromiseRef.current = withTimeout(Promise.all([
          import('@/lib/supabaseClient'),
          import('@/lib/supabase/auth'),
        ]), AUTH_RUNTIME_LOAD_TIMEOUT_MS)
          .then(([clientModule, authModule]) => {
            runtimeRef.current = { clientModule, authModule };
            return runtimeRef.current;
          })
          .catch((error) => {
            runtimePromiseRef.current = null;
            throw error;
          });
      }
      await runtimePromiseRef.current;
    }

    const runtime = runtimeRef.current;
    const client = runtime.clientModule.supabase;
    if (client && !cleanupAuthRef.current) {
      const setAnonymous = () => {
        if (!mountedRef.current) return;
        authEventVersionRef.current += 1;
        activeUserIdRef.current = null;
        clearPrivateSessionData();
        setState({ status: 'anonymous', user: null, session: null, error: null });
      };

      window.addEventListener(runtime.clientModule.AUTH_REQUIRED_EVENT, setAnonymous);
      const { data: listener } = client.auth.onAuthStateChange((event, session) => {
        if (!mountedRef.current || event === 'INITIAL_SESSION') return;
        authEventVersionRef.current += 1;

        const nextUserId = session?.user?.id ?? null;
        if (shouldClearPrivateCache(activeUserIdRef.current, nextUserId, event)) {
          clearPrivateSessionData();
        }
        activeUserIdRef.current = nextUserId;
        setPrivateRadarCacheOwner(nextUserId);

        setState(session
          ? { status: 'authenticated', user: session.user, session, error: null }
          : { status: 'anonymous', user: null, session: null, error: null });
      });

      cleanupAuthRef.current = () => {
        window.removeEventListener(runtime.clientModule.AUTH_REQUIRED_EVENT, setAnonymous);
        listener.subscription.unsubscribe();
      };
    }

    return runtime;
  }, []);

  const initializeAuth = useCallback(async () => {
    if (state.status === 'authenticated' || state.status === 'anonymous') {
      return { ok: true, data: state.session };
    }
    if (initializePromiseRef.current) return initializePromiseRef.current;

    setState((current) => ({ ...current, status: 'loading', error: null }));
    const initialization = (async () => {
      const initializationVersion = authEventVersionRef.current;
      try {
        const runtime = await loadAuthRuntime();
        if (!runtime.clientModule.isSupabaseConfigured || !runtime.clientModule.supabase) {
          const error = createAppError(AppErrorCode.CONFIGURATION);
          if (mountedRef.current) {
            setState({ status: 'configuration-error', user: null, session: null, error });
          }
          return { ok: false, error };
        }

        const startupVersion = authEventVersionRef.current;
        const result = await withTimeout(runtime.authModule.getSession(), SESSION_RESTORE_TIMEOUT_MS);
        if (!mountedRef.current || authEventVersionRef.current !== startupVersion) return result;

        if (!result.ok) {
          setState({ status: 'error', user: null, session: null, error: result.error });
          return result;
        }

        const session = result.data;
        const nextUserId = session?.user?.id ?? null;
        if (shouldClearPrivateCache(activeUserIdRef.current, nextUserId, 'SESSION_RESTORED')) {
          clearPrivateSessionData();
        }
        activeUserIdRef.current = nextUserId;
        setPrivateRadarCacheOwner(nextUserId);
        setState(session
          ? { status: 'authenticated', user: session.user, session, error: null }
          : { status: 'anonymous', user: null, session: null, error: null });
        return result;
      } catch (error) {
        const appError = createAppError(AppErrorCode.NETWORK, error);
        // A late bootstrap timeout cannot invalidate a newer sign-in/auth event.
        if (shouldApplyAuthResult(initializationVersion, authEventVersionRef.current, mountedRef.current)) {
          setState({ status: 'error', user: null, session: null, error: appError });
        }
        return { ok: false, error: appError };
      } finally {
        initializePromiseRef.current = null;
      }
    })();

    initializePromiseRef.current = initialization;
    return initialization;
  }, [loadAuthRuntime, state.session, state.status]);

  const signIn = async (email, password) => {
    const operationVersion = authEventVersionRef.current;
    const runtime = await loadAuthRuntime();
    const result = await runtime.authModule.signIn(email, password);
    if (!shouldApplyAuthResult(operationVersion, authEventVersionRef.current, mountedRef.current)) return result;
    if (result.ok && result.data?.session) {
      const session = result.data.session;
      setPrivateRadarCacheOwner(session.user.id);
      setState({ status: 'authenticated', user: session.user, session, error: null });
    }
    return result;
  };

  const signUp = async (email, password, metadata) => {
    const operationVersion = authEventVersionRef.current;
    const runtime = await loadAuthRuntime();
    const result = await runtime.authModule.signUp(email, password, metadata);
    if (!shouldApplyAuthResult(operationVersion, authEventVersionRef.current, mountedRef.current)) return result;
    if (result.ok && result.data?.session) {
      const session = result.data.session;
      setPrivateRadarCacheOwner(session.user.id);
      setState({ status: 'authenticated', user: session.user, session, error: null });
    }
    return result;
  };

  const signInWithProvider = async (provider, redirectTo) => {
    const runtime = await loadAuthRuntime();
    return runtime.authModule.signInWithOAuth(provider, redirectTo);
  };
  const signInWithGoogle = async (redirectTo) => signInWithProvider('google', redirectTo);
  const signInWithMagicLink = async (email, redirectTo) => {
    const runtime = await loadAuthRuntime();
    return runtime.authModule.signInWithMagicLink(email, redirectTo);
  };
  const resetPassword = async (email, redirectTo) => {
    const runtime = await loadAuthRuntime();
    return runtime.authModule.resetPassword(email, redirectTo);
  };
  const updatePassword = async (password) => {
    const runtime = await loadAuthRuntime();
    return runtime.authModule.updatePassword(password);
  };

  const refreshSession = async () => {
    // A retry from the failed bootstrap screen should make one validated
    // session request. Only explicitly refresh when a session is already live.
    if (state.status !== 'authenticated') return initializeAuth();

    const refreshVersion = authEventVersionRef.current;
    setState((current) => ({ ...current, status: 'loading', error: null }));
    try {
      const runtime = await loadAuthRuntime();
      const result = await withTimeout(runtime.authModule.refreshSession(), SESSION_RESTORE_TIMEOUT_MS);
      // Auth events from other tabs or a local sign-out must win over an older refresh.
      if (!shouldApplyAuthResult(refreshVersion, authEventVersionRef.current, mountedRef.current)) return result;
      if (!result.ok) {
        setState({ status: 'error', user: null, session: null, error: result.error });
        return result;
      }

      const session = result.data;
      setPrivateRadarCacheOwner(session?.user?.id ?? null);
      setState(session
        ? { status: 'authenticated', user: session.user, session, error: null }
        : { status: 'anonymous', user: null, session: null, error: null });
      return result;
    } catch (error) {
      const appError = createAppError(AppErrorCode.NETWORK, error);
      if (shouldApplyAuthResult(refreshVersion, authEventVersionRef.current, mountedRef.current)) {
        setState({ status: 'error', user: null, session: null, error: appError });
      }
      return { ok: false, error: appError };
    }
  };

  const signOut = async () => {
    const operationVersion = authEventVersionRef.current;
    try {
      const runtime = await loadAuthRuntime();
      const result = await runtime.authModule.signOut();
      if (!shouldApplyAuthResult(operationVersion, authEventVersionRef.current, mountedRef.current)) return result;
      if (result.ok) {
        activeUserIdRef.current = null;
        clearPrivateSessionData();
        setState({ status: 'anonymous', user: null, session: null, error: null });
      } else {
        setState((current) => ({ ...current, error: result.error }));
      }
      return result;
    } catch (error) {
      const appError = createAppError(AppErrorCode.NETWORK, error);
      if (shouldApplyAuthResult(operationVersion, authEventVersionRef.current, mountedRef.current)) {
        setState((current) => ({ ...current, error: appError }));
      }
      return { ok: false, error: appError };
    }
  };

  const value = useMemo(() => ({
    user: state.user,
    session: state.session,
    status: state.status,
    error: state.error,
    initializeAuth,
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
    isLoadingAuth: state.status === 'idle' || state.status === 'loading',
    isLoadingPublicSettings: false,
    authError: state.error
      ? { type: state.status === 'configuration-error' ? 'configuration_error' : 'auth_error', message: state.error.message }
      : null,
    authChecked: state.status !== 'idle' && state.status !== 'loading',
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
    isSupabaseConfigured: environment.ok,
    mapSupabaseError,
  }), [state, initializeAuth]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};
