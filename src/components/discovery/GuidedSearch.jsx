import React, { useMemo, useState } from 'react';
import {
  ArrowRight, BookOpen, Compass, GraduationCap, Layers3, Search,
  Target, Wrench, X,
} from 'lucide-react';
import { trackGuidedSearchCompleted } from '@/lib/product-analytics';

export const DISCOVERY_LEVELS = [
  { id: 'beginner', label: 'New to the topic', desc: 'Explain terms and choose approachable starting papers', icon: Compass },
  { id: 'student', label: 'University student', desc: 'Build understanding for coursework, thesis, or review', icon: GraduationCap },
  { id: 'researcher', label: 'Researcher', desc: 'Prioritize methods, evidence gaps, and current work', icon: BookOpen },
  { id: 'expert', label: 'Expert / faculty', desc: 'Surface frontier work, contrasts, and collaboration signals', icon: Layers3 },
];

export const DISCOVERY_GOALS = [
  { id: 'understand', label: 'Understand the field', desc: 'A guided path from concepts to evidence', icon: Compass },
  { id: 'review', label: 'Literature review', desc: 'A balanced, reproducible evidence map', icon: BookOpen },
  { id: 'thesis', label: 'Find a thesis or gap', desc: 'Recent limitations and defensible open questions', icon: Target },
  { id: 'build', label: 'Build a project', desc: 'Methods, applications, and implementation evidence', icon: Wrench },
  { id: 'collaborate', label: 'Find experts', desc: 'Researchers, institutions, and expertise fit', icon: GraduationCap },
];

export const DISCOVERY_RANGES = [
  { id: 'latest', label: 'Latest', desc: 'Mostly the last 2 years' },
  { id: 'five_years', label: 'Recent', desc: 'Mostly the last 5 years' },
  { id: 'balanced', label: 'Balanced', desc: 'Recent + foundational work' },
  { id: 'foundational', label: 'Foundational', desc: 'Landmark and survey papers' },
];

export function normalizeDiscoveryRequest(input) {
  if (typeof input === 'string') {
    return { topic: input.trim(), level: 'researcher', goal: 'review', recency: 'balanced' };
  }
  return {
    topic: String(input?.topic || input?.query || '').trim(),
    level: input?.level || 'researcher',
    goal: input?.goal || 'review',
    recency: input?.recency || 'balanced',
  };
}

