import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import { advanceWorkspaceTrail } from '@/lib/navigation/workspace-navigation.mjs';

// This context stays mounted across public Discover and private Workspace routes.
// It retains only recent in-app URLs in memory, never localStorage or a server.
const PreviousWorkspacePage = createContext(null);
const FallbackBackAction = createContext(() => {});
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

  // A direct deep link has no in-app predecessor. If its "Back to parent"
  // link is clicked, discard the deep link before navigating. Otherwise Back
  // on the parent would point to the page the user was trying to leave.
  const discardDirectEntry = useCallback(() => {
    setState(current => {
      if (current.owner !== owner || current.trail.at(-1) !== href) return current;
      return { owner, trail: current.trail.slice(0, -1) };
    });
  }, [owner, href]);

  // Invalidate the previous account's history synchronously on account switch.
  // If the route changed but the effect has not run yet, use the safe fallback.
  const previousHref = state.owner === owner && state.trail.at(-1) === href
    ? state.trail.at(-2) ?? null : null;
  return (
    <PreviousWorkspacePage.Provider value={previousHref}>
      <FallbackBackAction.Provider value={discardDirectEntry}>
        {children}
      </FallbackBackAction.Provider>
    </PreviousWorkspacePage.Provider>
  );
}
export const useWorkspacePreviousHref = () => useContext(PreviousWorkspacePage);
export const useWorkspaceFallbackBack = () => useContext(FallbackBackAction);
