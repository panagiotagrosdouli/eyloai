import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, BookOpen, FolderOpen, GraduationCap, Search, Users, X } from 'lucide-react';

/**
 * Optional, local-only onboarding. Choosing an entry path does not change
 * authentication, plan access, account profile or availability of other tools.
 */
export const ENTRY_PATHS = Object.freeze([
  { id: 'student', label: 'Student', description: 'Understand, practice, and plan.', actions: [
    { label: 'Create a study plan', path: '/study-planner', icon: GraduationCap },
    { label: 'Review flashcards', path: '/flashcards', icon: BookOpen },
  ] },
  { id: 'researcher', label: 'Researcher', description: 'Find and organize evidence.', actions: [
    { label: 'Start researching', path: '/search', icon: Search },
    { label: 'Prepare a literature review', path: '/literature-review', icon: BookOpen },
  ] },
  { id: 'team', label: 'Research team', description: 'Coordinate research together.', actions: [
    { label: 'Open projects', path: '/projects', icon: FolderOpen },
    { label: 'Find researchers', path: '/researchers', icon: Users },
  ] },
  { id: 'exploring', label: 'Exploring EYLO', description: 'Discover what you can do.', actions: [
    { label: 'Explore a topic', path: '/search', icon: Search },
    { label: 'Browse all tools', path: '/tools', icon: FolderOpen },
  ] },
]);

function localKey(userId) {
  return `eylo:optional-start:${String(userId || '').slice(0, 100)}`;
}

export default function GoalOnboarding({ userId, existingRole }) {
  const [state, setState] = useState('checking');
  const [selected, setSelected] = useState('');
  useEffect(() => {
    if (!userId || existingRole) {
      setState('hidden');
      return;
    }
    try {
      const saved = localStorage.getItem(localKey(userId));
      if (saved === 'skip') { setState('hidden'); return; }
      if (ENTRY_PATHS.some(path => path.id === saved)) {
        setSelected(saved);
        setState('suggestions');
        return;
      }
    } catch {
      // Local preferences are optional; onboarding never blocks research.
    }
    setSelected('');
    setState('choose');
  }, [userId, existingRole]);

  const choose = id => {
    setSelected(id);
    setState('suggestions');
    try { localStorage.setItem(localKey(userId), id); } catch { /* Optional browser preference. */ }
  };
  const skip = () => {
    setState('hidden');
    try { localStorage.setItem(localKey(userId), 'skip'); } catch { /* Optional browser preference. */ }
  };

  if (state === 'checking' || state === 'hidden') return null;
  const chosen = ENTRY_PATHS.find(path => path.id === selected);

  return (
    <section aria-labelledby="eylo-start-title" className="mx-auto mt-6 w-full max-w-7xl rounded-2xl border border-border bg-card px-5 py-5 sm:px-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-primary">Optional starting point</p>
          <h2 id="eylo-start-title" className="mt-1 text-lg font-semibold text-foreground">What brings you to EYLO?</h2>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">Choose a starting point to see relevant actions. Your other tools remain available. This preference stays in this browser, not your research profile.</p>
        </div>
        <button type="button" onClick={skip} className="inline-flex min-h-11 items-center gap-2 rounded-lg px-3 text-sm font-medium text-muted-foreground hover:bg-secondary hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary">
          <X size={15} aria-hidden="true" /> Skip
        </button>
      </div>
      <div role="group" aria-label="Choose a suggested starting point" className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {ENTRY_PATHS.map(option => (
          <button type="button" key={option.id} aria-pressed={selected === option.id} onClick={() => choose(option.id)}
            className={`min-h-20 rounded-xl border p-3 text-left transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary ${selected === option.id ? 'border-primary bg-primary/10' : 'border-border bg-background hover:border-primary/30'}`}>
            <span className="block text-sm font-semibold text-foreground">{option.label}</span>
            <span className="mt-1 block text-xs leading-5 text-muted-foreground">{option.description}</span>
          </button>
        ))}
      </div>
      {chosen && (
        <nav aria-label={`Suggested actions for ${chosen.label}`} className="mt-4 flex flex-wrap gap-2">
          {chosen.actions.map(action => {
            const Icon = action.icon;
            return <Link key={action.path} to={action.path}
              className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-primary/20 bg-primary/5 px-4 text-sm font-semibold text-foreground hover:border-primary/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary">
              <Icon size={16} aria-hidden="true" />{action.label}<ArrowRight size={14} aria-hidden="true" />
            </Link>;
          })}
        </nav>
      )}
    </section>
  );
}