export default function GuidedSearch({
  onSearch,
  initialTopic = '',
  defaultLevel = '',
  compact = false,
  autoRefine = true,
  initialRefine = false,
}) {
  const [topic, setTopic] = useState(initialTopic);
  const [draftTopic, setDraftTopic] = useState(initialTopic);
  const [level, setLevel] = useState(defaultLevel);
  const [goal, setGoal] = useState('');
  const [recency, setRecency] = useState('latest');
  const [refining, setRefining] = useState(initialRefine && Boolean(initialTopic));

  const isBroad = useMemo(() => draftTopic.trim().split(/\s+/).filter(Boolean).length <= 3, [draftTopic]);

  const complete = request => {
    trackGuidedSearchCompleted({
      level: request.level,
      goal: request.goal,
      recency: request.recency,
    });
    onSearch(request);
  };

  const start = event => {
    event?.preventDefault();
    const value = draftTopic.trim();
    if (!value) return;
    setTopic(value);
    if (autoRefine || isBroad) setRefining(true);
    else complete(normalizeDiscoveryRequest({ topic: value, level: defaultLevel, goal: 'review', recency: 'balanced' }));
  };

  const submit = () => {
    if (!topic || !level || !goal) return;
    complete(normalizeDiscoveryRequest({ topic, level, goal, recency }));
    setRefining(false);
  };

  const skip = () => {
    const request = normalizeDiscoveryRequest({
      topic: topic || draftTopic,
      level: level || defaultLevel || 'researcher',
      goal: goal || 'review',
      recency: 'balanced',
    });
    complete(request);
    setRefining(false);
  };

  return (
    <div className={`guided-discovery relative ${compact ? 'guided-discovery--compact' : ''}`}>
      <form onSubmit={start} className="relative">
        <div className="flex items-center rounded-xl border border-border bg-background p-1.5 transition-colors focus-within:border-primary/45 focus-within:ring-2 focus-within:ring-primary/10">
          <Search size={16} className="ml-3 shrink-0 text-muted-foreground" aria-hidden="true" />
          <input
            value={draftTopic}
            onChange={event => setDraftTopic(event.target.value)}
            aria-label="Research topic"
            placeholder="Enter a topic, research question, project, or decision…"
            className="min-w-0 flex-1 bg-transparent px-3 py-3.5 text-sm text-foreground outline-none placeholder:text-muted-foreground"
          />
          {draftTopic && (
            <button type="button" onClick={() => setDraftTopic('')} aria-label="Clear topic" className="rounded-lg p-2 text-muted-foreground hover:bg-secondary hover:text-foreground">
              <X size={13} />
            </button>
          )}
          <button type="submit" disabled={!draftTopic.trim()} className="inline-flex shrink-0 items-center gap-2 rounded-lg bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-35 sm:px-5">
            Continue <ArrowRight size={13} />
          </button>
        </div>
      </form>

      {refining && (
        <section className="mt-3 overflow-hidden rounded-2xl border border-border bg-popover p-4 shadow-2xl shadow-black/20 sm:p-6" aria-labelledby="guided-search-title">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[9px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Search setup</p>
              <h2 id="guided-search-title" className="mt-1 text-lg font-semibold text-foreground">Set the scope.</h2>
            </div>
            <button type="button" onClick={() => setRefining(false)} aria-label="Close search setup" className="rounded-lg p-2 text-muted-foreground hover:bg-secondary hover:text-foreground"><X size={14} /></button>
          </div>

          <fieldset className="mt-5">
            <legend className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">1 · Level</legend>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              {DISCOVERY_LEVELS.map(option => {
                const Icon = option.icon;
                const selected = level === option.id;
                return (
                  <button key={option.id} type="button" onClick={() => setLevel(option.id)} aria-pressed={selected} title={option.desc} className={`flex items-center gap-2 rounded-xl border p-3 text-left transition-colors ${selected ? 'border-primary/45 bg-primary/10' : 'border-border bg-card hover:border-primary/25'}`}>
                    <Icon size={14} className={selected ? 'text-primary' : 'text-muted-foreground'} />
                    <span className="text-xs font-semibold text-foreground">{option.label}</span>
                  </button>
                );
              })}
            </div>
          </fieldset>

          <fieldset className="mt-5">
            <legend className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">2 · Goal</legend>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
              {DISCOVERY_GOALS.map(option => {
                const Icon = option.icon;
                const selected = goal === option.id;
                return (
                  <button key={option.id} type="button" onClick={() => setGoal(option.id)} aria-pressed={selected} title={option.desc} className={`flex items-center gap-2 rounded-xl border p-3 text-left transition-colors ${selected ? 'border-primary/45 bg-primary/10' : 'border-border bg-card hover:border-primary/25'}`}>
                    <Icon size={14} className={selected ? 'text-primary' : 'text-muted-foreground'} />
                    <span className="text-xs font-semibold text-foreground">{option.label}</span>
                  </button>
                );
              })}
            </div>
          </fieldset>

          <fieldset className="mt-5">
            <legend className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">3 · Range</legend>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {DISCOVERY_RANGES.map(option => {
                const selected = recency === option.id;
                return (
                  <button key={option.id} type="button" onClick={() => setRecency(option.id)} aria-pressed={selected} title={option.desc} className={`rounded-xl border px-3 py-2.5 text-left transition-colors ${selected ? 'border-primary/45 bg-primary/10' : 'border-border bg-card hover:border-primary/25'}`}>
                    <span className="text-xs font-semibold text-foreground">{option.label}</span>
                  </button>
                );
              })}
            </div>
          </fieldset>

          <div className="mt-6 flex flex-col-reverse gap-2 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
            <button type="button" onClick={skip} className="px-3 py-2 text-xs font-medium text-muted-foreground hover:text-foreground">Use defaults</button>
            <button type="button" onClick={submit} disabled={!level || !goal} className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-35">
              <Search size={14} /> Search evidence
            </button>
          </div>
        </section>
      )}
    </div>
  );
}
