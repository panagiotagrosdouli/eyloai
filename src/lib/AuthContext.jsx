import React, { createContext, useContext, useEffect, useState } from 'react';
import { isSupabaseConfigured, supabase } from '@/lib/supabaseClient';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [isLoadingPublicSettings, setIsLoadingPublicSettings] = useState(false);
  const [authError, setAuthError] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [appPublicSettings] = useState({ id: 'supabase', public_settings: {} });

  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) {
      setAuthError({
        type: 'configuration_error',
        message: 'Supabase authentication is not configured.',
      });
      setIsLoadingAuth(false);
      setAuthChecked(true);
      return undefined;
    }

    let mounted = true;

    supabase.auth.getSession().then(({ data, error }) => {
      if (!mounted) return;

      if (error) {
        setAuthError({ type: 'auth_error', message: error.message });
      }

      const sessionUser = data?.session?.user ?? null;
      setUser(sessionUser);
      setIsAuthenticated(Boolean(sessionUser));
      setIsLoadingAuth(false);
      setAuthChecked(true);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      const sessionUser = session?.user ?? null;
      setUser(sessionUser);
      setIsAuthenticated(Boolean(sessionUser));
      setIsLoadingAuth(false);
      setAuthChecked(true);
      setAuthError(null);
    });

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  const checkUserAuth = async () => {
    if (!supabase) return;

    setIsLoadingAuth(true);
    const { data, error } = await supabase.auth.getSession();
    const sessionUser = data?.session?.user ?? null;

    setUser(sessionUser);
    setIsAuthenticated(Boolean(sessionUser));
    setAuthError(error ? { type: 'auth_error', message: error.message } : null);
    setIsLoadingAuth(false);
    setAuthChecked(true);
  };

  const checkAppState = checkUserAuth;

  const logout = async (shouldRedirect = true) => {
    if (supabase) {
      await supabase.auth.signOut();
    }

    setUser(null);
    setIsAuthenticated(false);
    setAuthChecked(true);

    if (shouldRedirect) {
      window.location.assign('/login');
    }
  };

  const navigateToLogin = () => {
    const returnTo = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    const loginUrl = returnTo && returnTo !== '/login'
      ? `/login?from=${encodeURIComponent(returnTo)}`
      : '/login';
    window.location.assign(loginUrl);
  };

  return (
    <AuthContext.Provider value={{
      user,
      isAuthenticated,
      isLoadingAuth,
      isLoadingPublicSettings,
      authError,
      appPublicSettings,
      authChecked,
      logout,
      navigateToLogin,
      checkUserAuth,
      checkAppState,
      isSupabaseConfigured,
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
