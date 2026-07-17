import React from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';

export default function ProtectedRoute() {
  const { user, isLoadingAuth } = useAuth();
  const location = useLocation();

  if (isLoadingAuth) return null;
  if (user) return <Outlet />;

  const requestedPath = `${location.pathname}${location.search}${location.hash}`;

  return (
    <Navigate
      to={`/login?from=${encodeURIComponent(requestedPath)}`}
      replace
      state={{ from: location }}
    />
  );
}
