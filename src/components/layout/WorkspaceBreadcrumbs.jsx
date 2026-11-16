import React from 'react';
import { Link, useLocation } from 'react-router-dom';

// Breadcrumbs are navigation aids, not a second title bar.
// The final crumb is text; existing page-level headings remain authoritative.
const ROUTE_LABELS = {
  search: 'Workspace search', projects: 'My workspace', library: 'Library',
  files: 'Files', notes: 'Notes', learn: 'Learn', 'study-planner': 'Study planner',
  calendar: 'Calendar', tools: 'All tools', opportunities: 'Funding and calls',
  researchers: 'Researchers', 'research-journey': 'Research Journey', 'research-gaps': 'Research gap finder',
  'literature-review': 'Literature review protocol', 'knowledge-graph': 'Knowledge graph',
  meetings: 'Meetings', 'grant-builder': 'Grant workspace',
  'quiz-generator': 'Quiz generator', flashcards: 'Flashcards',
  settings: 'Settings', profile: 'Profile', history: 'Search history',
  'time-tracker': 'Time tracker', 'workspace': 'Workspace',
  'labs': 'Research labs', 'data': 'Research Data Lab',
};
const isNavigable = path => (
  ['/home', '/projects', '/tools', '/learn', '/life', '/workspace/search'].includes(path)
  || /^\/projects\/[^/]+$/.test(path)
);
const labelFor = segment => ROUTE_LABELS[segment] || segment.replace(/-/g, ' ').replace(/^./, s => s.toUpperCase());

export default function WorkspaceBreadcrumbs() {
  const { pathname } = useLocation();
  if (pathname === '/home' || pathname === '/search') return null;
  const segments = pathname.split('/').filter(Boolean);
  const crumbs = segments.map((segment, index) => {
    const path = '/' + segments.slice(0, index + 1).join('/');
    const dynamic = index > 0 && segments[index - 1] === 'projects' && segment !== 'workbench';
    return { path, label: dynamic ? 'Project' : labelFor(segment) };
  });
  return (
    <nav aria-label="Breadcrumb" className="mx-auto w-full max-w-7xl px-5 pt-4 sm:px-8">
      <ol className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <li><Link to="/search" className="inline-flex min-h-8 items-center hover:text-primary">Home</Link></li>
        {crumbs.map((crumb, index) => (
          <li key={crumb.path} className="inline-flex min-h-8 items-center gap-2">
            <span aria-hidden="true">/</span>
            {index === crumbs.length - 1 ? <span aria-current="page" className="font-medium text-foreground">{crumb.label}</span>
              : isNavigable(crumb.path)
                ? <Link to={crumb.path} className="hover:text-primary">{crumb.label}</Link>
                : <span>{crumb.label}</span>}
          </li>
        ))}
      </ol>
    </nav>
  );
}
