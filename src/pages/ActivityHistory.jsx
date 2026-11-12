import React, { useEffect, useRef, useState } from 'react';
import { Clock3, FolderKanban, Layers3, NotebookPen, RefreshCw, Target, Trash2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';

const TYPES = {
  projects: { label: 'Project', href: '/projects', Icon: FolderKanban },
  notes: { label: 'Note', href: '/notes', Icon: NotebookPen },
  life_tasks: { label: 'Task', href: '/life', Icon: Target },
  life_goals: { label: 'Goal', href: '/life/goals', Icon: Target },
  study_flashcard_decks: { label: 'Flashcard deck', href: '/flashcards', Icon: Layers3 },
  calendar_events: { label: 'Calendar event', href: '/calendar', Icon: Clock3 },
};
const ACTIONS = { created: 'Created', updated: 'Updated', deleted: 'Deleted' };

export default function ActivityHistory() {
  const { user } = useAuth();
  const owner = useRef(user?.id || null);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [clearing, setClearing] = useState(false);

  const load = async (ownerId = owner.current) => {
    if (!ownerId || ownerId !== owner.current) return;
    setLoading(true); setError('');
    try {
      const events = await base44.entities.ActivityEvent.list('-created_date', 200);
      if (ownerId === owner.current) setItems(events);
    } catch (loadError) {
      if (ownerId === owner.current) setError(loadError?.message || 'Activity history could not be loaded. Retry your connection.');
    } finally { if (ownerId === owner.current) setLoading(false); }
  };

  useEffect(() => {
    owner.current = user?.id || null; setItems([]); setError('');
    if (user?.id) void load(user.id); else setLoading(false);
  }, [user?.id]);

  const clearHistory = async () => {
    if (!window.confirm('Permanently clear all activity history for your account? This does not delete the projects or records themselves.')) return;
    const ownerId = owner.current;
    if (!ownerId || clearing) return;
    setClearing(true); setError('');
    try {
      await base44.entities.ActivityEvent.clear();
      if (owner.current === ownerId) setItems([]);
    } catch (clearError) {
      if (owner.current === ownerId) setError(clearError?.message || 'Activity history could not be cleared. Retry.');
    } finally { if (owner.current === ownerId) setClearing(false); }
  };

  return <div className="eylo-page max-w-4xl">
    <header className="mb-6 flex flex-wrap items-start justify-between gap-4"><div><p className="eylo-eyebrow">Private workspace</p><h1 className="eylo-page-heading">Activity history</h1><p className="mt-1 max-w-2xl text-sm text-muted-foreground">Recent creates, edits and deletions across your projects, notes, tasks, goals, flashcard decks and calendar events. Content is not copied into the history. You can permanently clear your history at any time.</p></div><div className="flex gap-2"><button type="button" onClick={() => void load()} disabled={loading} className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-border px-3 text-sm disabled:opacity-50"><RefreshCw size={15} className={loading ? 'animate-spin' : ''}/>Refresh</button>{items.length > 0 && <button type="button" onClick={() => void clearHistory()} disabled={clearing} className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-destructive/40 px-3 text-sm text-destructive disabled:opacity-50"><Trash2 size={15}/>{clearing ? 'Clearing…' : 'Clear history'}</button>}</div></header>
    {error && <div role="alert" className="mb-4 flex items-center justify-between gap-3 rounded-lg border border-destructive/30 px-4 py-3 text-sm text-destructive"><span>{error}</span><button type="button" onClick={() => void load()} className="underline">Retry</button></div>}
    {loading ? <p role="status" className="rounded-xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">Loading activity…</p>
      : items.length ? <ol className="space-y-2">{items.map(item => { const details = TYPES[item.entity_type] || { label: 'Workspace record', href: '/home', Icon: Clock3 }; const Icon = details.Icon; return <li key={item.id} className="flex gap-3 rounded-xl border border-border bg-card p-4"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-secondary text-muted-foreground"><Icon size={16}/></span><div className="min-w-0 flex-1"><p className="text-sm"><span className="font-semibold">{ACTIONS[item.action] || 'Changed'}</span> {details.label.toLowerCase()} · <Link to={details.href} className="font-medium text-primary underline-offset-2 hover:underline">{item.entity_label || 'Untitled record'}</Link></p><time dateTime={item.created_date} className="mt-1 block text-xs text-muted-foreground">{new Date(item.created_date).toLocaleString()}</time></div>{item.action === 'deleted' && <Trash2 size={14} className="mt-1 text-muted-foreground" aria-label="Deleted record"/>}</li>; })}</ol>
        : <div className="rounded-xl border border-border bg-card p-8 text-center"><Clock3 size={22} className="mx-auto text-muted-foreground"/><p className="mt-3 text-sm font-semibold">No recorded activity yet</p><p className="mt-1 text-xs text-muted-foreground">New changes are recorded after the activity-history migration is applied.</p></div>}
  </div>;
}

