import React, { useMemo, useState } from 'react';
import {
  ArrowRight, BookOpen, Compass, GraduationCap, Layers3, Search, Sparkles,
  Target, Wrench, X,
} from 'lucide-react';

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
}) {
  const [topic, setTopic] = useState(initialTopic);
  const [draftTopic, setDraftTopic] = useState(initialTopic);
  const [level, setLevel] = useState(defaultLevel);
  const [goal, setGoal] = useState('');
  const [recency, setRecency] = useState('latest');
  const [refining, setRefining] = useState(false);

  const isBroad = useMemo(() => draftTopic.trim().split(/\s+/).filter(Boolean).length <= 3, [draftTopic]);

  const start = event => {
    event?.preventDefault();
    const value = draftTopic.trim();
    if (!value) return;
    setTopic(value);
    if (autoRefine || isBroad) setRefining(true);
    else onSearch(normalizeDiscoveryRequest({ topic: value, level: defaultLevel, goal: 'review', recency: 'balanced' }));
  };

  const submit = () => {
    if (!topic || !level || !goal) return;
    onSearch(normalizeDiscoveryRequest({ topic, level, goal, recency }));
    setRefining(false);
  };

  const skip = () => {
    const request = normalizeDiscoveryRequest({
      topic: topic || draftTopic,
      level: level || defaultLevel || 'researcher',
      goal: goal || 'review',
      recency: 'balanced',
    });
    onSearch(request);
    setRefining(false);
  };

  return (
    <div className={`guided-discovery relative ${compact ? 'guided-discovery--compact' : ''}`}>
      <form onSubmit={start} className="relative">
        <div className="flex items-center rounded-2xl border border-cyan-200/15 bg-slate-950/60 p-1.5 shadow-2xl backdrop-blur-xl transition-all focus-within:border-cyan-300/45 focus-within:shadow-[0_0_34px_rgba(34,211,238,0.10)]">
          <Search size={16} className="ml-3 shrink-0 text-cyan-300" aria-hidden="true" />
          <input
            value={draftTopic}
            onChange={event => setDraftTopic(event.target.value)}
            aria-label="Research topic"
            placeholder="Try “robotics”, “CRISPR delivery”, or a full research question…"
            className="min-w-0 flex-1 bg-transparent px-3 py-3.5 text-sm text-white outline-none placeholder:text-slate-500"
          />
          {draftTopic && (
            <button type="button" onClick={() => setDraftTopic('')} aria-label="Clear topic" className="rounded-lg p-2 text-slate-500 hover:text-white">
              <X size={13} />
            </button>
          )}
          <button type="submit" disabled={!draftTopic.trim()} className="inline-flex shrink-0 items-center gap-2 rounded-xl eyra-gradient px-4 py-3 text-sm font-semibold text-white disabled:opacity-35 sm:px-5">
            Personalize <ArrowRight size={13} />
          </button>
        </div>
      </form>

      {refining && (
        <section className="mt-3 overflow-hidden rounded-3xl border border-cyan-200/15 bg-slate-950/95 p-4 shadow-[0_28px_90px_-36px_rgba(34,211,238,0.45)] backdrop-blur-2xl sm:p-6" aria-labelledby="guided-search-title">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-cyan-300">EYRA Search Setup</p>
              <h2 id="guided-search-title" className="mt-1 text-lg font-semibold text-white">Help me shape “{topic}” for you.</h2>
              <p className="mt-1 text-xs leading-5 text-slate-400">Three quick choices turn a broad word into a useful research path.</p>
            </div>
            <button type="button" onClick={() => setRefining(false)} aria-label="Close search setup" className="rounded-lg p-2 text-slate-500 hover:bg-white/5 hover:text-white"><X size={14} /></button>
          </div>

          <fieldset className="mt-5">
            <legend className="mb-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">1 · What is your level?</legend>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              {DISCOVERY_LEVELS.map(option => {
                const Icon = option.icon;
                const selected = level === option.id;
                return (
                  <button key={option.id} type="button" onClick={() => setLevel(option.id)} aria-pressed={selected} className={`rounded-2xl border p-3 text-left transition-all ${selected ? 'border-cyan-300/50 bg-cyan-300/10' : 'border-white/5 bg-white/[0.025] hover:border-cyan-200/20'}`}>
                    <Icon size={14} className={selected ? 'text-cyan-300' : 'text-slate-500'} />
                    <p className="mt-2 text-xs font-semibold text-slate-100">{option.label}</p>
                    <p className="mt-1 text-[10px] leading-4 text-slate-500">{option.desc}</p>
                  </button>
                );
              })}
            </div>
          </fieldset>

          <fieldset className="mt-5">
            <legend className="mb-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">2 · What do you want to achieve?</legend>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
              {DISCOVERY_GOALS.map(option => {
                const Icon = option.icon;
                const selected = goal === option.id;
                return (
                  <button key={option.id} type="button" onClick={() => setGoal(option.id)} aria-pressed={selected} className={`rounded-2xl border p-3 text-left transition-all ${selected ? 'border-violet-300/50 bg-violet-300/10' : 'border-white/5 bg-white/[0.025] hover:border-violet-200/20'}`}>
                    <Icon size={14} className={selected ? 'text-violet-300' : 'text-slate-500'} />
                    <p className="mt-2 text-xs font-semibold text-slate-100">{option.label}</p>
                    <p className="mt-1 text-[10px] leading-4 text-slate-500">{option.desc}</p>
                  </button>
                );
              })}
            </div>
          </fieldset>

          <fieldset className="mt-5">
            <legend className="mb-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">3 · How current should it be?</legend>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {DISCOVERY_RANGES.map(option => {
                const selected = recency === option.id;
                return (
                  <button key={option.id} type="button" onClick={() => setRecency(option.id)} aria-pressed={selected} className={`rounded-xl border px-3 py-2.5 text-left ${selected ? 'border-emerald-300/45 bg-emerald-300/10' : 'border-white/5 bg-white/[0.025]'}`}>
                    <p className="text-xs font-semibold text-slate-100">{option.label}</p>
                    <p className="mt-0.5 text-[9px] text-slate-500">{option.desc}</p>
                  </button>
                );
              })}
            </div>
          </fieldset>

          <div className="mt-6 flex flex-col-reverse gap-2 border-t border-white/5 pt-4 sm:flex-row sm:items-center sm:justify-between">
            <button type="button" onClick={skip} className="px-3 py-2 text-xs font-medium text-slate-400 hover:text-white">Skip and run a balanced search</button>
            <button type="button" onClick={submit} disabled={!level || !goal} className="inline-flex items-center justify-center gap-2 rounded-xl eyra-gradient px-5 py-3 text-sm font-semibold text-white disabled:opacity-35">
              <Sparkles size={14} /> Build my research path
            </button>
          </div>
        </section>
      )}
    </div>
  );
}
