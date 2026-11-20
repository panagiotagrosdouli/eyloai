import React from 'react';
import { BookOpen, Brain, Award, Rocket, Users, BarChart3, Target, FileText, AlertTriangle, Map, ArrowUpRight } from 'lucide-react';
import { EYRA_MODES, EYRA_QUICK_COMMANDS } from '@/lib/eyra-next-policy.mjs';

export const EYRA_MODE_ICONS = {
  research: BookOpen, strategy: Brain, funding: Award,
  startup: Rocket, team: Users, impact: BarChart3,
};
const COMMAND_ICONS = {
  project: Target, literature: FileText, gaps: AlertTriangle,
  funding: Award, team: Users, roadmap: Map,
};

/** Compact, always-visible research lens, horizontally scrollable without hiding choices. */
export function EyraModeSelector({ activeMode, onChange, disabled = false }) {
  return (
    <nav aria-label="EYRA research lens" className="shrink-0 border-b border-border/40 bg-card/40 px-3 py-2.5 sm:px-8">
      <div role="group" aria-label="EYRA research lens" className="mx-auto flex max-w-3xl items-center gap-1.5 overflow-x-auto rounded-2xl bg-secondary/30 p-1.5 [scrollbar-width:thin]">
        {EYRA_MODES.map(mode => {
          const Icon = EYRA_MODE_ICONS[mode.id] || BookOpen;
          const active = activeMode === mode.id;
          return (
            <button
              key={mode.id} type="button" disabled={disabled}
              onClick={() => onChange(mode.id)} aria-pressed={active}
              title={mode.prompt}
              className={`inline-flex min-h-10 shrink-0 items-center gap-2 rounded-xl border px-3.5 text-[13px] font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:opacity-50 ${active
                ? 'border-primary/15 bg-card font-semibold text-primary shadow-sm'
                : 'border-transparent text-muted-foreground hover:border-border/60 hover:bg-card/70 hover:text-foreground'}`}
            >
              <Icon size={15} aria-hidden="true" />{mode.label}
            </button>
          );
        })}
      </div>
    </nav>
  );
}

/** Keep each lens focused on a few genuinely relevant actions; prompts remain centrally defined. */
export const EYRA_MODE_STARTER_IDS = Object.freeze({
  research: ['literature', 'gaps', 'project'],
  strategy: ['project', 'roadmap', 'gaps'],
  funding: ['funding', 'project', 'roadmap'],
  startup: ['roadmap', 'project', 'funding'],
  team: ['team', 'project', 'roadmap'],
  impact: ['gaps', 'roadmap', 'literature'],
});

/** Suggested tasks belong to the empty-chat state, not a permanent second toolbar. */
export function EyraQuickCommands({ onSelect, activeMode = 'research', disabled = false }) {
  const relevantIds = EYRA_MODE_STARTER_IDS[activeMode] || EYRA_MODE_STARTER_IDS.research;
  const suggestions = relevantIds.map(id => EYRA_QUICK_COMMANDS.find(command => command.id === id)).filter(Boolean);
  return (
    <section aria-labelledby="eyra-start-outcome" className="mt-6">
      <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
        <h3 id="eyra-start-outcome" className="text-sm font-bold tracking-tight text-foreground">Try a starting point</h3>
        <p className="text-xs text-muted-foreground">Or ask your own question</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        {suggestions.map(command => {
          const Icon = COMMAND_ICONS[command.id] || BookOpen;
          return (
            <button
              key={command.id} type="button" disabled={disabled}
              onClick={() => onSelect(command.prompt)}
              className="group flex min-h-14 items-center gap-2.5 rounded-xl border border-border/70 bg-card px-3.5 py-3 text-left text-[13px] font-medium leading-5 text-foreground transition-colors hover:border-primary/40 hover:bg-secondary/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:opacity-50"
            >
              <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary"><Icon size={18} aria-hidden="true" /></span>
              <span className="min-w-0 flex-1">{command.label}</span>
              <ArrowUpRight size={15} className="ml-auto shrink-0 text-muted-foreground group-hover:text-primary" aria-hidden="true" />
            </button>
          );
        })}
      </div>
    </section>
  );
}
