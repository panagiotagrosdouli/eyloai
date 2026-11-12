import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Activity, ArrowRight, BookOpen, CalendarDays, Check, ChevronRight,
  CirclePlus, Clock3, FolderOpen, GraduationCap, Layers3,
  NotebookPen, Search, Target,
} from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';

const SOURCES = [
  ['projects', () => base44.entities.Project.list('-updated_date', 4)],
  ['notes', () => base44.entities.Note.list('-updated_date', 4)],
  ['tasks', () => base44.entities.LifeTask.filter({ due_date: localDate() }, '-updated_date', 100)],
  ['goals', () => base44.entities.LifeGoal.filter({ area: 'study' }, '-updated_date', 4)],
  ['events', () => base44.entities.CalendarEvent.list('-updated_date', 1000)],
  ['decks', () => base44.entities.FlashcardDeck.list('-updated_date', 4)],
  ['papers', () => base44.entities.SavedPaper.list('-updated_date', 4)],
  ['activity', () => base44.entities.ActivityEvent.list('-created_date', 6)],
];

function localDate(date = new Date()) {
  return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join('-');
}

function isComplete(task) {
  return task?.completed === true || ['done', 'complete', 'completed'].includes(String(task?.status || '').toLowerCase());
}

function formatDate(value, options = { month: 'short', day: 'numeric' }) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : new Intl.DateTimeFormat(undefined, options).format(date);
}

function recordHref(kind, item) {
  const id = encodeURIComponent(item.id);
  if (kind === 'projects') return '/projects/' + id;
  if (kind === 'notes') return '/notes?focus=' + id;
  if (kind === 'tasks') return (item.area === 'study' ? '/study-planner' : '/life') + '?focus=' + id;
  if (kind === 'events') return '/calendar?focus=' + id;
  if (kind === 'decks') return '/flashcards?focus=' + id;
  if (kind === 'papers') return '/library';
  const routes = { projects: '/projects', notes: '/notes', life_tasks: '/life', life_goals: '/life/goals', study_flashcard_decks: '/flashcards', calendar_events: '/calendar' };
  const route = routes[item.entity_type] || '/activity';
  return item.action === 'deleted' ? route : route + '?focus=' + id;
}

function Section({ title, href, icon: Icon, empty, children, count, source, failedSources = [] }) {
  return (
    <section className="rounded-2xl border border-border bg-card p-4 sm:p-5">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <Icon size={16} className="text-primary" aria-hidden="true" />{title}
          {typeof count === 'number' && <span className="text-xs font-normal text-muted-foreground">{count}</span>}
        </h2>
        <Link to={href} className="inline-flex min-h-8 items-center gap-1 rounded-md px-2 text-xs font-medium text-primary hover:bg-secondary/60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary">
          Open <ArrowRight size={13} aria-hidden="true" />
        </Link>
      </div>
      {failedSources.includes(source) ? <p role="status" className="rounded-xl border border-border px-4 py-5 text-sm text-muted-foreground">This section could not be loaded. Retry to check your saved data.</p> : children || <div className="rounded-xl border border-dashed border-border px-4 py-5 text-sm text-muted-foreground">{empty}</div>}
    </section>
  );
}

function ItemLink({ href, title, detail, done = false }) {
  return (
    <Link to={href} className="group flex min-h-12 items-center gap-3 rounded-lg px-2 py-2 hover:bg-secondary/50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary">
      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-secondary text-primary">
        {done ? <Check size={15} aria-hidden="true" /> : <ChevronRight size={15} aria-hidden="true" />}
      </span>
      <span className="min-w-0 flex-1">
        <span className={'block truncate text-sm font-medium ' + (done ? 'text-muted-foreground line-through' : 'text-foreground')}>{title || 'Untitled'}</span>
        {detail && <span className="mt-0.5 block truncate text-xs text-muted-foreground">{detail}</span>}
      </span>
    </Link>
  );
}

function EmptyAction({ children, href }) {
  return <div className="rounded-xl border border-dashed border-border px-4 py-5">
    <p className="text-sm text-muted-foreground">{children}</p>
    <Link to={href} className="mt-3 inline-flex min-h-9 items-center gap-2 rounded-lg bg-primary px-3 text-xs font-semibold text-primary-foreground hover:opacity-90">
      <CirclePlus size={14} aria-hidden="true" /> Get started
    </Link>
  </div>;
}

