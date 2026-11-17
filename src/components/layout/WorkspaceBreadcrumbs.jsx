import React, { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';
import { advanceWorkspaceTrail, getWorkspaceNavigation } from '@/lib/navigation/workspace-navigation.mjs';

// Account-scoped, in-memory history. Direct links have a safe parent fallback.
export default function WorkspaceBreadcrumbs() {
  const { pathname, search } = useLocation();
  const { user } = useAuth();
  const ownerRef = useRef(user?.id ?? null);
  const trailRef = useRef([]);
  const [previousHref, setPreviousHref] = useState(null);

  useEffect(() => {
    const owner = user?.id ?? null;
    if (ownerRef.current !== owner) {
      trailRef.current = [];
      ownerRef.current = owner;
    }
    trailRef.current = advanceWorkspaceTrail(trailRef.current, pathname + search);
    setPreviousHref(trailRef.current.length > 1 ? trailRef.current.at(-2) : null);
  }, [pathname, search, user?.id]);

  const navigation = getWorkspaceNavigation(pathname);
  if (!navigation.visible) return null;
  return (
    <div className="mx-auto flex w-full max-w-7xl flex-wrap items-center gap-x-5 gap-y-1 px-5 pt-4 sm:px-8">
      <Link to={previousHref || navigation.backPath}
        aria-label={previousHref ? 'Back to previous EYLO page' : 'Back to ' + navigation.backLabel}
        className="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-lg border border-border bg-card px-3 text-sm font-semibold text-foreground hover:border-primary/40 hover:bg-secondary focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary">
        <ArrowLeft size={15} aria-hidden="true" />
        {previousHref ? 'Back' : 'Back to ' + navigation.backLabel}
      </Link>
      <nav aria-label="Breadcrumb" className="min-w-0 flex-1">
        <ol className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <li><Link to="/home" className="inline-flex min-h-8 items-center hover:text-primary">Home</Link></li>
          {navigation.crumbs.map((crumb, index) => (
            <li key={index} className="inline-flex min-h-8 items-center gap-2">
              <span aria-hidden="true">/</span>
              {crumb.path
                ? <Link to={crumb.path} className="inline-flex min-h-8 items-center hover:text-primary">{crumb.label}</Link>
                : <span aria-current="page" className="font-medium text-foreground">{crumb.label}</span>}
            </li>
          ))}
        </ol>
      </nav>
    </div>
  );
}
