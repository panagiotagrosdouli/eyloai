import React from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';

export default function ProtectedRoute({ unauthenticatedElement }) {
  const { user, isLoadingAuth } = useAuth();
  const location = useLocation();

  if (isLoadingAuth) return null;
  if (user) return <Outlet />;

  return (
    unauthenticatedElement || (
      <Navigate to="/login" replace state={{ from: location }} />
    )
  );
}