export default function PersonalizedDashboard() {
  const { user } = useAuth();
  const [attempt, setAttempt] = useState(0);
  const [data, setData] = useState({});
  const [failed, setFailed] = useState([]);
  const [loading, setLoading] = useState(true);
  const [today, setToday] = useState(() => localDate());

  useEffect(() => {
    const timer = window.setInterval(() => setToday(localDate()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setData({});
    setFailed([]);
    if (!user?.id) {
      setLoading(false);
      return () => { active = false; };
    }
    Promise.allSettled(SOURCES.map(([, load]) => load())).then(results => {
      if (!active) return;
      const next = {};
      const errors = [];
      results.forEach((result, index) => {
        const [key] = SOURCES[index];
        if (result.status === 'fulfilled') next[key] = result.value;
        else errors.push(key);
      });
      setData(next);
      setFailed(errors);
      setLoading(false);
    });
    return () => { active = false; };
  }, [user?.id, attempt, today]);

  const tasks = (data.tasks || []).filter(task => !isComplete(task)).sort((a, b) => String(a.due_date || '').localeCompare(String(b.due_date || '')));
  const events = (data.events || []).filter(event => event.start_at && new Date(event.start_at).getTime() >= Date.now()).sort((a, b) => new Date(a.start_at) - new Date(b.start_at)).slice(0, 4);
  const hasFailures = failed.length > 0;

  return (
    <section className="eylo-page mx-auto max-w-7xl pt-0" aria-labelledby="personal-workspace-title">
      <header className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="eylo-eyebrow">Your saved work</p>
          <h2 id="personal-workspace-title" className="mt-1 text-xl font-semibold text-foreground">Workspace overview</h2>
        </div>
        <details className="relative">
          <summary className="inline-flex min-h-10 cursor-pointer list-none items-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary">
            <CirclePlus size={16} aria-hidden="true" /> Create new
          </summary>
          <nav aria-label="Create new item" className="absolute right-0 z-20 mt-2 grid w-56 gap-1 rounded-xl border border-border bg-card p-2 shadow-lg">
            <Link className="rounded-lg px-3 py-2 text-sm hover:bg-secondary" to="/notes">Note</Link>
            <Link className="rounded-lg px-3 py-2 text-sm hover:bg-secondary" to="/projects">Project</Link>
            <Link className="rounded-lg px-3 py-2 text-sm hover:bg-secondary" to="/life">Task</Link>
            <Link className="rounded-lg px-3 py-2 text-sm hover:bg-secondary" to="/calendar">Calendar event</Link>
            <Link className="rounded-lg px-3 py-2 text-sm hover:bg-secondary" to="/flashcards">Flashcard deck</Link>
          </nav>
        </details>
      </header>
      <div className="mb-4 flex flex-wrap gap-2">
        <Link to="/workspace/search" className="inline-flex min-h-9 items-center gap-2 rounded-lg border border-border px-3 text-xs font-medium text-foreground hover:border-primary/40"><Search size={14} aria-hidden="true" /> Search my workspace</Link>
        <Link to="/activity" className="inline-flex min-h-9 items-center gap-2 rounded-lg border border-border px-3 text-xs font-medium text-foreground hover:border-primary/40"><Activity size={14} aria-hidden="true" /> Activity history</Link>
      </div>
      {hasFailures && <div role="alert" className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-destructive/30 px-4 py-3 text-sm text-destructive">
        <span>Some workspace records could not be loaded. Available sections are shown; retry to refresh.</span>
        <button type="button" onClick={() => setAttempt(value => value + 1)} className="min-h-9 rounded-lg border border-destructive/30 px-3 text-xs font-semibold">Retry</button>
      </div>}

      <div className="grid gap-4 lg:grid-cols-2">
        <Section title="Today's tasks" href="/life" icon={Target} source="tasks" failedSources={failed} empty="No tasks are due today." count={tasks.length}>
          {loading ? <p role="status" className="py-4 text-sm text-muted-foreground">Loading your tasks…</p> : tasks.length ? <div className="divide-y divide-border">{tasks.slice(0, 6).map(task => <ItemLink key={task.id} href={recordHref('tasks', task)} title={task.title} detail={task.area === 'study' ? 'Study planner' : task.priority ? task.priority + ' priority' : 'Task'} />)}</div> : <EmptyAction href="/life">No open tasks are due today.</EmptyAction>}
        </Section>

        <Section title="Calendar" href="/calendar" icon={CalendarDays} source="events" failedSources={failed} empty="No upcoming events are saved." count={events.length}>
          {loading ? <p role="status" className="py-4 text-sm text-muted-foreground">Loading calendar…</p> : events.length ? <div className="divide-y divide-border">{events.map(event => <ItemLink key={event.id} href={recordHref('events', event)} title={event.title} detail={formatDate(event.start_at, { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })} />)}</div> : <EmptyAction href="/calendar">Add your first calendar event.</EmptyAction>}
        </Section>

        <Section title="Recent projects" href="/projects" icon={FolderOpen} source="projects" failedSources={failed} empty="Your projects will appear here." count={(data.projects || []).length}>
          {loading ? <p role="status" className="py-4 text-sm text-muted-foreground">Loading projects…</p> : data.projects?.length ? <div className="divide-y divide-border">{data.projects.map(item => <ItemLink key={item.id} href={recordHref('projects', item)} title={item.title} detail={item.updated_date ? 'Updated ' + formatDate(item.updated_date) : 'Project'} />)}</div> : <EmptyAction href="/projects">Create a project to keep your research together.</EmptyAction>}
        </Section>

        <Section title="Recent notes" href="/notes" icon={NotebookPen} source="notes" failedSources={failed} empty="Your saved notes will appear here." count={(data.notes || []).length}>
          {loading ? <p role="status" className="py-4 text-sm text-muted-foreground">Loading notes…</p> : data.notes?.length ? <div className="divide-y divide-border">{data.notes.map(item => <ItemLink key={item.id} href={recordHref('notes', item)} title={item.title} detail={item.updated_date ? 'Edited ' + formatDate(item.updated_date) : 'Note'} />)}</div> : <EmptyAction href="/notes">Write your first note.</EmptyAction>}
        </Section>

        <Section title="Study planner" href="/study-planner" icon={GraduationCap} source="goals" failedSources={failed} empty="Your study tasks and goals will appear here." count={(data.goals || []).length}>
          {loading ? <p role="status" className="py-4 text-sm text-muted-foreground">Loading study goals…</p> : data.goals?.length ? <div className="divide-y divide-border">{data.goals.map(item => <ItemLink key={item.id} href={'/life/goals?focus=' + encodeURIComponent(item.id)} title={item.title} detail={item.area === 'study' ? 'Study goal' : 'Goal'} />)}</div> : <EmptyAction href="/study-planner">Plan a study session or goal.</EmptyAction>}
        </Section>

        <Section title="Flashcards" href="/flashcards" icon={Layers3} source="decks" failedSources={failed} empty="Your decks will appear here." count={(data.decks || []).length}>
          {loading ? <p role="status" className="py-4 text-sm text-muted-foreground">Loading decks…</p> : data.decks?.length ? <div className="divide-y divide-border">{data.decks.map(item => <ItemLink key={item.id} href={recordHref('decks', item)} title={item.title} detail={item.course || 'Saved deck'} />)}</div> : <EmptyAction href="/flashcards">Create your first flashcard deck.</EmptyAction>}
        </Section>

        <Section title="Saved research" href="/library" icon={BookOpen} source="papers" failedSources={failed} empty="Save a paper to return to it here." count={(data.papers || []).length}>
          {loading ? <p role="status" className="py-4 text-sm text-muted-foreground">Loading saved research…</p> : data.papers?.length ? <div className="divide-y divide-border">{data.papers.map(item => <ItemLink key={item.id} href={recordHref('papers', item)} title={item.title || item.name} detail={item.updated_date ? 'Saved ' + formatDate(item.updated_date) : 'Saved paper'} />)}</div> : <EmptyAction href="/workspace/search">Search your workspace</EmptyAction>}
        </Section>

        <Section title="Recent activity" href="/activity" icon={Clock3} source="activity" failedSources={failed} empty="New saved changes will appear here." count={(data.activity || []).length}>
          {loading ? <p role="status" className="py-4 text-sm text-muted-foreground">Loading activity…</p> : data.activity?.length ? <div className="divide-y divide-border">{data.activity.map(item => <ItemLink key={item.id} href={recordHref('activity', item)} title={(item.action || 'Changed') + ' · ' + (item.entity_label || 'Workspace record')} detail={formatDate(item.created_date, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })} />)}</div> : <EmptyAction href="/activity">Your recorded changes will be listed here.</EmptyAction>}
        </Section>
      </div>

      <section className="mt-6 rounded-2xl border border-border bg-card p-4 sm:p-5" aria-labelledby="products-heading">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div><p className="eylo-eyebrow">Workspace tools</p><h2 id="products-heading" className="mt-1 text-lg font-semibold">EYLO products</h2></div>
        </div>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {[
            ['Notes', '/notes', NotebookPen], ['Life', '/life', Target], ['Study Planner', '/study-planner', GraduationCap],
            ['Calendar', '/calendar', CalendarDays], ['Flashcards', '/flashcards', Layers3], ['Universal Search', '/workspace/search', Search],
            ['Activity History', '/activity', Activity], ['Research Library', '/library', BookOpen],
          ].map(([label, href, Icon]) => <Link key={label} to={href} className="flex min-h-12 items-center gap-3 rounded-xl border border-border px-3 text-sm font-medium hover:border-primary/40 hover:bg-secondary/30">
            <Icon size={16} className="text-primary" aria-hidden="true" />{label}<ChevronRight size={14} className="ml-auto text-muted-foreground" aria-hidden="true" />
          </Link>)}
        </div>
      </section>
    </main>
  );
}
