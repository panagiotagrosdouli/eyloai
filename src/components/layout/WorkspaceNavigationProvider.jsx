import React, { createContext, useContext, useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import { advanceWorkspaceTrail } from '@/lib/navigation/workspace-navigation.mjs';

// This context stays mounted across public Discover and private Workspace routes.
// It retains only recent in-app URLs in memory, never localStorage or a server.
const PreviousWorkspacePage = createContext(null);
export function WorkspaceNavigationProvider({ children }) {
  const { pathname, search } = useLocation();
  const { user } = useAuth();
  const owner = user?.id ?? null;
  const href = pathname + search;
  const [state, setState] = useState({ owner: null, trail: [] });

  useEffect(() => {
    setState(current => {
      if (!owner) return current.owner === null && current.trail.length === 0
        ? current : { owner: null, trail: [] };
      const trail = current.owner === owner ? current.trail : [];
      const next = advanceWorkspaceTrail(trail, href);
      if (current.owner === owner
        && next.length === trail.length
        && next.every((item, index) => item === trail[index])) return current;
      return { owner, trail: next };
    });
  }, [href, owner]);

  // Invalidate the previous account's history synchronously on account switch.
  // If the route changed but the effect has not run yet, use the safe fallback.
  const previousHref = state.owner === owner && state.trail.at(-1) === href
    ? state.trail.at(-2) ?? null : null;
  return (
    <PreviousWorkspacePage.Provider value={previousHref}>
      {children}
    </PreviousWorkspacePage.Provider>
  );
}
export const useWorkspacePreviousHref = () => useContext(PreviousWorkspacePage);
