import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { isSupabaseConfigured, supabase } from '@/lib/supabaseClient';
import {
  getSession,
  refreshSession as refreshAuthSession,
  resetPassword as requestPasswordReset,
  signIn as signInWithPassword,
  signInWithGoogle as startGoogleSignIn,
  signOut as signOutSession,
  signUp as registerWithPassword,
  updatePassword as updateAccountPassword,
} from '@/lib/supabase/auth';
import { AppErrorCode, createAppError, mapSupabaseError } from '@/lib/supabase/errors';

const AuthContext = createContext(null);

const loadingState = { status: 'loading', user: null, session: null, error: null };

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

    getSession().then((result) => {
      if (!mounted) return;

      if (!result.ok) {
        setState({ status: 'error', user: null, session: null, error: result.error });
        return;
      }

      const session = result.data;
      setState(session
        ? { status: 'authenticated', user: session.user, session, error: null }
        : { status: 'anonymous', user: null, session: null, error: null });
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return;
      setState(session
        ? { status: 'authenticated', user: session.user, session, error: null }
        : { status: 'anonymous', user: null, session: null, error: null });
    });

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  const refreshSession = async () => {
    setState((current) => ({ ...current, status: 'loading', error: null }));
    const result = await refreshAuthSession();

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
  const signInWithGoogle = async (redirectTo) => startGoogleSignIn(redirectTo);
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
      if (result.ok && shouldRedirect) window.location.assign('/login');
      return result;
    },
    checkUserAuth: refreshSession,
    checkAppState: refreshSession,
    navigateToLogin: () => {
      const returnTo = `${window.location.pathname}${window.location.search}${window.location.hash}`;
      const loginUrl = returnTo && returnTo !== '/login'
        ? `/login?from=${encodeURIComponent(returnTo)}`
        : '/login';
      window.location.assign(loginUrl);
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
