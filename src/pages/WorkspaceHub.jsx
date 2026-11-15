import React from 'react';
import { Link } from 'react-router-dom';
import { BookOpen, CalendarDays, FileText, FolderOpen, ListTodo, NotebookPen, Search } from 'lucide-react';
import PersonalizedDashboard from '@/components/dashboard/PersonalizedDashboard';

const WORKSPACE_ACTIONS = [
  { label: 'Projects', path: '/projects', icon: FolderOpen, description: 'Research, evidence and decisions' },
  { label: 'Notes', path: '/notes', icon: NotebookPen, description: 'Write and organize ideas' },
  { label: 'Saved research', path: '/library', icon: BookOpen, description: 'Return to evidence' },
  { label: 'Files', path: '/files', icon: FileText, description: 'Open your project files' },
  { label: 'Tasks', path: '/life', icon: ListTodo, description: 'Plan your next actions' },
  { label: 'Calendar', path: '/calendar', icon: CalendarDays, description: 'See upcoming work' },
];

export default function WorkspaceHub() {
  return (
    <div className="eylo-page mx-auto max-w-7xl">
      <header className="mb-8">
        <p className="eylo-eyebrow">Your workspace</p>
        <h1 className="eylo-page-heading">Continue your research.</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">Open what you have saved or pick up a task. Everything here uses your signed-in workspace.</p>
        <Link to="/workspace/search" className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-xl border border-border bg-card px-4 text-sm font-semibold text-foreground hover:border-primary/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary">
          <Search size={16} aria-hidden="true" /> Search saved work
        </Link>
      </header>
      <nav aria-label="Workspace areas" className="mb-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {WORKSPACE_ACTIONS.map(item => {
          const Icon = item.icon;
          return <Link key={item.path} to={item.path} className="group flex min-h-20 items-center gap-3 rounded-2xl border border-border bg-card p-4 transition-colors hover:border-primary/35 hover:bg-secondary/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-secondary text-primary"><Icon size={18} aria-hidden="true" /></span>
            <span className="min-w-0"><span className="block text-sm font-semibold text-foreground">{item.label}</span><span className="mt-1 block text-xs text-muted-foreground">{item.description}</span></span>
          </Link>;
        })}
      </nav>
      <PersonalizedDashboard />
    </div>
  );
}
