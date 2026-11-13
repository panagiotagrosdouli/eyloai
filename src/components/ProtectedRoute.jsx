import React, { useEffect } from 'react';
import { Link, Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';

export default function ProtectedRoute() {
  const { user, status, isLoadingAuth, initializeAuth, refreshSession, authError } = useAuth();
  const location = useLocation();

  useEffect(() => {
    if (status === 'idle') void initializeAuth();
  }, [initializeAuth, status]);

  if (isLoadingAuth) {
    return (
      <main className="grid min-h-screen place-items-center bg-slate-950 px-6 text-center text-slate-100" aria-live="polite">
        <p>Restoring your secure workspace session…</p>
      </main>
    );
  }
  // Identity changes must discard page-local private state as well as caches.
  // Key by user ID so token refreshes preserve the same user's unsaved work.
  if (user) return <Outlet key={user.id} />;

  const requestedPath = `${location.pathname}${location.search}${location.hash}`;

  if (status === 'error' || status === 'configuration-error') {
    return (
      <main className="grid min-h-screen place-items-center bg-slate-950 px-6 text-center text-slate-100">
        <section className="max-w-md space-y-4" aria-labelledby="auth-restore-error">
          <h1 id="auth-restore-error" className="text-xl font-semibold">We couldn’t restore your session</h1>
          <p role="alert" className="text-sm text-slate-300">{authError?.message || 'The account service is unavailable. Retry or sign in again.'}</p>
          <div className="flex justify-center gap-3">
            <button type="button" className="rounded-lg bg-cyan-400 px-4 py-2 font-medium text-slate-950" onClick={refreshSession}>Retry</button>
            <Link className="rounded-lg border border-white/20 px-4 py-2" to={`/login?from=${encodeURIComponent(requestedPath)}`}>Sign in</Link>
          </div>
        </section>
      </main>
    );
  }

  return (
    <Navigate
      to={`/login?from=${encodeURIComponent(requestedPath)}`}
      replace
      state={{ from: location }}
    />
  );
}
